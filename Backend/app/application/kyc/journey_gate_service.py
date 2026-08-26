from __future__ import annotations

from app.application.kyc.eligibility import kyc_eligibility_status
from app.application.kyc.errors import KycError
from app.infrastructure.persistence.models import KycJourneyState, User


def require_entry_gate(user: User) -> None:
    eligibility = kyc_eligibility_status(user)
    if not eligibility["eligible"]:
        raise KycError(
            "Complete account verification before starting KYC.",
            "kyc_entry_gate_blocked",
            403,
        )


def require_pan_verified(journey: KycJourneyState | None) -> None:
    if journey is None or journey.pan_verification_status != "verified":
        raise KycError("Complete PAN verification first.", "pan_not_verified", 403)


REKYC_READINESS_CODES = frozenset(
    {
        "kyc_incomplete",
        "kyc_legacy",
        "kyc_onhold",
        "kyc_rejected",
    }
)


def is_rekyc_readiness_code(readiness_code: str | None) -> bool:
    return str(readiness_code or "").lower() in REKYC_READINESS_CODES


def is_rekyc_modification(journey: KycJourneyState | None) -> bool:
    """Existing KRA record that needs modification (Cybrilla kyc_forms type=modify)."""
    if journey is None:
        return False
    return is_rekyc_readiness_code(journey.readiness_code)


FRESH_KYC_FORM_READINESS_CODES = frozenset({"kyc_unavailable"})


def resolve_kyc_form_type(journey: KycJourneyState | None) -> str:
    """Map KRA readiness to Cybrilla kyc_form type (fresh vs modify).

    Cybrilla allows:
    - fresh when KRA status is unavailable
    - modify when KRA status is validated, verified/registered, or onhold
    """
    if journey is None:
        return "fresh"
    if journey.kyc_already_registered:
        return "modify"
    code = str(journey.readiness_code or "").lower()
    if code in FRESH_KYC_FORM_READINESS_CODES:
        return "fresh"
    if is_rekyc_readiness_code(code):
        return "modify"
    return "fresh"


def requires_digilocker_for_readiness(
    *,
    kyc_already_registered: bool,
    readiness_code: str | None,
) -> bool:
    """Whether the pre-form DigiLocker step is required (Aadhaar address + father's name)."""
    if kyc_already_registered:
        return False
    code = str(readiness_code or "").lower()
    if code == "kyc_incomplete":
        return True
    if is_rekyc_readiness_code(readiness_code):
        return False
    return True


def requires_digilocker(journey: KycJourneyState | None) -> bool:
    if journey is None:
        return True
    return requires_digilocker_for_readiness(
        kyc_already_registered=bool(journey.kyc_already_registered),
        readiness_code=journey.readiness_code,
    )


def require_digilocker_or_kra_skip(journey: KycJourneyState) -> None:
    if not requires_digilocker(journey):
        return
    if journey.external_kyc_status != "returned_success":
        raise KycError("Complete DigiLocker verification first.", "digilocker_required", 403)


def requires_full_kyc_submission(journey: KycJourneyState | None) -> bool:
    """Fresh KYC or re-KYC needs signature, eSign, and KRA form submission."""
    if journey is None:
        return True
    if not journey.kyc_already_registered:
        return True
    code = str(journey.readiness_code or "").lower()
    return code in REKYC_READINESS_CODES


def require_phase1_complete(journey: KycJourneyState | None) -> None:
    if journey is None:
        raise KycError("Complete Phase 1 KYC steps first.", "phase1_incomplete", 403)
    if journey.personal_draft_json is None:
        raise KycError("Complete personal information before continuing.", "phase1_incomplete", 403)
    if journey.last_completed_step not in {"personal", "nominee", "bank", "signature", "review"}:
        raise KycError("Complete Phase 1 KYC steps first.", "phase1_incomplete", 403)


def require_phase2_complete(journey: KycJourneyState | None) -> None:
    if journey is None:
        raise KycError("Complete nominee and bank details first.", "phase2_incomplete", 403)
    require_phase1_complete(journey)
    if journey.bank_verification_status != "verified":
        raise KycError("Verify your bank account before continuing.", "phase2_incomplete", 403)
    if journey.bank_draft_json is None:
        raise KycError("Complete bank details before continuing.", "phase2_incomplete", 403)
