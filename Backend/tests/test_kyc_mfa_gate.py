from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.application.auth.account_service import kyc_eligibility_status
from app.infrastructure.persistence.models import User, UserRole, UserStatus


def test_kyc_eligibility_requires_mfa_when_configured() -> None:
    user = User(
        email=f"kyc-mfa-{uuid4()}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
        mfa_required_for_funds=True,
        email_verified_at=datetime.now(timezone.utc),
        phone_verified_at=datetime.now(timezone.utc),
        pin_set_at=datetime.now(timezone.utc),
        pin_hash="hash",
    )
    result = kyc_eligibility_status(user)
    assert result["eligible"] is False
    assert "mfa_required" in result["reasons"]


def test_kyc_eligibility_ok_with_all_gates() -> None:
    now = datetime.now(timezone.utc)
    user = User(
        email=f"kyc-mfa-ok-{uuid4()}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
        mfa_required_for_funds=True,
        email_verified_at=now,
        phone_verified_at=now,
        mfa_enrolled_at=now,
        pin_set_at=now,
        pin_hash="hash",
    )
    result = kyc_eligibility_status(user)
    assert result["eligible"] is True
    assert result["reasons"] == []


def test_kyc_eligibility_requires_pin_when_mfa_present() -> None:
    now = datetime.now(timezone.utc)
    user = User(
        email=f"kyc-no-pin-{uuid4()}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
        mfa_required_for_funds=True,
        email_verified_at=now,
        phone_verified_at=now,
        mfa_enrolled_at=now,
    )
    result = kyc_eligibility_status(user)
    assert result["eligible"] is False
    assert "pin_required" in result["reasons"]
