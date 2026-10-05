from __future__ import annotations

from typing import Any

from app.application.kyc.kyc_flow_mode import (
    requires_address_step_digilocker,
    resolve_kyc_flow_mode,
    should_use_poa_partner_form,
)
from app.infrastructure.persistence.models import KycJourneyState


def identity_proof_only_at_address_step(journey: KycJourneyState | None) -> bool:
    """Full KYC uses Finprim DigiLocker on the address step only — no POA proof redirect at review."""
    return requires_address_step_digilocker(journey)


def path_a_digilocker_proof_satisfied(journey: KycJourneyState | None) -> bool:
    """Finprim identity document (address-step DigiLocker) completed successfully."""
    if journey is None:
        return False
    if str(journey.external_kyc_status or "").strip() == "returned_failed":
        return False
    if not str(journey.external_identity_document_id or "").strip():
        return False
    return str(journey.external_kyc_status or "").strip() == "returned_success"


_PROOF_COMPLETE = frozenset({"fetched", "successful", "success", "completed"})


def poa_form_proof_complete(form: dict[str, Any]) -> bool:
    proof = form.get("proof_details") or {}
    if not isinstance(proof, dict):
        return False
    return str(proof.get("status") or "").lower() in _PROOF_COMPLETE


def poa_partner_proof_satisfied(form: dict[str, Any], journey: KycJourneyState | None) -> bool:
    """Cybrilla POA kyc_form proof_details must be fetched before eSign (Path A iddoc alone is not enough)."""
    _ = journey
    return poa_form_proof_complete(form)


def skip_user_poa_proof_redirect(journey: KycJourneyState | None) -> bool:
    """Skip auto proof redirect on status/bootstrap polls when Path A address DigiLocker succeeded.

    Submit may still return proof_redirect when Cybrilla left proof_details pending with a fetch_url.
    """
    if not identity_proof_only_at_address_step(journey):
        return False
    if not path_a_digilocker_proof_satisfied(journey):
        return False
    mode = resolve_kyc_flow_mode(journey)
    return mode in ("fresh_kyc", "kra_update")


def user_poa_proof_redirect_required(form: dict[str, Any], journey: KycJourneyState | None) -> bool:
    """Whether the client should send the user to proof_details.fetch_url (e.g. on Review submit)."""
    if not should_use_poa_partner_form(journey):
        return False
    if poa_form_proof_complete(form):
        return False
    proof = form.get("proof_details") or {}
    fetch_url = proof.get("fetch_url") if isinstance(proof, dict) else None
    if fetch_url:
        proof_status = str((proof.get("status") if isinstance(proof, dict) else None) or "").lower()
        if proof_status not in _PROOF_COMPLETE:
            return True
    req = form.get("requirements") or {}
    fields = req.get("fields_needed") if isinstance(req, dict) else None
    if isinstance(fields, list):
        proof_status = str((proof.get("status") if isinstance(proof, dict) else None) or "").lower()
        if proof_status not in _PROOF_COMPLETE:
            for field in fields:
                if str(field).lower() in {"identity_proof", "address"}:
                    return True
    return False


def requires_poa_kyc_form_proof_fetch(journey: KycJourneyState | None, *, fetch_url: str | None) -> bool:
    if journey is None or not fetch_url:
        return False
    if not should_use_poa_partner_form(journey):
        return False
    from app.application.kyc.journey_gate_service import requires_full_kyc_submission

    if not requires_full_kyc_submission(journey):
        return False
    status = str(journey.proof_details_status or "").lower()
    return status not in _PROOF_COMPLETE
