from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings
from app.infrastructure.security.secrets_provider import get_secrets_provider

_ENCRYPTED_PREFIX = b"ZYNDDOC1:"


def _fernet_for_version(version: int) -> Fernet:
    provider = get_secrets_provider()
    raw_key = provider.get_encryption_key("pii", version)
    digest = hashlib.sha256(raw_key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_document_blob(content: bytes, key_version: int | None = None) -> bytes:
    settings = get_settings()
    version = key_version or settings.current_pii_key_version
    ciphertext = _fernet_for_version(version).encrypt(content)
    return _ENCRYPTED_PREFIX + ciphertext


def decrypt_document_blob(content: bytes) -> bytes:
    if not content.startswith(_ENCRYPTED_PREFIX):
        return content

    ciphertext = content[len(_ENCRYPTED_PREFIX) :]
    settings = get_settings()
    versions = sorted(settings.resolved_pii_encryption_keys, reverse=True)
    last_error: InvalidToken | None = None
    for version in versions:
        try:
            return _fernet_for_version(version).decrypt(ciphertext)
        except InvalidToken as exc:
            last_error = exc
    if last_error is not None:
        raise ValueError("Unable to decrypt document blob.") from last_error
    raise ValueError("No PII encryption keys configured.")
