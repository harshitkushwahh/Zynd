from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import pyotp
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.account_service import verify_mfa_login
from app.application.auth.auth_session_context import maybe_mfa_pending_login
from app.application.auth.errors import AuthError
from app.application.auth.login_sms_service import enrich_mfa_login_pending, send_mfa_login_sms
from app.application.auth.mfa_service import confirm_mfa_enrollment, generate_totp_secret
from app.application.security.security_config_service import ensure_security_config_seed
from app.core.config import get_settings
from app.infrastructure.persistence.models import User, UserRole, UserStatus
from app.infrastructure.security.passwords import hash_password


@pytest.mark.asyncio
async def test_enrich_mfa_login_pending_includes_sms_fallback(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
) -> None:
    _ = fake_redis
    await ensure_security_config_seed(db_session)
    user = User(
        email=f"mfa-enrich-{uuid4()}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
        phone="9876543210",
        phone_verified_at=datetime.now(timezone.utc),
        mfa_enrolled_at=datetime.now(timezone.utc),
    )
    db_session.add(user)
    await db_session.flush()

    pending = await maybe_mfa_pending_login(
        user,
        device_fingerprint="device-fingerprint-test",
        user_agent="pytest",
    )
    enriched = await enrich_mfa_login_pending(db_session, user, pending)
    assert enriched["sms_fallback_available"] is True
    assert "3210" in enriched["masked_phone"]


@pytest.mark.asyncio
async def test_send_mfa_login_sms(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = fake_redis
    monkeypatch.setenv("DEV_OTP", "334455")
    get_settings.cache_clear()
    await ensure_security_config_seed(db_session)

    secret = generate_totp_secret()
    user = User(
        email=f"mfa-sms-send-{uuid4()}@example.com",
        password_hash=hash_password("password123"),
        phone="9123456789",
        role=UserRole.user,
        status=UserStatus.active,
        phone_verified_at=datetime.now(timezone.utc),
    )
    db_session.add(user)
    await db_session.flush()
    await confirm_mfa_enrollment(
        db_session,
        user=user,
        secret=secret,
        totp_code=pyotp.TOTP(secret).now(),
    )

    pending = await maybe_mfa_pending_login(
        user,
        device_fingerprint="device-fingerprint-test",
        user_agent="pytest",
    )
    result = await send_mfa_login_sms(
        db_session,
        mfa_token=pending["mfa_token"],
        ip="127.0.0.1",
    )
    assert result["retry_after_seconds"] >= 30
    assert "6789" in result["masked_phone"]


@pytest.mark.asyncio
async def test_verify_mfa_login_accepts_sms_otp(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = fake_redis
    monkeypatch.setenv("DEV_OTP", "667788")
    get_settings.cache_clear()
    await ensure_security_config_seed(db_session)

    secret = generate_totp_secret()
    user = User(
        email=f"mfa-sms-verify-{uuid4()}@example.com",
        password_hash=hash_password("password123"),
        phone="9988776655",
        role=UserRole.user,
        status=UserStatus.active,
        phone_verified_at=datetime.now(timezone.utc),
    )
    db_session.add(user)
    await db_session.flush()
    await confirm_mfa_enrollment(
        db_session,
        user=user,
        secret=secret,
        totp_code=pyotp.TOTP(secret).now(),
    )

    pending = await maybe_mfa_pending_login(
        user,
        device_fingerprint="device-fingerprint-test",
        user_agent="pytest",
    )
    await send_mfa_login_sms(
        db_session,
        mfa_token=pending["mfa_token"],
        ip="127.0.0.1",
    )

    result = await verify_mfa_login(
        db_session,
        mfa_token=pending["mfa_token"],
        totp_code=None,
        backup_code=None,
        sms_otp="667788",
        ip="127.0.0.1",
    )
    assert result["next"] == "authenticated"
    assert result["access_token"]


@pytest.mark.asyncio
async def test_verify_mfa_login_still_accepts_totp(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
) -> None:
    _ = fake_redis
    await ensure_security_config_seed(db_session)

    secret = generate_totp_secret()
    user = User(
        email=f"mfa-totp-{uuid4()}@example.com",
        password_hash=hash_password("password123"),
        phone="9876501234",
        role=UserRole.user,
        status=UserStatus.active,
        phone_verified_at=datetime.now(timezone.utc),
    )
    db_session.add(user)
    await db_session.flush()
    await confirm_mfa_enrollment(
        db_session,
        user=user,
        secret=secret,
        totp_code=pyotp.TOTP(secret).now(),
    )

    pending = await maybe_mfa_pending_login(
        user,
        device_fingerprint="device-fingerprint-test",
        user_agent="pytest",
    )
    totp_code = pyotp.TOTP(secret).now()
    result = await verify_mfa_login(
        db_session,
        mfa_token=pending["mfa_token"],
        totp_code=totp_code,
        backup_code=None,
        sms_otp=None,
        ip="127.0.0.1",
    )
    assert result["next"] == "authenticated"


@pytest.mark.asyncio
async def test_send_mfa_login_sms_respects_send_limit(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = fake_redis
    monkeypatch.setenv("DEV_OTP", "112233")
    get_settings.cache_clear()
    await ensure_security_config_seed(db_session)

    secret = generate_totp_secret()
    user = User(
        email=f"mfa-limit-{uuid4()}@example.com",
        password_hash=hash_password("password123"),
        phone="9111222333",
        role=UserRole.user,
        status=UserStatus.active,
        phone_verified_at=datetime.now(timezone.utc),
    )
    db_session.add(user)
    await db_session.flush()
    await confirm_mfa_enrollment(
        db_session,
        user=user,
        secret=secret,
        totp_code=pyotp.TOTP(secret).now(),
    )

    pending = await maybe_mfa_pending_login(
        user,
        device_fingerprint="device-fingerprint-test",
        user_agent="pytest",
    )
    token = pending["mfa_token"]
    settings = get_settings()
    from app.application.auth.login_sms_service import (
        MFA_LOGIN_SMS_MAX_SENDS,
        _record_mfa_login_sms_send,
    )

    for _ in range(MFA_LOGIN_SMS_MAX_SENDS):
        await _record_mfa_login_sms_send(token, settings.mfa_pending_ttl_seconds)

    with pytest.raises(AuthError) as exc:
        await send_mfa_login_sms(db_session, mfa_token=token, ip="127.0.0.1")
    assert exc.value.code == "sms_send_limit"
