from __future__ import annotations

from app.infrastructure.kyc.kyc_forms_client import should_poll_kyc_form_for_esign


def test_no_esign_poll_while_poa_proof_pending() -> None:
    form = {
        "status": "created",
        "signature_provided": True,
        "proof_details": {"status": "pending", "fetch_url": "https://example/proof"},
    }
    assert should_poll_kyc_form_for_esign(form) is False


def test_esign_poll_when_poa_proof_fetched() -> None:
    form = {
        "status": "created",
        "proof_details": {"status": "fetched"},
        "esign_details": {"status": "pending"},
    }
    assert should_poll_kyc_form_for_esign(form) is True


def test_no_poll_when_esign_url_already_present() -> None:
    form = {
        "status": "awaiting_esign",
        "proof_details": {"status": "successful"},
        "esign_details": {"esign_url": "https://example/esign"},
    }
    assert should_poll_kyc_form_for_esign(form) is False
