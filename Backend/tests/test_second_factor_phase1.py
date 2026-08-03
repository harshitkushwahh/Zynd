from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.errors import AuthError
from app.application.auth.fund_movement_policy_service import get_auth_security_policy
from app.application.auth.mfa_service import confirm_mfa_enrollment, generate_totp_secret
from app.application.auth.second_factor_verification_service import verify_second_factor
from app.application.identity.otp_app_service import request_otp, verify_otp
from app.application.identity.otp_purposes import OtpPurpose, get_purpose_definition
from app.application.security.security_config_service import (
    SECURITY_CONFIG_BOOLEAN_KEYS,
    get_fund_movement_policy,
    get_second_factor_policy,
    validate_security_config_value,
)
from app.core.config import get_settings
from app.infrastructure.persistence.models import User, UserRole, UserStatus


def test_new_otp_purposes_use_sms_channel() -> None:
    for purpose in (
        OtpPurpose.login_second_factor,
        OtpPurpose.step_up_sms,
        OtpPurpose.fund_confirmation,
    ):
        definition = get_purpose_definition(purpose)
        assert definition.channel == "sms"
        assert definition.storage_key == purpose.value


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("true", True),
        ("false", False),
        (True, True),
        (False, False),
    ],
)
def test_validate_security_config_boolean(raw: object, expected: bool) -> None:
    assert (
        validate_security_config_value("auth.login_sms_otp_when_mfa_disabled", raw) is expected
    )


def test_security_config_boolean_keys_seeded() -> None:
    assert "auth.login_sms_otp_when_mfa_disabled" in SECURITY_CONFIG_BOOLEAN_KEYS
    assert "fund.require_pin" in SECURITY_CONFIG_BOOLEAN_KEYS


@pytest.mark.asyncio
async def test_get_second_factor_policy_defaults(db_session: AsyncSession) -> None:
    from app.application.security.security_config_service import ensure_security_config_seed

    await ensure_security_config_seed(db_session)
    policy = await get_second_factor_policy(db_session)
    assert policy["login_sms_otp_when_mfa_disabled"] is True
    assert policy["step_up_sms_fallback_enabled"] is True


@pytest.mark.asyncio
async def test_get_auth_security_policy_combines_user_flags(db_session: AsyncSession) -> None:
    from app.application.security.security_config_service import ensure_security_config_seed

    await ensure_security_config_seed(db_session)
    user = User(
        email=f"policy-{uuid4()}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
        mfa_required_for_funds=True,
    )
    db_session.add(user)
    await db_session.flush()

    policy = await get_auth_security_policy(db_session, user)
    assert policy["fund_require_mfa"] is False
    assert policy["fund_require_pin"] is False
    assert policy["mfa_enrolled"] is False
    assert policy["pin_enrolled"] is False


@pytest.mark.asyncio
async def test_verify_second_factor_totp(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = fake_redis
    secret = generate_totp_secret()
    user = User(
        email=f"totp-{uuid4()}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    import pyotp

    await confirm_mfa_enrollment(
        db_session,
        user=user,
        secret=secret,
        totp_code=pyotp.TOTP(secret).now(),
    )
    code = pyotp.TOTP(secret).now()
    result = await verify_second_factor(db_session, user=user, totp_code=code)
    assert result.verified is True
    assert result.method == "totp"


@pytest.mark.asyncio
async def test_verify_second_factor_sms(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = fake_redis
    monkeypatch.setenv("DEV_OTP", "654321")
    get_settings.cache_clear()

    user = User(
        email=f"sms-{uuid4()}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
        phone_verified_at=datetime.now(timezone.utc),
    )
    db_session.add(user)
    await db_session.flush()

    await request_otp(OtpPurpose.login_second_factor, str(user.id), ip="127.0.0.1")
    result = await verify_second_factor(
        db_session,
        user=user,
        sms_otp="654321",
        sms_purpose=OtpPurpose.login_second_factor,
    )
    assert result.verified is True
    assert result.method == "sms"


@pytest.mark.asyncio
async def test_verify_second_factor_rejects_multiple_methods(db_session: AsyncSession) -> None:
    user = User(
        email=f"multi-{uuid4()}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
    )
    with pytest.raises(AuthError) as exc:
        await verify_second_factor(
            db_session,
            user=user,
            totp_code="123456",
            sms_otp="654321",
            sms_purpose=OtpPurpose.step_up_sms,
        )
    assert exc.value.code == "invalid_second_factor_payload"


@pytest.mark.asyncio
async def test_new_otp_purposes_send_and_verify(
    fake_redis: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = fake_redis
    monkeypatch.setenv("DEV_OTP", "112233")
    get_settings.cache_clear()

    user_id = str(uuid4())
    for purpose in (
        OtpPurpose.login_second_factor,
        OtpPurpose.step_up_sms,
        OtpPurpose.fund_confirmation,
    ):
        await request_otp(purpose, user_id, ip="127.0.0.1")
        assert await verify_otp(purpose, user_id, "112233") is True
