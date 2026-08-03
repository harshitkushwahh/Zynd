from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.user_security_summary_service import (
    build_admin_security_summary,
    get_user_last_login_summary,
)
from app.application.auth.errors import AuthError
from app.application.auth.login_service import login_with_email
from app.application.auth.risk_scoring_service import LoginRiskAssessment
from app.application.security.security_config_service import ensure_security_config_seed
from app.infrastructure.persistence.models import (
    AuditEventType,
    AuditLog,
    User,
    UserRole,
    UserStatus,
)
from app.infrastructure.security.passwords import hash_password


@pytest.mark.asyncio
async def test_get_user_last_login_summary_from_sms_audit(db_session: AsyncSession) -> None:
    user = User(
        email=f"last-login-{uuid4()}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()
    db_session.add(
        AuditLog(
            user_id=user.id,
            event_type=AuditEventType.login_sms_otp_verified,
            ip_address="127.0.0.1",
            metadata_={},
        )
    )
    await db_session.flush()

    summary = await get_user_last_login_summary(db_session, user.id)
    assert summary["last_login_method"] == "sms"
    assert summary["last_login_at"] is not None


def test_build_admin_security_summary_includes_pin_and_phone() -> None:
    now = datetime.now(timezone.utc)
    user = User(
        email="user@example.com",
        role=UserRole.user,
        status=UserStatus.active,
        email_verified_at=now,
        mfa_enrolled_at=now,
        pin_hash="hash",
        phone="9876543210",
        phone_verified_at=now,
        mfa_required_for_funds=True,
    )
    summary = build_admin_security_summary(
        user,
        {"last_login_at": now, "last_login_method": "authenticator"},
    )
    assert summary["pin_enrolled"] is True
    assert summary["phone_verified"] is True
    assert summary["fund_movement_eligible"] is True
    assert summary["last_login_method"] == "authenticator"


@pytest.mark.asyncio
async def test_adaptive_auth_blocks_when_force_mfa_without_second_factor(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = fake_redis
    await ensure_security_config_seed(db_session)

    async def force_step_up(*_args, **_kwargs):
        return LoginRiskAssessment(level="medium", action="step_up_mfa", score=55, reasons=["new_device"])

    async def allow_turnstile(*_args, **_kwargs) -> bool:
        return True

    monkeypatch.setattr("app.application.auth.login_service.assess_login_risk", force_step_up)
    monkeypatch.setattr("app.application.auth.login_service.verify_turnstile", allow_turnstile)

    password = "Password1!"
    user = User(
        email=f"adaptive-{uuid4()}@example.com",
        password_hash=hash_password(password),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

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
    assert exc.value.code == "step_up_required"
