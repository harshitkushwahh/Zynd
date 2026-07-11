from __future__ import annotations

from app.infrastructure.security.field_encryption import (
    PIIFieldType,
    current_key_version,
    decrypt_field,
    encrypt_field,
)


def encrypt_secret(plaintext: str, key_version: int | None = None) -> tuple[str, int]:
    return encrypt_field(plaintext, PIIFieldType.mfa_totp, key_version=key_version)


def decrypt_secret(ciphertext: str, key_version: int) -> str:
    return decrypt_field(ciphertext, PIIFieldType.mfa_totp, key_version=key_version)


def current_mfa_key_version() -> int:
    return current_key_version(PIIFieldType.mfa_totp)
