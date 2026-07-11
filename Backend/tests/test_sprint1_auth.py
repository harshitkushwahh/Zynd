from __future__ import annotations

from datetime import datetime, timezone

import pyotp
import pytest

from app.application.auth.mfa_service import (
    build_provisioning_uri,
    generate_totp_secret,
    user_fund_eligible,
    user_has_mfa,
    verify_totp_code,
)
from app.infrastructure.persistence.models import User, UserRole, UserStatus
from app.infrastructure.security.mfa_crypto import decrypt_secret, encrypt_secret


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


def test_mfa_crypto_roundtrip() -> None:
    secret = "JBSWY3DPEHPK3PXP"
    ciphertext, key_version = encrypt_secret(secret)
    assert decrypt_secret(ciphertext, key_version) == secret


def test_totp_generate_and_verify() -> None:
    secret = generate_totp_secret()
    code = pyotp.TOTP(secret).now()
    assert verify_totp_code(secret, code)


def test_provisioning_uri_contains_email() -> None:
    secret = generate_totp_secret()
    uri = build_provisioning_uri(secret, "user@example.com")
    assert "user%40example.com" in uri or "user@example.com" in uri
    assert "issuer=ZYND" in uri


def test_user_has_mfa() -> None:
    assert not user_has_mfa(_user())
    assert user_has_mfa(_user(mfa_enrolled_at=datetime.now(timezone.utc)))


@pytest.mark.parametrize(
    ("status", "mfa_enrolled", "required", "expected"),
    [
        (UserStatus.active, True, True, True),
        (UserStatus.active, False, True, False),
        (UserStatus.active, False, False, True),
        (UserStatus.deletion_pending, True, True, False),
        (UserStatus.suspended, True, True, False),
    ],
)
def test_user_fund_eligible(
    status: UserStatus,
    mfa_enrolled: bool,
    required: bool,
    expected: bool,
) -> None:
    user = _user(
        status=status,
        mfa_required_for_funds=required,
        mfa_enrolled_at=datetime.now(timezone.utc) if mfa_enrolled else None,
    )
    assert user_fund_eligible(user) is expected
