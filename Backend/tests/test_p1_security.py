from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pyotp
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.rbac_service import ensure_rbac_seed
from app.application.admin.user_admin_service import suspend_user, unsuspend_user
from app.application.auth.account_service import mfa_disable
from app.application.auth.mfa_service import confirm_mfa_enrollment, generate_totp_secret
from app.application.auth.service import (
    AuthError,
    check_email,
    login_with_email,
    signup_start,
    signup_verify_email,
)
from app.infrastructure.persistence.models import (
    AuditEventType,
    AuditLog,
    User,
    UserMfaSecret,
    UserRole,
    UserStatus,
)
from app.application.security.security_config_service import ensure_security_config_seed
from app.infrastructure.security.hibp_service import PasswordPwnedError, ensure_password_not_pwned
from app.infrastructure.security.passwords import TIMING_SAFE_DUMMY_HASH, hash_password, verify_password
from app.core.config import get_settings


def _now() -> datetime:
    return datetime.now(timezone.utc)


@pytest.fixture
def fake_redis(monkeypatch: pytest.MonkeyPatch) -> dict[str, str]:
    store: dict[str, str] = {}

    class FakeRedis:
        async def setex(self, key: str, _ttl: int, value: str) -> None:
            store[key] = value

        async def get(self, key: str) -> str | None:
            return store.get(key)

        async def delete(self, key: str) -> None:
            store.pop(key, None)

        async def incr(self, key: str) -> int:
            current = int(store.get(key, "0")) + 1
            store[key] = str(current)
            return current

        async def expire(self, key: str, _ttl: int) -> None:
            _ = key

        async def ttl(self, key: str) -> int:
            return 600 if key in store else -1

    async def fake_get_redis(_db: int) -> FakeRedis:
        return FakeRedis()

    monkeypatch.setattr("app.core.redis.get_redis", fake_get_redis)
    monkeypatch.setattr("app.infrastructure.otp.service.get_redis", fake_get_redis)
    monkeypatch.setattr("app.infrastructure.persistence.signup_draft_store.get_redis", fake_get_redis)
    monkeypatch.setattr("app.infrastructure.persistence.password_reset_token_store.get_redis", fake_get_redis)
    monkeypatch.setattr("app.infrastructure.security.rate_limit.get_redis", fake_get_redis)
    monkeypatch.setattr("app.infrastructure.security.pending_auth.get_redis", fake_get_redis)
    monkeypatch.setattr("app.application.security.security_config_service.get_redis", fake_get_redis)
    monkeypatch.setattr("app.application.auth.progressive_lockout_service.get_redis", fake_get_redis)
    return store


