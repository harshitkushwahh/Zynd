from __future__ import annotations

import json
from typing import Any

from app.application.kyc.zto.constants import LOOKUP_KIND_BANK
from app.infrastructure.security.field_encryption import PIIFieldType, decrypt_field, encrypt_field


def _field_type(kind: str) -> PIIFieldType:
    return PIIFieldType.bank_account if kind == LOOKUP_KIND_BANK else PIIFieldType.pan


def encrypt_lookup_payload(kind: str, payload: dict[str, Any]) -> tuple[str, int]:
    return encrypt_field(json.dumps(payload, separators=(",", ":"), default=str), _field_type(kind))


def decrypt_lookup_payload(kind: str, ciphertext: str, key_version: int) -> dict[str, Any]:
    raw = decrypt_field(ciphertext, _field_type(kind), key_version)
    parsed = json.loads(raw)
    return parsed if isinstance(parsed, dict) else {}
