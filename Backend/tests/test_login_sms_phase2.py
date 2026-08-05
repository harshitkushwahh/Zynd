from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.errors import AuthError
from app.application.auth.login_service import login_with_email
from app.application.auth.login_sms_service import (
    mask_phone,
    maybe_sms_otp_pending_login,
    resend_login_sms_otp,
    verify_sms_login,
)
from app.application.security.security_config_service import ensure_security_config_seed
from app.core.config import get_settings
from app.infrastructure.persistence.models import User, UserRole, UserStatus
from app.infrastructure.security.passwords import hash_password


def test_mask_phone_indian_number() -> None:
    assert mask_phone("9876543210", "IN") == "+91 •••• ••3210"


def test_mask_phone_with_country_prefix() -> None:
    assert mask_phone("+919876543210", "IN") == "+91 •••• ••3210"


@pytest.mark.asyncio
async def test_maybe_sms_otp_pending_login_returns_none_without_phone(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
) -> None:
    _ = fake_redis
    await ensure_security_config_seed(db_session)
    user = User(
        email=f"no-phone-{uuid4()}@example.com",
        password_hash=hash_password("password123"),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    result = await maybe_sms_otp_pending_login(
        db_session,
        user,
        device_fingerprint="device-fingerprint-test",
        user_agent="pytest",
        ip="127.0.0.1",
    )
    assert result is None


@pytest.mark.asyncio
async def test_maybe_sms_otp_pending_login_sends_code(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = fake_redis
    monkeypatch.setenv("DEV_OTP", "445566")
    get_settings.cache_clear()
    await ensure_security_config_seed(db_session)

    user = User(
        email=f"sms-login-{uuid4()}@example.com",
        password_hash=hash_password("password123"),
        phone="9876543210",
        role=UserRole.user,
        status=UserStatus.active,
        phone_verified_at=datetime.now(timezone.utc),
    )
    db_session.add(user)
    await db_session.flush()

    result = await maybe_sms_otp_pending_login(
        db_session,
        user,
        device_fingerprint="device-fingerprint-test",
        user_agent="pytest",
        ip="127.0.0.1",
    )
    assert result is not None
    assert result["next"] == "sms_otp_required"
    assert result["login_token"]
    assert "3210" in result["masked_phone"]


@pytest.mark.asyncio
async def test_verify_sms_login_completes_session(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = fake_redis
    monkeypatch.setenv("DEV_OTP", "778899")
    get_settings.cache_clear()
    await ensure_security_config_seed(db_session)

    user = User(
        email=f"sms-verify-{uuid4()}@example.com",
        password_hash=hash_password("password123"),
        phone="9123456789",
        role=UserRole.user,
        status=UserStatus.active,
        phone_verified_at=datetime.now(timezone.utc),
    )
    db_session.add(user)
    await db_session.flush()

    pending = await maybe_sms_otp_pending_login(
        db_session,
        user,
        device_fingerprint="device-fingerprint-test",
        user_agent="pytest",
        ip="127.0.0.1",
    )
    assert pending is not None

    result = await verify_sms_login(
        db_session,
        login_token=pending["login_token"],
        otp="778899",
        ip="127.0.0.1",
    )
    assert result["next"] == "authenticated"
    assert result["access_token"]
    assert result["refresh_token"]


@pytest.mark.asyncio
async def test_verify_sms_login_rejects_invalid_code(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = fake_redis
    monkeypatch.setenv("DEV_OTP", "778899")
    get_settings.cache_clear()
    await ensure_security_config_seed(db_session)

    user = User(
        email=f"sms-bad-{uuid4()}@example.com",
        password_hash=hash_password("password123"),
        phone="9123456780",
        role=UserRole.user,
        status=UserStatus.active,
        phone_verified_at=datetime.now(timezone.utc),
    )
    db_session.add(user)
    await db_session.flush()

    pending = await maybe_sms_otp_pending_login(
        db_session,
        user,
        device_fingerprint="device-fingerprint-test",
        user_agent="pytest",
        ip="127.0.0.1",
    )
    assert pending is not None

    with pytest.raises(AuthError) as exc:
        await verify_sms_login(
            db_session,
            login_token=pending["login_token"],
            otp="000000",
            ip="127.0.0.1",
        )
    assert exc.value.code == "invalid_otp"


@pytest.mark.asyncio
async def test_resend_login_sms_otp(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = fake_redis
    monkeypatch.setenv("DEV_OTP", "112233")
    get_settings.cache_clear()
    await ensure_security_config_seed(db_session)

    user = User(
        email=f"sms-resend-{uuid4()}@example.com",
        password_hash=hash_password("password123"),
        phone="9988776655",
        role=UserRole.user,
        status=UserStatus.active,
        phone_verified_at=datetime.now(timezone.utc),
    )
    db_session.add(user)
    await db_session.flush()

    pending = await maybe_sms_otp_pending_login(
        db_session,
        user,
        device_fingerprint="device-fingerprint-test",
        user_agent="pytest",
        ip="127.0.0.1",
    )
    assert pending is not None

    with pytest.raises(AuthError) as exc:
        await resend_login_sms_otp(
            db_session,
            login_token=pending["login_token"],
            ip="127.0.0.1",
        )
    assert exc.value.code == "otp_cooldown"
    assert exc.value.metadata["retry_after_seconds"] > 0


@pytest.mark.asyncio
async def test_login_with_email_returns_sms_otp_required(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = fake_redis
    monkeypatch.setenv("DEV_OTP", "556677")
    get_settings.cache_clear()
    await ensure_security_config_seed(db_session)

    password = "SecurePass123!"
    user = User(
        email=f"login-flow-{uuid4()}@example.com",
        password_hash=hash_password(password),
        phone="9876501234",
        role=UserRole.user,
        status=UserStatus.active,
        phone_verified_at=datetime.now(timezone.utc),
    )
    db_session.add(user)
    await db_session.flush()

    result = await login_with_email(
        db_session,
        email=user.email,
        password=password,
        turnstile_token=None,
        device_fingerprint="device-fingerprint-test",
        user_agent="pytest",
        ip="127.0.0.1",
    )
    assert result["next"] == "sms_otp_required"
    assert result["login_token"]
    assert "1234" in result["masked_phone"]
