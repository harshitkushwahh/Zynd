from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.kyc.digilocker_prefill import enrich_digilocker_address_prefill
from app.application.kyc.errors import KycError
from app.application.kyc.journey_gate_service import require_pan_verified
from app.application.kyc.journey_state_service import get_or_create_journey
from app.application.kyc.kyc_form_mapper import _full_name
from app.application.kyc.master_data import map_identity_document_to_drafts
from app.core.config import get_settings
from app.infrastructure.kyc.cybrilla_terminal_log import log_kyc_step
from app.infrastructure.kyc.fp_clients import (
    FpClientError,
    create_kyc_request_and_identity_document,
    fetch_identity_document,
)
from app.infrastructure.persistence.models import KycStepStatus, User


def _aadhaar_not_selected(document: dict[str, Any]) -> bool:
    fetch = document.get("fetch") or {}
    reason = str(fetch.get("reason") or "").lower()
    return "aadhaar" in reason and "not" in reason


async def backfill_fathers_name_from_stored_identity_document(
    db: AsyncSession,
    *,
    journey: Any,
) -> bool:
    personal = dict(journey.personal_draft_json or {})
    doc = journey.external_identity_document_json
    if not isinstance(doc, dict):
        return False
    mapped = map_identity_document_to_drafts(doc)
    fathers = str(mapped.get("fathersName") or "").strip()
    if not fathers:
        return False
    existing = str(personal.get("fathersName") or "").strip()
    if existing == fathers:
        return False
    personal["fathersName"] = fathers
    journey.personal_draft_json = personal
    care_of = str(mapped.get("careOf") or "").strip()
    if care_of:
        contact = dict(journey.contact_draft_json or {})
        if not str(contact.get("careOf") or "").strip():
            contact["careOf"] = care_of
            journey.contact_draft_json = contact
    await db.flush()
    return True


async def _persist_identity_success(
    db: AsyncSession,
    *,
    user: User,
    journey: Any,
    document: dict[str, Any],
    document_id: str,
) -> dict[str, Any]:
    mapped = map_identity_document_to_drafts(document)
    address = mapped.get("addressPrefill") or {}
    contact_draft = await enrich_digilocker_address_prefill(
        {
            "permanent": address.get("permanent") or {},
            "sameAsPermanent": bool(address.get("sameAsPermanent", True)),
        }
    )
    care_of = str(mapped.get("careOf") or "").strip()
    if care_of:
        contact_draft["careOf"] = care_of
    personal_patch: dict[str, Any] = {}
    if mapped.get("fathersName"):
        personal_patch["fathersName"] = mapped["fathersName"]
    from app.application.kyc.kyc_partner_refs import append_kyc_partner_ref

    journey.external_identity_document_id = document_id
    journey.external_identity_document_json = document
    journey.external_kyc_status = "returned_success"
    pan = str((journey.pan_draft_json or {}).get("panNumber") or "")
    append_kyc_partner_ref(
        journey,
        kind="identity_document",
        external_id=document_id,
        status="returned_success",
        pan=pan or None,
    )
    journey.digilocker_failure_reason = None
    journey.contact_draft_json = contact_draft
    if personal_patch:
        existing = dict(journey.personal_draft_json or {})
        existing.update(personal_patch)
        journey.personal_draft_json = existing
    await db.flush()
    from app.application.kyc.poa_kyc_form_service import provision_poa_kyc_form_after_path_a

    await provision_poa_kyc_form_after_path_a(db, user=user, journey=journey)
    return {
        "success": True,
        "fetchStatus": (document.get("fetch") or {}).get("status"),
        "contactDraft": contact_draft,
        "personalDraft": journey.personal_draft_json,
        "aadhaarLast4": mapped.get("aadhaarLast4"),
        "poaProofFetchUrl": _proof_fetch_url_from_journey(journey),
    }


def _proof_fetch_url_from_journey(journey: Any) -> str | None:
    from app.application.kyc.kyc_partner_refs import latest_kyc_form_proof_fetch_url

    return latest_kyc_form_proof_fetch_url(journey)


