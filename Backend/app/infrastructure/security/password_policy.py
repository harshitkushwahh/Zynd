from __future__ import annotations

import re

PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128


class PasswordStrengthError(ValueError):
    """Raised when a password fails complexity requirements."""


def validate_password_strength(password: str) -> None:
    if len(password) < PASSWORD_MIN_LENGTH:
        raise PasswordStrengthError("Password must be at least 8 characters.")
    if len(password) > PASSWORD_MAX_LENGTH:
        raise PasswordStrengthError("Password must be at most 128 characters.")
    if not re.search(r"[A-Z]", password):
        raise PasswordStrengthError("Password must include an uppercase letter.")
    if not re.search(r"[a-z]", password):
        raise PasswordStrengthError("Password must include a lowercase letter.")
    if not re.search(r"\d", password):
        raise PasswordStrengthError("Password must include a number.")
    if not re.search(r"[^A-Za-z0-9]", password):
        raise PasswordStrengthError("Password must include a special character.")
