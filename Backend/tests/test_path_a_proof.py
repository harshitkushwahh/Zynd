from __future__ import annotations

from types import SimpleNamespace

from app.application.kyc.kyc_form_service import _build_next_action
from app.application.kyc.path_a_proof import (
    path_a_digilocker_proof_satisfied,
    poa_partner_proof_satisfied,
    requires_poa_kyc_form_proof_fetch,
    user_poa_proof_redirect_required,
)
from app.application.kyc.poa_kyc_form_service import _needs_poa_proof_redirect


def _fresh_kyc_journey(**overrides: object) -> SimpleNamespace:
    base = {
        "external_kyc_status": None,
        "external_identity_document_id": None,
        "kyc_already_registered": False,
        "readiness_code": "fresh",
        "poa_readiness_preverify_id": None,
        "pan_draft_json": {"panNumber": "ABCDE1234F"},
        "proof_details_status": "pending",
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def test_path_a_satisfied_when_finprim_iddoc_success() -> None:
    journey = SimpleNamespace(
        external_kyc_status="returned_success",
        external_identity_document_id="iddoc_abc",
    )
    assert path_a_digilocker_proof_satisfied(journey) is True


def test_path_a_not_satisfied_by_manual_contact_draft_alone() -> None:
    journey = SimpleNamespace(
        external_kyc_status="started",
        external_identity_document_id="iddoc_abc",
        contact_draft_json={"permanent": {"line1": "Manual"}},
    )
    assert path_a_digilocker_proof_satisfied(journey) is False


def test_poa_partner_proof_not_satisfied_by_path_a_alone() -> None:
    journey = SimpleNamespace(
        external_kyc_status="returned_success",
        external_identity_document_id="iddoc_abc",
    )
    form = {"proof_details": {"status": "pending", "fetch_url": "https://proof.example"}}
    assert poa_partner_proof_satisfied(form, journey) is False


def test_fresh_kyc_skips_user_poa_proof_redirect_after_path_a() -> None:
    journey = _fresh_kyc_journey(
        external_kyc_status="returned_success",
        external_identity_document_id="iddoc_abc",
        proof_details_status="pending",
    )
    form = {"proof_details": {"status": "pending", "fetch_url": "https://proof.example"}}
    assert user_poa_proof_redirect_required(form, journey) is False
    assert _needs_poa_proof_redirect(form, journey) is False
    assert requires_poa_kyc_form_proof_fetch(journey, fetch_url="https://proof") is False


def test_build_next_action_no_proof_redirect_when_path_a_complete_fresh_kyc() -> None:
    journey = _fresh_kyc_journey(
        external_kyc_status="returned_success",
        external_identity_document_id="iddoc_abc",
        geolocation_json={"latitude": 12.97, "longitude": 77.59},
    )
    form = {
        "status": "created",
        "proof_details": {"status": "pending", "fetch_url": "https://s.finprim.com/proof"},
    }
    action = _build_next_action(form, journey=journey)
    assert action["nextAction"] != "proof_redirect"
    assert action["nextAction"] == "ready"


def test_build_next_action_fresh_kyc_never_proof_redirect_when_path_a_incomplete() -> None:
    journey = _fresh_kyc_journey(
        geolocation_json={"latitude": 12.97, "longitude": 77.59},
    )
    form = {
        "status": "created",
        "proof_details": {"status": "pending", "fetch_url": "https://s.finprim.com/proof"},
    }
    action = _build_next_action(form, journey=journey)
    assert action["nextAction"] != "proof_redirect"
    assert action["nextAction"] == "ready"