@pytest.mark.asyncio
async def test_check_email_always_returns_continue(db_session: AsyncSession) -> None:
    existing = User(
        email=f"exists-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(existing)
    await db_session.flush()

    assert await check_email(db_session, existing.email) == {"next": "continue"}
    assert await check_email(db_session, f"missing-{uuid4()}@example.com") == {"next": "continue"}


@pytest.mark.asyncio
async def test_login_missing_user_verifies_dummy_hash(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = fake_redis
    await ensure_security_config_seed(db_session)
    calls: list[str] = []

    def fake_verify(password_hash: str, password: str) -> bool:
        calls.append(password_hash)
        return False

    async def allow_turnstile(*_args, **_kwargs) -> bool:
        return True

    monkeypatch.setattr("app.application.auth.login_service.verify_password", fake_verify)
    monkeypatch.setattr("app.application.auth.login_service.verify_turnstile", allow_turnstile)

    with pytest.raises(AuthError) as exc:
        await login_with_email(
            db_session,
            email=f"missing-{uuid4()}@example.com",
            password="Password1!",
            turnstile_token=None,
            device_fingerprint="device-fingerprint-12345678",
            user_agent=None,
            ip="127.0.0.1",
        )
    assert exc.value.code == "invalid_credentials"
    assert calls == [TIMING_SAFE_DUMMY_HASH]


@pytest.mark.asyncio
async def test_signup_existing_email_redirects_to_login(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def allow_turnstile(*_args, **_kwargs) -> bool:
        return True

    async def allow_rate_limit(*_args, **_kwargs) -> bool:
        return True

    monkeypatch.setattr("app.application.auth.signup_service.verify_turnstile", allow_turnstile)
    monkeypatch.setattr("app.application.auth.signup_service.check_rate_limit", allow_rate_limit)

    email = f"existing-{uuid4()}@example.com"
    user = User(
        email=email,
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    result = await signup_start(
        db_session,
        email=email,
        turnstile_token="token",
        ip="127.0.0.1",
    )
    assert result["next"] == "login"
    assert "signup_token" not in result or result.get("signup_token") is None
    assert "already exists" in result["message"].lower()


@pytest.mark.asyncio
async def test_mfa_disable_requires_step_up(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
) -> None:
    _ = fake_redis
    password = "Password1!"
    secret = generate_totp_secret()
    user = User(
        email=f"mfa-disable-{uuid4()}@example.com",
        password_hash=hash_password(password),
        role=UserRole.user,
        status=UserStatus.active,
        mfa_enrolled_at=_now(),
    )
    db_session.add(user)
    await db_session.flush()
    await confirm_mfa_enrollment(
        db_session,
        user=user,
        secret=secret,
        totp_code=pyotp.TOTP(secret).now(),
    )
    session_id = uuid4()

    with pytest.raises(AuthError) as exc:
        await mfa_disable(
            db_session,
            user=user,
            session_id=session_id,
            current_password=password,
            totp_code="000000",
            ip="127.0.0.1",
        )
    assert exc.value.code == "invalid_totp"

    await mfa_disable(
        db_session,
        user=user,
        session_id=session_id,
        current_password=password,
        totp_code=pyotp.TOTP(secret).now(),
        ip="127.0.0.1",
    )
    await db_session.flush()

    assert user.mfa_enrolled_at is None
    secrets = await db_session.execute(select(UserMfaSecret).where(UserMfaSecret.user_id == user.id))
    assert secrets.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_suspend_user_blocks_login(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = fake_redis
    await ensure_security_config_seed(db_session)

    async def allow_turnstile(*_args, **_kwargs) -> bool:
        return True

    monkeypatch.setattr("app.application.auth.login_service.verify_turnstile", allow_turnstile)
    await ensure_rbac_seed(db_session)
    password = "Password1!"
    user = User(
        email=f"suspend-{uuid4()}@example.com",
        password_hash=hash_password(password),
        role=UserRole.user,
        status=UserStatus.active,
    )
    admin = User(
        email=f"admin-{uuid4()}@example.com",
        password_hash=hash_password(password),
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add_all([user, admin])
    await db_session.flush()
    await ensure_rbac_seed(db_session)

    await suspend_user(
        db_session,
        user=user,
        admin=admin,
        reason_code="suspicious_activity",
        ip="127.0.0.1",
    )
    await db_session.flush()

    assert user.status == UserStatus.suspended

    with pytest.raises(AuthError) as exc:
        await login_with_email(
            db_session,
            email=user.email,
            password=password,
            turnstile_token=None,
            device_fingerprint="device-fingerprint-12345678",
            user_agent=None,
            ip="127.0.0.1",
        )
    assert exc.value.code == "contact_support"


@pytest.mark.asyncio
async def test_unsuspend_user_restores_active_status(db_session: AsyncSession) -> None:
    password = "Password1!"
    user = User(
        email=f"unsuspend-{uuid4()}@example.com",
        password_hash=hash_password(password),
        role=UserRole.user,
        status=UserStatus.suspended,
        suspended_at=_now(),
        suspension_reason_code="suspicious_activity",
    )
    admin = User(
        email=f"admin-{uuid4()}@example.com",
        password_hash=hash_password(password),
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add_all([user, admin])
    await db_session.flush()

    await unsuspend_user(db_session, user=user, admin=admin, ip="127.0.0.1")
    await db_session.flush()

    assert user.status == UserStatus.active
    assert user.suspended_at is None
    assert user.suspension_reason_code is None


@pytest.mark.asyncio
async def test_suspend_user_writes_audit_log(db_session: AsyncSession) -> None:
    password = "Password1!"
    user = User(
        email=f"audit-{uuid4()}@example.com",
        password_hash=hash_password(password),
        role=UserRole.user,
        status=UserStatus.active,
    )
    admin = User(
        email=f"admin-{uuid4()}@example.com",
        password_hash=hash_password(password),
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add_all([user, admin])
    await db_session.flush()

    await suspend_user(
        db_session,
        user=user,
        admin=admin,
        reason_code="compliance_hold",
        ip="127.0.0.1",
        notes="manual review",
    )
    await db_session.flush()

    logs = await db_session.execute(
        select(AuditLog).where(
            AuditLog.user_id == user.id,
            AuditLog.event_type == AuditEventType.account_suspended,
        )
    )
    assert logs.scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_hibp_blocks_pwned_password(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_is_password_pwned(_password: str) -> bool:
        return True

    monkeypatch.setattr(
        "app.infrastructure.security.hibp_service.is_password_pwned",
        fake_is_password_pwned,
    )

    with pytest.raises(PasswordPwnedError):
        await ensure_password_not_pwned("Password1!")


@pytest.mark.asyncio
async def test_otp_send_rate_limit(
    fake_redis: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.infrastructure.otp.service import OtpRateLimitError, generate_otp

    monkeypatch.setenv("OTP_SEND_LIMIT_PER_IDENTIFIER", "1")
    monkeypatch.setenv("OTP_SEND_WINDOW_SECONDS", "3600")
    get_settings.cache_clear()

    await generate_otp("email", "user@example.com", ip="127.0.0.1")
    with pytest.raises(OtpRateLimitError):
        await generate_otp("email", "user@example.com", ip="127.0.0.1")

    get_settings.cache_clear()


def test_timing_safe_dummy_hash_is_valid_bcrypt() -> None:
    assert verify_password(TIMING_SAFE_DUMMY_HASH, "__zynd_timing_safe_dummy__")