async def start_digilocker(db: AsyncSession, *, user: User) -> dict[str, Any]:
    journey = await get_or_create_journey(db, user.id)
    require_pan_verified(journey)
    settings = get_settings()
    pan_draft = journey.pan_draft_json or {}
    pan = str(pan_draft.get("panNumber") or "").upper()
    name = _full_name(pan_draft)
    dob = str(pan_draft.get("dateOfBirth") or "").strip()
    if not pan or not name or not dob:
        raise KycError("Complete PAN verification before DigiLocker.", "pan_not_verified", 403)

    postback_url = settings.resolved_kyc_digilocker_callback_url
    log_kyc_step(
        "digilocker_postback_url",
        postback_url=postback_url,
        sandbox=settings.kyc_digilocker_sandbox,
    )

    try:
        result = await create_kyc_request_and_identity_document(
            user_email=user.email,
            phone=user.phone,
            pan=pan,
            name=name,
            date_of_birth=dob,
            postback_url=postback_url,
        )
    except FpClientError as exc:
        raise KycError(exc.message, exc.code, exc.status_code) from exc

    from app.application.kyc.kyc_partner_refs import append_kyc_partner_ref

    kyc_request_id = str(result.get("kycRequestId") or "")
    document_id = str(result.get("identityDocumentId") or "")
    journey.external_kyc_request_id = kyc_request_id
    journey.external_identity_document_id = document_id
    journey.external_kyc_status = "started"
    journey.digilocker_failure_reason = None
    if kyc_request_id:
        append_kyc_partner_ref(
            journey,
            kind="kyc_request",
            external_id=kyc_request_id,
            status="started",
            pan=pan,
        )
    redirect_url = str(result.get("redirectUrl") or "").strip()
    if document_id:
        append_kyc_partner_ref(
            journey,
            kind="identity_document",
            external_id=document_id,
            status="started",
            pan=pan,
            extra={"redirect_url": redirect_url} if redirect_url else None,
        )
    await db.flush()

    if not redirect_url:
        raise KycError(
            "DigiLocker redirect URL missing from FinPrim.",
            "digilocker_unavailable",
            502,
        )

    return {
        "redirectUrl": redirect_url,
        "inlineComplete": False,
        "identityDocumentId": document_id,
    }


def _identity_document_already_hydrated(journey: Any, *, document_id: str) -> dict[str, Any] | None:
    if str(journey.external_identity_document_id or "") != document_id:
        return None
    if journey.external_kyc_status != "returned_success":
        return None
    if not journey.contact_draft_json:
        return None
    fetch_status = "successful"
    if isinstance(journey.external_identity_document_json, dict):
        fetch_status = str(
            (journey.external_identity_document_json.get("fetch") or {}).get("status") or "successful"
        )
    return {
        "success": True,
        "fetchStatus": fetch_status,
        "contactDraft": journey.contact_draft_json,
        "personalDraft": journey.personal_draft_json,
    }


async def load_identity_document(
    db: AsyncSession,
    *,
    user: User,
    document_id: str,
    postback_complete: bool = False,
) -> dict[str, Any]:
    journey = await get_or_create_journey(db, user.id)
    if journey.external_identity_document_id and journey.external_identity_document_id != document_id:
        raise KycError("Identity document does not match this journey.", "digilocker_mismatch", 403)

    cached = _identity_document_already_hydrated(journey, document_id=document_id)
    if cached:
        if await backfill_fathers_name_from_stored_identity_document(db, journey=journey):
            cached = {
                **cached,
                "personalDraft": journey.personal_draft_json,
                "contactDraft": journey.contact_draft_json,
            }
        return cached

    try:
        document = await fetch_identity_document(document_id, postback_complete=postback_complete)
    except FpClientError as exc:
        raise KycError(exc.message, exc.code, exc.status_code) from exc

    fetch = document.get("fetch") or {}
    fetch_status = str(fetch.get("status") or "")
    if _aadhaar_not_selected(document):
        journey.external_kyc_status = "returned_failed"
        journey.digilocker_failure_reason = "Aadhaar was not selected in DigiLocker."
        await db.flush()
        return {
            "success": False,
            "fetchStatus": fetch_status,
            "reason": journey.digilocker_failure_reason,
            "aadhaarNotSelected": True,
        }

    if fetch_status != "successful" or not document.get("data"):
        reason = str(fetch.get("reason") or "DigiLocker verification failed.")
        journey.external_kyc_status = "returned_failed"
        journey.digilocker_failure_reason = reason
        await db.flush()
        return {
            "success": False,
            "fetchStatus": fetch_status,
            "reason": reason,
            "aadhaarNotSelected": False,
        }

    payload = await _persist_identity_success(
        db,
        user=user,
        journey=journey,
        document=document,
        document_id=document_id,
    )
    from app.application.kyc.journey_state_service import get_or_create_status

    status = await get_or_create_status(db, user.id)
    status.digilocker_step_status = KycStepStatus.verified
    await db.flush()
    return payload


async def handle_public_digilocker_callback(
    db: AsyncSession,
    *,
    identity_document_id: str | None,
    status: str | None,
    error: str | None,
) -> str:
    settings = get_settings()
    base = settings.resolved_kyc_digilocker_web_return_url()
    if not identity_document_id:
        return base

    from app.application.kyc.journey_state_service import find_journey_by_identity_document

    journey = await find_journey_by_identity_document(db, identity_document_id)
    if journey and status == "successful":
        user = await db.get(User, journey.user_id)
        if user:
            await load_identity_document(
                db,
                user=user,
                document_id=identity_document_id,
                postback_complete=True,
            )
    elif journey:
        journey.external_kyc_status = "returned_failed"
        journey.digilocker_failure_reason = error or "DigiLocker was not completed."
        await db.flush()

    from urllib.parse import urlencode

    params = urlencode(
        {
            "identity_document": identity_document_id,
            "status": status or "failed",
            **({"digilocker_error": error} if error else {}),
        }
    )
    return f"{base}?{params}"


def resolved_client_postback_url() -> str:
    return get_settings().resolved_kyc_digilocker_callback_url
