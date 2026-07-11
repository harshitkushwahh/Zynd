from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.kyc.errors import KycError
from app.application.kyc.journey_gate_service import require_pan_verified
from app.application.kyc.journey_state_service import get_or_create_journey, save_journey_state
from app.application.kyc.master_data import map_identity_document_to_drafts
from app.core.config import get_settings
from app.infrastructure.kyc.fp_clients import (
    create_kyc_request_and_identity_document,
    fetch_identity_document,
)
from app.infrastructure.persistence.models import User


async def start_digilocker(db: AsyncSession, *, user: User) -> dict[str, Any]:
    journey = await get_or_create_journey(db, user.id)
    require_pan_verified(journey)
    if journey.kyc_already_registered:
        raise KycError("DigiLocker is not required for KRA-compliant investors.", "digilocker_not_required", 409)

    pan_draft = journey.pan_draft_json or {}
    pan = str(pan_draft.get("panNumber") or "").strip()
    full_name = str(pan_draft.get("fullName") or "").strip()
    dob = str(pan_draft.get("dateOfBirth") or "").strip()
    if not pan or not full_name or not dob:
        raise KycError("PAN details missing from journey.", "pan_draft_missing", 400)

    settings = get_settings()
    result = await create_kyc_request_and_identity_document(
        user_email=user.email,
        phone=user.phone,
        pan=pan,
        name=full_name,
        date_of_birth=dob,
        postback_url=settings.resolved_kyc_digilocker_callback_url,
    )
    await save_journey_state(
        db,
        user=user,
        payload={
            "externalKycRequestId": result["kycRequestId"],
            "externalIdentityDocumentId": result["identityDocumentId"],
            "externalKycStatus": "started",
        },
    )
    redirect_url = str(result.get("redirectUrl") or "")
    if not redirect_url:
        raise KycError("DigiLocker redirect URL unavailable.", "digilocker_redirect_missing", 502)
    return {"redirectUrl": redirect_url}


async def load_identity_document(
    db: AsyncSession,
    *,
    user: User,
    document_id: str,
) -> dict[str, Any]:
    journey = await get_or_create_journey(db, user.id)
    if journey.external_identity_document_id and journey.external_identity_document_id != document_id:
        raise KycError("Identity document does not match active KYC journey.", "identity_document_mismatch", 409)

    document = await fetch_identity_document(document_id)
    fetch = document.get("fetch") or {}
    fetch_status = fetch.get("status")
    if fetch_status != "successful":
        reason = str(fetch.get("reason") or "DigiLocker fetch failed.")
        await save_journey_state(
            db,
            user=user,
            payload={
                "externalKycStatus": "returned_failed",
                "digilockerFailureReason": reason,
            },
        )
        return {
            "success": False,
            "fetchStatus": fetch_status,
            "reason": reason,
            "aadhaarNotSelected": "cancel" in reason.lower() or "aadhaar" in reason.lower(),
        }

    mapped = map_identity_document_to_drafts(document)
    contact_draft = mapped["addressPrefill"]
    personal_draft = journey.personal_draft_json or {}
    if mapped.get("fathersName"):
        personal_draft = {**personal_draft, "fathersName": mapped["fathersName"]}

    await save_journey_state(
        db,
        user=user,
        payload={
            "externalIdentityDocumentId": document_id,
            "externalKycStatus": "returned_success",
            "digilockerFailureReason": None,
            "contactDraftJson": contact_draft,
            "personalDraftJson": personal_draft or None,
            "lastCompletedStep": "digilocker",
        },
    )
    return {
        "success": True,
        "fetchStatus": fetch_status,
        "contactDraft": contact_draft,
        "personalDraft": personal_draft,
        "aadhaarLast4": mapped.get("aadhaarLast4"),
    }
