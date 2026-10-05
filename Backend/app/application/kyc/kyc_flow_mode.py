from __future__ import annotations

from typing import Literal

from app.application.kyc.journey_gate_service import (
    is_kra_compliant_short_submit,
    is_rekyc_modification,
    requires_full_kyc_submission,
    resolve_kyc_form_type,
)
from app.infrastructure.persistence.models import KycJourneyState

KycFlowMode = Literal["repeat_kra", "fresh_kyc", "kra_update"]


def resolve_kyc_flow_mode(journey: KycJourneyState | None) -> KycFlowMode:
    if journey is None:
        return "fresh_kyc"
    if is_kra_compliant_short_submit(journey):
        return "repeat_kra"
    if is_rekyc_modification(journey) or resolve_kyc_form_type(journey) == "modify":
        return "kra_update"
    return "fresh_kyc"


def requires_address_step_digilocker(journey: KycJourneyState | None) -> bool:
    """Path A (Finprim iddoc) at the address step — full KYC for fresh (J2) and re-KYC (J3)."""
    if journey is None:
        return False
    if resolve_kyc_flow_mode(journey) == "repeat_kra":
        return False
    return requires_full_kyc_submission(journey)


def requires_pan_step_digilocker(journey: KycJourneyState | None) -> bool:
    """Legacy bootstrap name; same gate as address-step Path A."""
    return requires_address_step_digilocker(journey)


def should_use_poa_partner_form(journey: KycJourneyState | None) -> bool:
    """Cybrilla POA kyc_forms + proof_details at Review — J3 kra_update only (Multiplus parity)."""
    if journey is None:
        return False
    return resolve_kyc_flow_mode(journey) == "kra_update"


def is_poa_kyc_form_flow(journey: KycJourneyState | None) -> bool:
    """POA form lifecycle (proof + POA eSign) applies only on kra_update."""
    return should_use_poa_partner_form(journey)


def flow_mode_bootstrap_fields(journey: KycJourneyState | None) -> dict[str, object]:
    mode = resolve_kyc_flow_mode(journey)
    address_step = requires_address_step_digilocker(journey)
    return {
        "kycFlowMode": mode,
        "requiresAddressStepDigilocker": address_step,
        "requiresPanStepDigilocker": address_step,
        "shouldUsePoaPartnerForm": should_use_poa_partner_form(journey),
        "poaKycFormId": journey.external_kyc_form_id if journey else None,
    }
