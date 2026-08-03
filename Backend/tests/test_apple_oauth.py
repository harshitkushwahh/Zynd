from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.application.auth.account_service import fund_eligibility_status, kyc_eligibility_status
from app.application.auth.mfa_service import user_fund_eligible
from app.infrastructure.persistence.models import User, UserRole, UserStatus


def _user(**overrides) -> User:
    now = datetime.now(timezone.utc)
    user = User(
        email="user@example.com",
        password_hash="hash",
        role=UserRole.user,
        phone="9876543210",
    )
    user.status = UserStatus.active
    user.mfa_required_for_funds = True
    user.mfa_enrolled_at = None
    user.email_verified_at = now
    user.phone_verified_at = now
    for key, value in overrides.items():
        setattr(user, key, value)
    return user


def test_fund_eligibility_blocks_unverified_phone() -> None:
    user = _user(
        email="abc@privaterelay.appleid.com",
        mfa_enrolled_at=datetime.now(timezone.utc),
        phone_verified_at=None,
        phone=None,
    )
    status = fund_eligibility_status(user)
    assert status["eligible"] is False
    assert "phone_verification_required" in status["reasons"]


def test_fund_eligibility_allows_verified_contact_without_mfa() -> None:
    user = _user(
        email="abc@privaterelay.appleid.com",
        mfa_enrolled_at=None,
        mfa_required_for_funds=True,
    )
    status = fund_eligibility_status(user)
    assert status["eligible"] is True


def test_user_fund_eligible_requires_verified_phone() -> None:
    user = _user(
        email="abc@privaterelay.appleid.com",
        mfa_enrolled_at=datetime.now(timezone.utc),
        phone_verified_at=None,
        phone=None,
    )
    assert user_fund_eligible(user) is False


def test_kyc_eligibility_requires_verified_email() -> None:
    user = User(
        email=f"kyc-email-{uuid4()}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
        email_verified_at=None,
        phone_verified_at=datetime.now(timezone.utc),
    )
    result = kyc_eligibility_status(user)
    assert result["eligible"] is False
    assert "email_not_verified" in result["reasons"]


def test_kyc_eligibility_ok_with_verified_contact_only() -> None:
    now = datetime.now(timezone.utc)
    user = User(
        email=f"kyc-ok-{uuid4()}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
        email_verified_at=now,
        phone_verified_at=now,
    )
    result = kyc_eligibility_status(user)
    assert result["eligible"] is True
    assert result["reasons"] == []
