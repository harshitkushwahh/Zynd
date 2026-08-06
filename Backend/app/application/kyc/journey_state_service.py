from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.kyc.journey_gate_service import requires_digilocker, requires_full_kyc_submission
from app.application.kyc.kyc_notification_service import notify_kyc_initiated, notify_kyc_under_review
from app.infrastructure.persistence.models import (
    KycJourneyState,
    KycOverallStatus,
    KycStepStatus,
    User,
    UserKycStatus,
)

PHASE1_STEPS = ("pan", "digilocker", "address", "personal")
PHASE2_STEPS = ("nominee", "bank")
PHASE3_STEPS = ("signature", "review")


def _step_index(
    step: str | None,
    *,
    kyc_already_registered: bool = False,
    requires_full_kyc: bool = False,
    digilocker_required: bool = False,
    digilocker_complete: bool = False,
) -> int:
    """Map last completed step to the next active journey step index."""
    if not step:
        return 0

    use_short_kra_path = kyc_already_registered and not requires_full_kyc
    if use_short_kra_path:
        mapping = {
            "pan": 1,
            "digilocker": 1,
            "address": 2,
            "personal": 3,
            "nominee": 4,
            "bank": 5,
            "review": 5,
        }
    else:
        mapping = {
            "pan": 1,
            "digilocker": 1,
            "address": 2,
            "personal": 3,
            "nominee": 4,
            "bank": 5,
            "signature": 6,
            "review": 6,
        }
    index = mapping.get(step, 0)
    if digilocker_required and not digilocker_complete and index >= 1:
        return 0
    return index


def _digilocker_complete(journey: KycJourneyState | None) -> bool:
    if journey is None:
        return False
    return journey.external_kyc_status == "returned_success"


def resolve_active_step_index(journey: KycJourneyState | None, *, step: str | None = None) -> int:
    if journey is None:
        return 0
    last_step = step if step is not None else journey.last_completed_step
    return _step_index(
        last_step,
        kyc_already_registered=bool(journey.kyc_already_registered),
        requires_full_kyc=requires_full_kyc_submission(journey),
        digilocker_required=requires_digilocker(journey),
        digilocker_complete=_digilocker_complete(journey),
    )


async def get_or_create_journey(db: AsyncSession, user_id: UUID) -> KycJourneyState:
    journey = await db.get(KycJourneyState, user_id)
    if journey:
        return journey
    journey = KycJourneyState(user_id=user_id)
    db.add(journey)
    await db.flush()

    user = await db.get(User, user_id)
    if user:
        notify_kyc_initiated(user=user)
    return journey


async def get_or_create_status(db: AsyncSession, user_id: UUID) -> UserKycStatus:
    status = await db.get(UserKycStatus, user_id)
    if status:
        return status
    status = UserKycStatus(user_id=user_id, overall_status=KycOverallStatus.in_progress)
    db.add(status)
    await db.flush()
    return status


def mark_kyc_submitted(
    *,
    user: User,
    status: UserKycStatus,
    journey: KycJourneyState | None = None,
) -> bool:
    """Transition to submitted and notify once when KYC enters review."""
    if status.overall_status in {KycOverallStatus.submitted, KycOverallStatus.completed}:
        return False
    status.overall_status = KycOverallStatus.submitted
    if journey is not None:
        journey.last_completed_step = "review"
    notify_kyc_under_review(user=user)
    return True


