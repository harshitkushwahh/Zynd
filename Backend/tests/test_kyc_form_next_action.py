from __future__ import annotations

from app.application.kyc.kyc_form_service import _build_next_action


class _Journey:
    geolocation_json = {"latitude": 12.97, "longitude": 77.59}
    readiness_code = "kyc_incomplete"
    kyc_already_registered = False
    poa_readiness_preverify_id = "pv_test"
    pan_draft_json = {"panNumber": "ABCDE1234F"}
    external_kyc_status = None
    external_identity_document_id = None


def test_build_next_action_submitted_when_provider_marks_submitted() -> None:
    form = {"status": "submitted"}
    action = _build_next_action(form, journey=_Journey())
    assert action["nextAction"] == "submitted"


def test_build_next_action_proof_redirect_without_digilocker_copy() -> None:
    form = {
        "status": "under_review",
        "signature_provided": True,
        "proof_details": {"status": "pending", "fetch_url": "https://proof.example/start"},
    }
    action = _build_next_action(form, journey=_Journey())
    assert action["nextAction"] == "proof_redirect"
    assert action["redirectUrl"] == "https://proof.example/start"


def test_build_next_action_skips_proof_redirect_when_path_a_complete() -> None:
    journey = _Journey()
    journey.external_kyc_status = "returned_success"  # type: ignore[attr-defined]
    journey.external_identity_document_id = "iddoc_1"  # type: ignore[attr-defined]
    journey.kyc_already_registered = False  # type: ignore[attr-defined]
    journey.readiness_code = "kyc_unavailable"  # type: ignore[attr-defined]
    journey.poa_readiness_preverify_id = None  # type: ignore[attr-defined]
    journey.pan_draft_json = {"panNumber": "ABCDE1234F"}  # type: ignore[attr-defined]
    form = {
        "status": "under_review",
        "signature_provided": True,
        "proof_details": {"status": "pending", "fetch_url": "https://proof.example/start"},
    }
    action = _build_next_action(form, journey=journey)
    assert action["nextAction"] != "proof_redirect"


def test_build_next_action_processing_while_under_review() -> None:
    form = {
        "status": "under_review",
        "proof_details": {"status": "fetched", "fetch_url": None},
    }
    action = _build_next_action(form, journey=_Journey())
    assert action["nextAction"] == "processing"


def test_build_next_action_esign_redirect() -> None:
    form = {
        "status": "awaiting_esign",
        "proof_details": {"status": "successful"},
        "esign_details": {"status": "pending", "esign_url": "https://esign.example/start"},
    }
    action = _build_next_action(form, journey=_Journey())
    assert action["nextAction"] == "esign_redirect"
    assert action["redirectUrl"] == "https://esign.example/start"
