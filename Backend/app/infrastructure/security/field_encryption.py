from __future__ import annotations

import base64
import hashlib
from enum import Enum

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings
from app.infrastructure.security.secrets_provider import get_secrets_provider


class PIIFieldType(str, Enum):
    mfa_totp = "mfa_totp"
    pan = "pan"
    aadhaar = "aadhaar"
    bank_account = "bank_account"


def _purpose_for_field(field_type: PIIFieldType) -> str:
    if field_type == PIIFieldType.mfa_totp:
        return "mfa_totp"
    return "pii"


def _fernet_for(purpose: str, version: int) -> Fernet:
    provider = get_secrets_provider()
    raw_key = provider.get_encryption_key(purpose, version)
    digest = hashlib.sha256(raw_key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def current_key_version(field_type: PIIFieldType) -> int:
    settings = get_settings()
    if field_type == PIIFieldType.mfa_totp:
        return settings.current_mfa_key_version
    return settings.current_pii_key_version


def encrypt_field(plaintext: str, field_type: PIIFieldType, key_version: int | None = None) -> tuple[str, int]:
    version = key_version or current_key_version(field_type)
    purpose = _purpose_for_field(field_type)
    ciphertext = _fernet_for(purpose, version).encrypt(plaintext.encode()).decode()
    return ciphertext, version


def decrypt_field(ciphertext: str, field_type: PIIFieldType, key_version: int) -> str:
    purpose = _purpose_for_field(field_type)
    try:
        return _fernet_for(purpose, key_version).decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise ValueError(f"Invalid ciphertext for field type {field_type.value}") from exc