def journey_to_bootstrap_dict(journey: KycJourneyState | None, status: UserKycStatus | None) -> dict[str, Any]:
    if journey is None:
        return {
            "lastCompletedStep": None,
            "activeStepIndex": 0,
            "panDraft": None,
            "contactDraft": None,
            "personalDraft": None,
            "nomineeDraft": None,
            "bankDraft": None,
            "kycAlreadyRegistered": None,
            "readinessCode": None,
            "readinessReason": None,
            "panVerificationStatus": None,
            "panVerificationFailure": None,
            "externalIdentityDocumentId": None,
            "externalKycStatus": None,
            "digilockerFailureReason": None,
            "bankVerificationStatus": None,
            "bankVerificationFailure": None,
            "poaBankPreverifyId": None,
            "poaBankProofFileId": None,
            "signatureDraft": None,
            "externalKycFormId": None,
            "kycFormStatus": None,
            "kycFormType": None,
            "kycFormFailureReason": None,
            "proofDetailsStatus": None,
            "esignDetailsStatus": None,
            "geolocationDraft": None,
            "stepStatuses": None,
        }
    return {
        "lastCompletedStep": journey.last_completed_step,
        "activeStepIndex": resolve_active_step_index(journey),
        "panDraft": journey.pan_draft_json,
        "contactDraft": journey.contact_draft_json,
        "personalDraft": journey.personal_draft_json,
        "nomineeDraft": journey.nominee_draft_json,
        "bankDraft": journey.bank_draft_json,
        "kycAlreadyRegistered": journey.kyc_already_registered,
        "readinessCode": journey.readiness_code,
        "readinessReason": journey.readiness_reason,
        "panVerificationStatus": journey.pan_verification_status,
        "panVerificationFailure": journey.pan_verification_failure_json,
        "externalIdentityDocumentId": journey.external_identity_document_id,
        "externalKycStatus": journey.external_kyc_status,
        "digilockerFailureReason": journey.digilocker_failure_reason,
        "bankVerificationStatus": journey.bank_verification_status,
        "bankVerificationFailure": journey.bank_verification_failure_json,
        "poaBankPreverifyId": journey.poa_bank_preverify_id,
        "poaBankProofFileId": journey.poa_bank_proof_file_id,
        "signatureDraft": journey.signature_draft_json,
        "externalKycFormId": journey.external_kyc_form_id,
        "kycFormStatus": journey.kyc_form_status,
        "kycFormType": journey.kyc_form_type,
        "kycFormFailureReason": journey.kyc_form_failure_reason,
        "proofDetailsStatus": journey.proof_details_status,
        "esignDetailsStatus": journey.esign_details_status,
        "geolocationDraft": journey.geolocation_json,
        "stepStatuses": {
            "pan": status.pan_step_status.value if status else "pending",
            "digilocker": status.digilocker_step_status.value if status else "pending",
            "address": status.address_step_status.value if status else "pending",
            "personal": status.personal_step_status.value if status else "pending",
            "nominee": status.nominee_step_status.value if status else "pending",
            "bank": status.bank_step_status.value if status else "pending",
            "signature": status.signature_step_status.value if status else "pending",
            "review": status.review_step_status.value if status else "pending",
            "overall": status.overall_status.value if status else "none",
        },
    }


async def find_journey_by_identity_document(
    db: AsyncSession,
    identity_document_id: str,
) -> KycJourneyState | None:
    result = await db.execute(
        select(KycJourneyState).where(
            KycJourneyState.external_identity_document_id == identity_document_id
        )
    )
    return result.scalar_one_or_none()


