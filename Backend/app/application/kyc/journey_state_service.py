from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.kyc.bootstrap_redaction import redact_bootstrap_drafts
from app.application.kyc.errors import KycError
from app.application.consent.consent_service import (
    ConsentAcceptContext,
    record_acceptance,
    record_revocation,
)
from app.domain.consent.keys import KYC_NOMINATION_OPT_OUT
from app.application.kyc.journey_gate_service import requires_digilocker, requires_full_kyc_submission
from app.application.kyc.kyc_flow_mode import flow_mode_bootstrap_fields
from app.application.kyc.kyc_partner_refs import latest_kyc_form_proof_fetch_url
from app.application.kyc.path_a_proof import requires_poa_kyc_form_proof_fetch
from app.application.kyc.kyc_notification_service import notify_kyc_under_review
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
    from app.application.kyc.path_a_proof import path_a_digilocker_proof_satisfied

    return path_a_digilocker_proof_satisfied(journey)


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
            "nominationOptedOut": False,
            "bankDraft": None,
            "kycAlreadyRegistered": None,
            "readinessCode": None,
            "readinessReason": None,
            "panVerificationStatus": None,
            "panVerificationFailure": None,
            "externalIdentityDocumentId": None,
            "externalIdentityDocumentJson": None,
            "externalKycStatus": None,
            "digilockerFailureReason": None,
            "bankVerificationStatus": None,
            "bankVerificationFailure": None,
            "poaReadinessPreverifyId": None,
            "poaPanPreverifyId": None,
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
            **flow_mode_bootstrap_fields(None),
            "requiresDigilocker": False,
            "proofFetchUrl": None,
            "requiresPoaProofFetch": False,
        }
    proof_fetch_url = latest_kyc_form_proof_fetch_url(journey) if journey else None
    raw_payload = {
        "lastCompletedStep": journey.last_completed_step,
        "activeStepIndex": resolve_active_step_index(journey),
        "panDraft": journey.pan_draft_json,
        "contactDraft": journey.contact_draft_json,
        "personalDraft": journey.personal_draft_json,
        "nomineeDraft": journey.nominee_draft_json,
        "nominationOptedOut": False,
        "bankDraft": journey.bank_draft_json,
        "kycAlreadyRegistered": journey.kyc_already_registered,
        "readinessCode": journey.readiness_code,
        "readinessReason": journey.readiness_reason,
        "panVerificationStatus": journey.pan_verification_status,
        "panVerificationFailure": journey.pan_verification_failure_json,
        "externalIdentityDocumentId": journey.external_identity_document_id,
        "externalIdentityDocumentJson": journey.external_identity_document_json,
        "externalKycStatus": journey.external_kyc_status,
        "digilockerFailureReason": journey.digilocker_failure_reason,
        "bankVerificationStatus": journey.bank_verification_status,
        "bankVerificationFailure": journey.bank_verification_failure_json,
        "poaReadinessPreverifyId": journey.poa_readiness_preverify_id,
        "poaPanPreverifyId": journey.poa_pan_preverify_id,
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
        **flow_mode_bootstrap_fields(journey),
        "requiresDigilocker": requires_digilocker(journey),
        "proofFetchUrl": proof_fetch_url,
        "requiresPoaProofFetch": requires_poa_kyc_form_proof_fetch(
            journey,
            fetch_url=proof_fetch_url,
        ),
    }
    return redact_bootstrap_drafts(raw_payload)


