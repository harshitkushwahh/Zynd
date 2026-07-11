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


def require_digilocker_or_kra_skip(journey: KycJourneyState) -> None:
    if journey.kyc_already_registered:
        return
    if journey.external_kyc_status != "returned_success":
        raise KycError("Complete DigiLocker verification first.", "digilocker_required", 403)


REKYC_READINESS_CODES = frozenset(
    {
        "kyc_incomplete",
        "kyc_legacy",
        "kyc_onhold",
        "kyc_rejected",
    }
)


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
