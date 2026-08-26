from __future__ import annotations

import pytest

from app.infrastructure.security.password_policy import (
    PasswordStrengthError,
    validate_password_strength,
)


@pytest.mark.parametrize(
    ("password", "message"),
    [
        ("short1!", "Password must be at least 8 characters."),
        ("a" * 129 + "A1!", "Password must be at most 128 characters."),
        ("alllowercase1!", "Password must include an uppercase letter."),
        ("ALLUPPERCASE1!", "Password must include a lowercase letter."),
        ("NoNumbers!", "Password must include a number."),
        ("NoSpecial123", "Password must include a special character."),
    ],
)
def test_validate_password_strength_rejects_weak_passwords(
    password: str,
    message: str,
) -> None:
    with pytest.raises(PasswordStrengthError, match=message):
        validate_password_strength(password)


def test_validate_password_strength_accepts_strong_password() -> None:
    validate_password_strength("StrongPass123!")