async def reset_kyc_journey_drafts(
    db: AsyncSession,
    *,
    user: User,
) -> tuple[KycJourneyState, UserKycStatus]:
    """Clear all in-progress KYC journey drafts and verification state (e.g. after PAN removal)."""
    journey = await get_or_create_journey(db, user.id)
    status = await get_or_create_status(db, user.id)

    journey.last_completed_step = None
    journey.pan_draft_json = None
    journey.contact_draft_json = None
    journey.personal_draft_json = None
    journey.kyc_already_registered = None
    journey.readiness_code = None
    journey.readiness_reason = None
    journey.pan_verification_status = None
    journey.pan_verification_failure_json = None
    journey.external_kyc_request_id = None
    journey.external_identity_document_id = None
    journey.external_kyc_status = None
    journey.digilocker_failure_reason = None
    journey.poa_readiness_preverify_id = None
    journey.poa_pan_preverify_id = None
    journey.nominee_draft_json = None
    journey.bank_draft_json = None
    journey.poa_bank_preverify_id = None
    journey.poa_bank_proof_file_id = None
    journey.bank_verification_status = None
    journey.bank_verification_failure_json = None
    journey.signature_draft_json = None
    journey.external_kyc_form_id = None
    journey.kyc_form_status = None
    journey.kyc_form_type = None
    journey.kyc_form_failure_reason = None
    journey.proof_details_status = None
    journey.esign_details_status = None
    journey.geolocation_json = None

    status.pan_step_status = KycStepStatus.pending
    status.digilocker_step_status = KycStepStatus.pending
    status.address_step_status = KycStepStatus.pending
    status.personal_step_status = KycStepStatus.pending
    status.nominee_step_status = KycStepStatus.pending
    status.bank_step_status = KycStepStatus.pending
    status.signature_step_status = KycStepStatus.pending
    status.review_step_status = KycStepStatus.pending
    if status.overall_status not in {KycOverallStatus.completed}:
        status.overall_status = KycOverallStatus.in_progress

    await db.flush()
    return journey, status


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
        from app.application.kyc.kyc_flow_mode import requires_address_step_proof_digilocker
        from app.application.kyc.path_a_proof import address_step_partner_digilocker_pending

        if address_step_partner_digilocker_pending(journey):
            raise KycError("Complete DigiLocker verification first.", "digilocker_required", 403)
        from app.application.kyc.pincode_address_service import normalize_contact_draft_pincodes

        contact_draft = payload["contactDraftJson"]
        if isinstance(contact_draft, dict):
            contact_draft = await normalize_contact_draft_pincodes(contact_draft)
            if requires_address_step_proof_digilocker(journey):
                contact_draft["source"] = "user"
        journey.contact_draft_json = contact_draft
        status.address_step_status = KycStepStatus.saved
    if "personalDraftJson" in payload:
        from app.application.kyc.personal_draft import normalize_personal_draft, validate_personal_draft

        personal_draft = payload["personalDraftJson"]
        if isinstance(personal_draft, dict):
            prior = journey.personal_draft_json if isinstance(journey.personal_draft_json, dict) else {}
            from app.application.kyc.personal_draft import MARITAL_STATUS_LOCKED_KEY, is_marital_status_locked

            locked = is_marital_status_locked(prior)
            validate_personal_draft(personal_draft, journey_marital_locked=locked)
            personal_draft = normalize_personal_draft(personal_draft)
            if locked:
                personal_draft[MARITAL_STATUS_LOCKED_KEY] = True
        journey.personal_draft_json = personal_draft
        status.personal_step_status = KycStepStatus.saved
        status.overall_status = KycOverallStatus.phase1_complete
    consent_ctx_raw = payload.get("consentContext")
    consent_ctx = None
    if isinstance(consent_ctx_raw, dict):
        consent_ctx = ConsentAcceptContext(
            source=str(consent_ctx_raw.get("source") or "kyc_journey"),
            ip=consent_ctx_raw.get("ip"),
            user_agent=consent_ctx_raw.get("userAgent"),
        )

    if payload.get("revokeNominationOptOut") and consent_ctx:
        await record_revocation(
            db,
            user=user,
            definition_key=KYC_NOMINATION_OPT_OUT,
            context=consent_ctx,
        )

    if "nomineeDraftJson" in payload:
        nominee_draft = payload["nomineeDraftJson"]
        if payload.get("recordNominationOptOut"):
            if nominee_draft:
                raise KycError(
                    "Nomination opt-out requires an empty nominee list.",
                    "nomination_opt_out_requires_empty_nominees",
                    400,
                )
            if consent_ctx:
                await record_acceptance(
                    db,
                    user=user,
                    definition_key=KYC_NOMINATION_OPT_OUT,
                    context=consent_ctx,
                )
        elif nominee_draft and consent_ctx:
            await record_revocation(
                db,
                user=user,
                definition_key=KYC_NOMINATION_OPT_OUT,
                context=consent_ctx,
            )

        journey.nominee_draft_json = nominee_draft
        status.nominee_step_status = (
            KycStepStatus.skipped
            if not nominee_draft
            else KycStepStatus.saved
        )

    if payload.get("recordNominationOptOut") and "nomineeDraftJson" not in payload and consent_ctx:
        await record_acceptance(
            db,
            user=user,
            definition_key=KYC_NOMINATION_OPT_OUT,
            context=consent_ctx,
        )
    if "bankDraftJson" in payload:
        bank_draft = payload["bankDraftJson"]
        if isinstance(bank_draft, dict):
            incoming_number = str(bank_draft.get("accountNumber") or "").strip()
            if not incoming_number and isinstance(journey.bank_draft_json, dict):
                preserved = str(journey.bank_draft_json.get("accountNumber") or "").strip()
                if preserved:
                    bank_draft = {**bank_draft, "accountNumber": preserved}
        journey.bank_draft_json = bank_draft
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
        from app.application.kyc.geolocation_service import round_kyc_geo_coordinate

        geo = payload["geolocationJson"] or {}
        if isinstance(geo, dict):
            lat = geo.get("latitude")
            lon = geo.get("longitude")
            if lat is not None and lon is not None:
                geo = {
                    **geo,
                    "latitude": round_kyc_geo_coordinate(float(lat)),
                    "longitude": round_kyc_geo_coordinate(float(lon)),
                }
        journey.geolocation_json = geo
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
    if "externalIdentityDocumentJson" in payload:
        journey.external_identity_document_json = payload["externalIdentityDocumentJson"]
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
        if last_step == "address":
            from app.application.kyc.path_a_proof import address_step_partner_digilocker_pending

            if address_step_partner_digilocker_pending(journey):
                raise KycError("Complete DigiLocker verification first.", "digilocker_required", 403)
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
