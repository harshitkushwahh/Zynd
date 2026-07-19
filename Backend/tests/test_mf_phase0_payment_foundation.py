from __future__ import annotations

import hashlib
import hmac

from app.application.mf.mf_webhook_service import verify_fp_webhook_signature


def test_verify_fp_webhook_signature_valid() -> None:
    secret = "test-secret"
    body = b'{"id":"evt_1","type":"mf_purchase.created"}'
    signature = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    header = f"ntwhsc_test:{signature}"
    assert verify_fp_webhook_signature(raw_body=body, signature_header=header, secret=secret)


def test_verify_fp_webhook_signature_invalid() -> None:
    body = b'{"id":"evt_1","type":"mf_purchase.created"}'
    assert not verify_fp_webhook_signature(
        raw_body=body,
        signature_header="ntwhsc_test:bad",
        secret="test-secret",
    )
