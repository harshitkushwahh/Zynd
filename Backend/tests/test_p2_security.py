from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.admin_action_service import (
    approve_admin_action_request,
    create_admin_action_request,
    reject_admin_action_request,
)
from app.application.admin.rbac_service import ensure_rbac_seed
from app.application.auth.progressive_lockout_service import (
    evaluate_progressive_lockout,
    peek_failure_count,
    record_failure_counters,
)
from app.application.auth.service import AuthError, login_with_email
from app.application.security.security_config_service import ensure_security_config_seed
from app.infrastructure.persistence.models import (
    AdminActionStatus,
    AdminActionType,
    User,
    UserRole,
    UserStatus,
)
from app.infrastructure.security.passwords import hash_password


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
async def test_maker_checker_requires_different_approver(db_session: AsyncSession) -> None:
    await ensure_rbac_seed(db_session)
    password = "Password1!"
    requester = User(
        email=f"requester-{uuid4()}@example.com",
        password_hash=hash_password(password),
        role=UserRole.admin,
        status=UserStatus.active,
    )
    target = User(
        email=f"target-{uuid4()}@example.com",
        password_hash=hash_password(password),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add_all([requester, target])
    await db_session.flush()

    action = await create_admin_action_request(
        db_session,
        action_type=AdminActionType.account_suspend,
        requester=requester,
        payload={"reason_code": "suspicious_activity"},
        target_type="user",
        target_id=target.id,
        ip="127.0.0.1",
    )

    with pytest.raises(ValueError, match="Maker-checker"):
        await approve_admin_action_request(
            db_session,
            action_id=action["id"],
            approver=requester,
            ip="127.0.0.1",
        )


@pytest.mark.asyncio
async def test_maker_checker_approve_suspend_executes_action(db_session: AsyncSession) -> None:
    await ensure_rbac_seed(db_session)
    password = "Password1!"
    requester = User(
        email=f"requester-{uuid4()}@example.com",
        password_hash=hash_password(password),
        role=UserRole.admin,
        status=UserStatus.active,
    )
    approver = User(
        email=f"approver-{uuid4()}@example.com",
        password_hash=hash_password(password),
        role=UserRole.admin,
        status=UserStatus.active,
    )
    target = User(
        email=f"target-{uuid4()}@example.com",
        password_hash=hash_password(password),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add_all([requester, approver, target])
    await db_session.flush()
    await ensure_rbac_seed(db_session)

    action = await create_admin_action_request(
        db_session,
        action_type=AdminActionType.account_suspend,
        requester=requester,
        payload={"reason_code": "suspicious_activity"},
        target_type="user",
        target_id=target.id,
        ip="127.0.0.1",
    )

    result = await approve_admin_action_request(
        db_session,
        action_id=action["id"],
        approver=approver,
        ip="127.0.0.1",
    )
    await db_session.flush()

    assert result["status"] == AdminActionStatus.approved.value
    assert target.status == UserStatus.suspended


@pytest.mark.asyncio
async def test_progressive_lockout_requires_captcha_after_threshold(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
) -> None:
    _ = fake_redis
    await ensure_security_config_seed(db_session)
    email = f"progressive-{uuid4()}@example.com"

    for _ in range(3):
        await record_failure_counters(email=email, ip="127.0.0.1")

    state = await evaluate_progressive_lockout(db_session, email=email, ip="127.0.0.1")
    assert state.captcha_required is False

    await record_failure_counters(email=email, ip="127.0.0.1")
    state = await evaluate_progressive_lockout(db_session, email=email, ip="127.0.0.1")
    assert state.captcha_required is True


@pytest.mark.asyncio
async def test_login_returns_captcha_required_metadata(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = fake_redis
    await ensure_security_config_seed(db_session)

    async def allow_turnstile(*_args, **_kwargs) -> bool:
        return True

    monkeypatch.setattr("app.application.auth.login_service.verify_turnstile", allow_turnstile)

    email = f"login-meta-{uuid4()}@example.com"
    user = User(
        email=email,
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    for _ in range(4):
        await record_failure_counters(email=email, ip="127.0.0.1")

    with pytest.raises(AuthError) as exc:
        await login_with_email(
            db_session,
            email=email,
            password="WrongPass1!",
            turnstile_token=None,
            device_fingerprint="device-fingerprint-12345678",
            user_agent=None,
            ip="127.0.0.1",
        )
    assert exc.value.metadata.get("captcha_required") is True


@pytest.mark.asyncio
async def test_security_config_seed_defaults(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
) -> None:
    _ = fake_redis
    await ensure_security_config_seed(db_session)
    from app.application.security.security_config_service import get_security_config_value

    assert await get_security_config_value(db_session, "lockout.max_attempts") == 8
