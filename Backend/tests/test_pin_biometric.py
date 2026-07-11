from __future__ import annotations

from app.application.auth.pin_biometric_service import _decode_credential_id, _encode_credential_id


def test_credential_id_roundtrip() -> None:
    raw = b"\x01\x02test-credential-id-bytes"
    encoded = _encode_credential_id(raw)
    assert _decode_credential_id(encoded) == raw