async def save_journey_state(
    db: AsyncSession,
    *,
    user: User,
    payload: dict[str, Any],
) -> tuple[KycJourneyState, UserKycStatus]:
    journey = await get_or_create_journey(db, user.id)
    status = await get_or_create_status(db, user.id)
    status.overall_status = KycOverallStatus.in_progress

    if "panDraftJson" in payload:
        journey.pan_draft_json = payload["panDraftJson"]
    if "contactDraftJson" in payload:
        journey.contact_draft_json = payload["contactDraftJson"]
        status.address_step_status = KycStepStatus.saved
    if "personalDraftJson" in payload:
        journey.personal_draft_json = payload["personalDraftJson"]
        status.personal_step_status = KycStepStatus.saved
        status.overall_status = KycOverallStatus.phase1_complete
    if "nomineeDraftJson" in payload:
        journey.nominee_draft_json = payload["nomineeDraftJson"]
        status.nominee_step_status = (
            KycStepStatus.skipped
            if not payload["nomineeDraftJson"]
            else KycStepStatus.saved
        )
    if "bankDraftJson" in payload:
        journey.bank_draft_json = payload["bankDraftJson"]
        status.bank_step_status = KycStepStatus.saved
        status.overall_status = KycOverallStatus.phase2_complete
    if "bankVerificationStatus" in payload:
        journey.bank_verification_status = payload["bankVerificationStatus"]
    if "bankVerificationFailureJson" in payload:
        journey.bank_verification_failure_json = payload["bankVerificationFailureJson"]
    if "poaBankPreverifyId" in payload:
        journey.poa_bank_preverify_id = payload["poaBankPreverifyId"]
    if "poaBankProofFileId" in payload:
        journey.poa_bank_proof_file_id = payload["poaBankProofFileId"]
    if "signatureDraftJson" in payload:
        journey.signature_draft_json = payload["signatureDraftJson"]
        status.signature_step_status = KycStepStatus.saved
        status.overall_status = KycOverallStatus.phase2_complete
    if "externalKycFormId" in payload:
        journey.external_kyc_form_id = payload["externalKycFormId"]
    if "kycFormStatus" in payload:
        journey.kyc_form_status = payload["kycFormStatus"]
    if "kycFormType" in payload:
        journey.kyc_form_type = payload["kycFormType"]
    if "kycFormFailureReason" in payload:
        journey.kyc_form_failure_reason = payload["kycFormFailureReason"]
    if "proofDetailsStatus" in payload:
        journey.proof_details_status = payload["proofDetailsStatus"]
    if "esignDetailsStatus" in payload:
        journey.esign_details_status = payload["esignDetailsStatus"]
    if "geolocationJson" in payload:
        journey.geolocation_json = payload["geolocationJson"]
    if "kycAlreadyRegistered" in payload:
        journey.kyc_already_registered = payload["kycAlreadyRegistered"]
    if "readinessCode" in payload:
        journey.readiness_code = payload["readinessCode"]
    if "readinessReason" in payload:
        journey.readiness_reason = payload["readinessReason"]
    if "panVerificationStatus" in payload:
        journey.pan_verification_status = payload["panVerificationStatus"]
    if "panVerificationFailureJson" in payload:
        journey.pan_verification_failure_json = payload["panVerificationFailureJson"]
    if "externalKycRequestId" in payload:
        journey.external_kyc_request_id = payload["externalKycRequestId"]
    if "externalIdentityDocumentId" in payload:
        journey.external_identity_document_id = payload["externalIdentityDocumentId"]
    if "externalKycStatus" in payload:
        journey.external_kyc_status = payload["externalKycStatus"]
    if "digilockerFailureReason" in payload:
        journey.digilocker_failure_reason = payload["digilockerFailureReason"]
    if "poaReadinessPreverifyId" in payload:
        journey.poa_readiness_preverify_id = payload["poaReadinessPreverifyId"]
    if "poaPanPreverifyId" in payload:
        journey.poa_pan_preverify_id = payload["poaPanPreverifyId"]

    last_step = payload.get("lastCompletedStep")
    if last_step:
        journey.last_completed_step = last_step
        if last_step == "pan":
            status.pan_step_status = KycStepStatus.verified
        elif last_step == "digilocker":
            status.digilocker_step_status = KycStepStatus.verified
        elif last_step == "address":
            status.address_step_status = KycStepStatus.saved
        elif last_step == "personal":
            status.personal_step_status = KycStepStatus.saved
            status.overall_status = KycOverallStatus.phase1_complete
        elif last_step == "nominee":
            nominees = journey.nominee_draft_json
            status.nominee_step_status = (
                KycStepStatus.skipped if not nominees else KycStepStatus.saved
            )
        elif last_step == "bank":
            status.bank_step_status = KycStepStatus.saved
            if journey.bank_verification_status == "verified":
                status.bank_step_status = KycStepStatus.verified
                status.overall_status = KycOverallStatus.phase2_complete
        elif last_step == "signature":
            status.signature_step_status = KycStepStatus.saved
        elif last_step == "review":
            status.review_step_status = KycStepStatus.saved

    if (
        not requires_digilocker(journey)
        and status.digilocker_step_status == KycStepStatus.pending
    ):
        status.digilocker_step_status = KycStepStatus.skipped

    await db.flush()
    return journey, status
