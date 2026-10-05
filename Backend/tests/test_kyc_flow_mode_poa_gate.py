from __future__ import annotations

from types import SimpleNamespace

from app.application.kyc.kyc_flow_mode import (
    resolve_kyc_flow_mode,
    should_use_poa_partner_form,
)
from app.application.kyc.path_a_proof import user_poa_proof_redirect_required
from app.infrastructure.persistence.models import KycJourneyState


def test_fresh_kyc_does_not_use_poa_partner_form() -> None:
    journey = KycJourneyState(
        user_id=None,
        readiness_code="kyc_unavailable",
        kyc_already_registered=False,
        external_kyc_form_id="kycf_stale",
    )
    assert resolve_kyc_flow_mode(journey) == "fresh_kyc"
    assert should_use_poa_partner_form(journey) is False


def test_kra_update_uses_poa_partner_form() -> None:
    journey = KycJourneyState(
        user_id=None,
        readiness_code="kyc_incomplete",
        kyc_already_registered=False,
    )
    assert resolve_kyc_flow_mode(journey) == "kra_update"
    assert should_use_poa_partner_form(journey) is True


def test_kra_update_proof_redirect_when_fetch_url_pending() -> None:
    journey = SimpleNamespace(
        external_kyc_status="returned_success",
        external_identity_document_id="iddoc_1",
        kyc_already_registered=False,
        readiness_code="kyc_incomplete",
        poa_readiness_preverify_id="pv_1",
        pan_draft_json={"panNumber": "ABCDE1234F"},
        proof_details_status="pending",
    )
    form = {"proof_details": {"status": "pending", "fetch_url": "https://proof.example"}}
    assert user_poa_proof_redirect_required(form, journey) is True


def test_fresh_kyc_never_proof_redirect_even_with_fetch_url() -> None:
    journey = SimpleNamespace(
        external_kyc_status="returned_success",
        external_identity_document_id="iddoc_1",
        kyc_already_registered=False,
        readiness_code="kyc_unavailable",
        poa_readiness_preverify_id=None,
        pan_draft_json={"panNumber": "ABCDE1234F"},
        proof_details_status="pending",
    )
    form = {"proof_details": {"status": "pending", "fetch_url": "https://proof.example"}}
    assert user_poa_proof_redirect_required(form, journey) is False
