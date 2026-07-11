from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.application.auth.account_service import fund_eligibility_status
from app.application.auth.mfa_service import user_fund_eligible
from app.infrastructure.persistence.models import User, UserRole, UserStatus
from app.infrastructure.security.apple_oauth import is_apple_private_relay_email


def _user(**overrides) -> User:
    user = User(
        email="user@example.com",
        password_hash="hash",
        role=UserRole.user,
    )
    user.status = UserStatus.active
    user.mfa_required_for_funds = True
    user.mfa_enrolled_at = None
    for key, value in overrides.items():
        setattr(user, key, value)
    return user


@pytest.mark.parametrize(
    ("email", "expected"),
    [
        ("abc@privaterelay.appleid.com", True),
        ("ABC@PrivateRelay.AppleID.com", True),
        ("user@gmail.com", False),
        (None, False),
        ("", False),
    ],
)
def test_is_apple_private_relay_email(email: str | None, expected: bool) -> None:
    assert is_apple_private_relay_email(email) is expected


def test_fund_eligibility_blocks_relay_email_without_phone() -> None:
    user = _user(
        email="abc@privaterelay.appleid.com",
        mfa_enrolled_at=datetime.now(timezone.utc),
        phone_verified_at=None,
    )
    status = fund_eligibility_status(user)
    assert status["eligible"] is False
    assert "verified_contact_required" in status["reasons"]


def test_fund_eligibility_allows_relay_email_with_verified_phone() -> None:
    user = _user(
        email="abc@privaterelay.appleid.com",
        mfa_enrolled_at=datetime.now(timezone.utc),
        phone_verified_at=datetime.now(timezone.utc),
    )
    status = fund_eligibility_status(user)
    assert status["eligible"] is True


def test_user_fund_eligible_honors_relay_contact_requirement() -> None:
    user = _user(
        email="abc@privaterelay.appleid.com",
        mfa_enrolled_at=datetime.now(timezone.utc),
        phone_verified_at=None,
    )
    assert user_fund_eligible(user) is False
