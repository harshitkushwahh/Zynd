from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import pytest

from app.application.kyc.eligibility import kyc_eligibility_status
from app.infrastructure.persistence.models import User, UserRole, UserStatus


def _user(**overrides) -> User:
    user = User(
        email=f"kyc-{uuid4()}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
        mfa_required_for_funds=True,
    )
    for key, value in overrides.items():
        setattr(user, key, value)
    return user


def test_kyc_eligibility_requires_email_phone_mfa_and_pin() -> None:
    result = kyc_eligibility_status(_user())
    assert result["eligible"] is False
    assert "email_not_verified" in result["reasons"]
    assert "phone_not_verified" in result["reasons"]
    assert "mfa_required" in result["reasons"]
    assert "pin_required" in result["reasons"]


def test_kyc_eligibility_ok_when_all_gates_met() -> None:
    now = datetime.now(timezone.utc)
    user = _user(
        email_verified_at=now,
        phone_verified_at=now,
        mfa_enrolled_at=now,
        pin_set_at=now,
        pin_hash="hash",
    )
    result = kyc_eligibility_status(user)
    assert result["eligible"] is True
    assert result["reasons"] == []
