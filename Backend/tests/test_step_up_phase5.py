from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import pyotp
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.account_service import verify_step_up
from app.application.auth.errors import AuthError
from app.application.auth.mfa_service import confirm_mfa_enrollment, generate_totp_secret
from app.application.auth.step_up_service import get_step_up_sms_options, send_step_up_sms
from app.application.security.security_config_service import ensure_security_config_seed
from app.core.config import get_settings
from app.infrastructure.persistence.models import AuditEventType, AuditLog, User, UserRole, UserStatus
from app.infrastructure.security.passwords import hash_password


def _now() -> datetime:
    return datetime.now(timezone.utc)


@pytest.mark.asyncio
async def test_get_step_up_sms_options_requires_mfa_and_phone(
    db_session: AsyncSession,
) -> None:
    await ensure_security_config_seed(db_session)
    user = User(
        email=f"stepup-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
        phone="+919876543210",
        phone_verified_at=_now(),
        mfa_enrolled_at=_now(),
    )
    db_session.add(user)
    await db_session.flush()

    options = await get_step_up_sms_options(db_session, user)
    assert options["sms_fallback_available"] is True
    assert options["masked_phone"] is not None


@pytest.mark.asyncio
async def test_get_step_up_sms_options_unavailable_without_phone(
    db_session: AsyncSession,
) -> None:
    await ensure_security_config_seed(db_session)
    user = User(
        email=f"stepup-no-phone-{uuid4()}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
        mfa_enrolled_at=_now(),
    )
    db_session.add(user)
    await db_session.flush()

    options = await get_step_up_sms_options(db_session, user)
    assert options["sms_fallback_available"] is False


@pytest.mark.asyncio
async def test_verify_step_up_accepts_totp(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
) -> None:
    _ = fake_redis
    password = "Password1!"
    secret = generate_totp_secret()
    user = User(
        email=f"stepup-totp-{uuid4()}@example.com",
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

    result = await verify_step_up(
        db_session,
        user=user,
        session_id=session_id,
        current_password=password,
        totp_code=pyotp.TOTP(secret).now(),
        ip="127.0.0.1",
    )
    assert result["verified"] is True


@pytest.mark.asyncio
async def test_verify_step_up_accepts_sms_otp(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = fake_redis
    monkeypatch.setenv("DEV_OTP", "654321")
    get_settings.cache_clear()

    password = "Password1!"
    secret = generate_totp_secret()
    user = User(
        email=f"stepup-sms-{uuid4()}@example.com",
        password_hash=hash_password(password),
        role=UserRole.user,
        status=UserStatus.active,
        phone="+919876543210",
        phone_verified_at=_now(),
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

    await send_step_up_sms(db_session, user=user, ip="127.0.0.1")

    result = await verify_step_up(
        db_session,
        user=user,
        session_id=session_id,
        current_password=password,
        totp_code=None,
        sms_otp="654321",
        ip="127.0.0.1",
    )
    assert result["verified"] is True

    audit = await db_session.execute(
        select(AuditLog).where(
            AuditLog.user_id == user.id,
            AuditLog.event_type == AuditEventType.step_up_sms_used,
        )
    )
    assert audit.scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_verify_step_up_rejects_both_totp_and_sms(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
) -> None:
    _ = fake_redis
    password = "Password1!"
    secret = generate_totp_secret()
    user = User(
        email=f"stepup-both-{uuid4()}@example.com",
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

    with pytest.raises(AuthError) as exc:
        await verify_step_up(
            db_session,
            user=user,
            session_id=uuid4(),
            current_password=password,
            totp_code="123456",
            sms_otp="654321",
            ip="127.0.0.1",
        )
    assert exc.value.code == "invalid_second_factor_payload"
