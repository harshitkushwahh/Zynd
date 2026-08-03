from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.fund_movement_policy_service import (
    evaluate_fund_eligibility,
    evaluate_fund_eligibility_with_policy,
    resolve_fund_eligibility_next_action,
)
from app.application.security.security_config_service import (
    apply_security_config_update,
    ensure_security_config_seed,
    invalidate_security_config_cache,
)
from app.infrastructure.persistence.models import User, UserRole, UserStatus


def _user(**kwargs) -> User:
    now = datetime.now(timezone.utc)
    user = User(
        email=f"fund-{uuid4()}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
        country_code="IN",
        email_verified_at=now,
        phone_verified_at=now,
        phone="9876543210",
    )
    for key, value in kwargs.items():
        setattr(user, key, value)
    return user


def test_resolve_fund_eligibility_next_action_priority() -> None:
    assert resolve_fund_eligibility_next_action(["email_verification_required"]) == "verify_email"
    assert resolve_fund_eligibility_next_action(["phone_verification_required"]) == "verify_phone"
    assert resolve_fund_eligibility_next_action(["mfa_required", "pin_required"]) == "setup_mfa"
    assert resolve_fund_eligibility_next_action(["pin_required"]) == "setup_pin"
    assert resolve_fund_eligibility_next_action([]) is None


def test_evaluate_fund_eligibility_requires_verified_email() -> None:
    user = _user(email_verified_at=None)
    result = evaluate_fund_eligibility_with_policy(user, require_mfa=False, require_pin=False)
    assert result["eligible"] is False
    assert result["reasons"] == ["email_verification_required"]
    assert result["next_action"] == "verify_email"


def test_evaluate_fund_eligibility_requires_verified_phone() -> None:
    user = _user(phone_verified_at=None, phone=None)
    result = evaluate_fund_eligibility_with_policy(user, require_mfa=False, require_pin=False)
    assert result["eligible"] is False
    assert result["reasons"] == ["phone_verification_required"]
    assert result["next_action"] == "verify_phone"


def test_evaluate_fund_eligibility_requires_mfa_when_policy_enabled() -> None:
    user = _user(mfa_required_for_funds=True)
    result = evaluate_fund_eligibility_with_policy(user, require_mfa=True, require_pin=False)
    assert result["eligible"] is False
    assert result["reasons"] == ["mfa_required"]
    assert result["next_action"] == "setup_mfa"
    assert result["mfa_enrolled"] is False


def test_evaluate_fund_eligibility_skips_mfa_when_global_policy_disabled() -> None:
    user = _user(mfa_required_for_funds=True)
    result = evaluate_fund_eligibility_with_policy(user, require_mfa=False, require_pin=False)
    assert result["eligible"] is True
    assert result["reasons"] == []


def test_evaluate_fund_eligibility_requires_pin_after_mfa() -> None:
    now = datetime.now(timezone.utc)
    user = _user(
        mfa_required_for_funds=True,
        mfa_enrolled_at=now,
        pin_hash=None,
    )
    result = evaluate_fund_eligibility_with_policy(user, require_mfa=True, require_pin=True)
    assert result["eligible"] is False
    assert result["reasons"] == ["pin_required"]
    assert result["next_action"] == "setup_pin"
    assert result["pin_enrolled"] is False


def test_evaluate_fund_eligibility_skips_pin_when_global_policy_disabled() -> None:
    now = datetime.now(timezone.utc)
    user = _user(
        mfa_required_for_funds=True,
        mfa_enrolled_at=now,
        pin_hash=None,
    )
    result = evaluate_fund_eligibility_with_policy(user, require_mfa=True, require_pin=False)
    assert result["eligible"] is True
    assert result["reasons"] == []


def test_evaluate_fund_eligibility_ok_with_contact_verified() -> None:
    user = _user()
    result = evaluate_fund_eligibility_with_policy(user, require_mfa=False, require_pin=False)
    assert result["eligible"] is True
    assert result["next_action"] is None
    assert result["email_verified"] is True
    assert result["phone_verified"] is True


@pytest.mark.asyncio
async def test_evaluate_fund_eligibility_uses_global_policy(db_session: AsyncSession) -> None:
    await ensure_security_config_seed(db_session)
    actor = User(
        email=f"admin-{uuid4()}@example.com",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(actor)
    await db_session.flush()

    try:
        await apply_security_config_update(
            db_session,
            key="fund.require_mfa",
            value=False,
            changed_by=actor.id,
            reason="phase4 test",
        )
        await apply_security_config_update(
            db_session,
            key="fund.require_pin",
            value=False,
            changed_by=actor.id,
            reason="phase4 test",
        )
        await invalidate_security_config_cache()

        user = _user(mfa_required_for_funds=True)
        db_session.add(user)
        await db_session.flush()

        result = await evaluate_fund_eligibility(db_session, user)
        assert result["eligible"] is True
        assert result["reasons"] == []
    finally:
        await apply_security_config_update(
            db_session,
            key="fund.require_mfa",
            value=False,
            changed_by=actor.id,
            reason="phase4 test cleanup",
        )
        await apply_security_config_update(
            db_session,
            key="fund.require_pin",
            value=False,
            changed_by=actor.id,
            reason="phase4 test cleanup",
        )
        await invalidate_security_config_cache()
