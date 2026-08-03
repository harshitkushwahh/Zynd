from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.application.auth.account_service import kyc_eligibility_status
from app.infrastructure.persistence.models import User, UserRole, UserStatus


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


def test_kyc_eligibility_requires_verified_phone() -> None:
    user = User(
        email=f"kyc-phone-{uuid4()}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
        email_verified_at=datetime.now(timezone.utc),
        phone_verified_at=None,
    )
    result = kyc_eligibility_status(user)
    assert result["eligible"] is False
    assert "phone_not_verified" in result["reasons"]


def test_kyc_eligibility_ok_with_verified_contact() -> None:
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
