from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.application.auth.account_service import fund_eligibility_status
from app.application.auth.errors import AuthError
from app.application.auth.fund_movement_policy_service import evaluate_fund_eligibility_with_policy
from app.application.auth.pin_service import validate_pin_format
from app.infrastructure.persistence.models import User, UserRole, UserStatus


def _user(**kwargs) -> User:
    now = datetime.now(timezone.utc)
    user = User(
        email="user@example.com",
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


def test_validate_pin_format_rejects_non_digits() -> None:
    with pytest.raises(AuthError) as exc:
        validate_pin_format("12ab")
    assert exc.value.code == "invalid_pin_format"


def test_validate_pin_format_rejects_weak_pin() -> None:
    with pytest.raises(AuthError) as exc:
        validate_pin_format("1234")
    assert exc.value.code == "weak_pin"


def test_fund_eligibility_requires_pin_after_mfa_when_policy_enabled() -> None:
    user = _user(
        mfa_enrolled_at=datetime.now(timezone.utc),
        mfa_required_for_funds=True,
        pin_hash=None,
    )
    result = evaluate_fund_eligibility_with_policy(user, require_mfa=True, require_pin=True)
    assert result["eligible"] is False
    assert "pin_required" in result["reasons"]


def test_fund_eligibility_ok_without_mfa_or_pin() -> None:
    user = _user(
        mfa_enrolled_at=None,
        mfa_required_for_funds=True,
        pin_hash=None,
    )
    result = fund_eligibility_status(user)
    assert result["eligible"] is True
