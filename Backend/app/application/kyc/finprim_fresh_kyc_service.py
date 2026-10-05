from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.kyc.errors import KycError
from app.application.kyc.finprim_kyc_request_mapper import (
    build_finprim_kyc_request_patch,
    kyc_request_fields_needed,
    kyc_request_status,
)
from app.application.kyc.journey_state_service import get_or_create_status
from app.application.kyc.kyc_form_mapper import data_url_to_file
from app.application.kyc.kyc_partner_refs import append_kyc_partner_ref, latest_partner_ref_id
from app.application.kyc.personal_draft import lock_marital_status_on_journey
from app.core.config import get_settings
from app.infrastructure.kyc.finprim_kyc_client import (
    create_finprim_esign,
    fetch_finprim_esign,
    fetch_kyc_request,
    finprim_esign_complete,
    finprim_esign_redirect_url,
    patch_kyc_request,
    upload_finprim_kyc_file,
)
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.persistence.models import KycOverallStatus, KycStepStatus, User


def _fresh_submit_response(
    *,
    next_action: str,
    message: str,
    journey: Any,
    redirect_url: str | None = None,
    esign_id: str | None = None,
    kyc_request_status_value: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "nextAction": next_action,
        "message": message,
        "formId": journey.external_kyc_request_id,
        "formStatus": kyc_request_status_value or journey.esign_details_status or "esign_required",
        "signatureProvided": True,
        "proofStatus": None,
        "esignStatus": journey.esign_details_status,
    }
    if redirect_url:
        payload["redirectUrl"] = redirect_url
    if esign_id:
        payload["esignId"] = esign_id
    return payload


def _require_esign_ready(kyc_request: dict[str, Any]) -> None:
    status = kyc_request_status(kyc_request)
    if status == "esign_required":
        return
    missing = kyc_request_fields_needed(kyc_request)
    detail = f" Status: {status or 'pending'}."
    if missing:
        detail += f" Still needed: {', '.join(missing)}."
    raise KycError(
        "Your KYC details are not ready for eSign yet." + detail,
        "kyc_not_ready_for_esign",
        400,
    )


def _mark_marital_locked_if_spouse_in_patch(journey: Any, patch_body: dict[str, Any]) -> None:
    if str(patch_body.get("spouse_name") or "").strip():
        lock_marital_status_on_journey(journey)


_FINPRIM_KYC_REQUEST_SUBMITTED = frozenset(
    {"submitted", "successful", "success", "completed", "approved", "under_review"},
)
_ESIGN_PENDING = frozenset({"pending", "initiated", "in_progress", "created"})


async def _apply_finprim_esign_payload(
    db: AsyncSession,
    *,
    user: User,
    journey: Any,
    esign: dict[str, Any],
    finprim_kyc_status: str | None = None,
) -> dict[str, Any] | None:
    """If eSign is complete, mark journey submitted; if pending with URL, return redirect action."""
    journey.esign_details_status = str(esign.get("status") or journey.esign_details_status or "")
    status = await get_or_create_status(db, user.id)

    if finprim_esign_complete(esign):
        from app.application.kyc.journey_state_service import mark_kyc_submitted

        mark_kyc_submitted(user=user, status=status, journey=journey)
        await db.flush()
        return _fresh_submit_response(
            next_action="submitted",
            message="KYC submitted successfully.",
            journey=journey,
            kyc_request_status_value=finprim_kyc_status,
        )

    redirect_url = finprim_esign_redirect_url(esign)
    esign_status = str(esign.get("status") or "").lower()
    if redirect_url and esign_status in _ESIGN_PENDING | {""}:
        return _fresh_submit_response(
            next_action="esign_redirect",
            message="Complete eSign to submit your KYC.",
            journey=journey,
            redirect_url=redirect_url,
            esign_id=str(esign.get("id") or "") or None,
            kyc_request_status_value=finprim_kyc_status,
        )
    return None


async def resolve_fresh_kyc_partner_status(
    db: AsyncSession,
    *,
    user: User,
    journey: Any,
) -> dict[str, Any]:
    """Poll Finprim eSign / kyc_request — used after eSign return and on GET /kyc/form/status."""
    status_row = await get_or_create_status(db, user.id)
    if status_row.overall_status == KycOverallStatus.completed:
        return _fresh_submit_response(
            next_action="completed",
            message="KYC is verified.",
            journey=journey,
        )
    if status_row.overall_status == KycOverallStatus.submitted:
        return _fresh_submit_response(
            next_action="submitted",
            message="KYC submitted successfully.",
            journey=journey,
        )

    esign_id = latest_partner_ref_id(journey, kind="esign")
    if esign_id:
        try:
            esign = await fetch_finprim_esign(esign_id)
            resolved = await _apply_finprim_esign_payload(
                db,
                user=user,
                journey=journey,
                esign=esign,
            )
            if resolved:
                return resolved
        except FpClientError:
            pass

    kyc_request_id = str(journey.external_kyc_request_id or "").strip()
    if kyc_request_id:
        try:
            kyc_request = await fetch_kyc_request(kyc_request_id)
            finprim_status = kyc_request_status(kyc_request)
            if finprim_status in _FINPRIM_KYC_REQUEST_SUBMITTED:
                from app.application.kyc.journey_state_service import mark_kyc_submitted

                mark_kyc_submitted(user=user, status=status_row, journey=journey)
                await db.flush()
                return _fresh_submit_response(
                    next_action="submitted",
                    message="KYC submitted successfully.",
                    journey=journey,
                    kyc_request_status_value=finprim_status,
                )
        except FpClientError:
            pass

    return _fresh_submit_response(
        next_action="processing",
        message="Waiting for eSign confirmation.",
        journey=journey,
        kyc_request_status_value=journey.esign_details_status,
    )


async def _sync_finprim_kyc_request_from_journey(
    *,
    user: User,
    journey: Any,
    signature_file_id: str | None,
) -> tuple[dict[str, Any], str]:
    """PATCH Finprim kyc_request with latest wizard drafts (e.g. after edits post–incomplete eSign)."""
    kyc_request_id = str(journey.external_kyc_request_id or "").strip()
    if not kyc_request_id:
        raise KycError(
            "Complete DigiLocker on the address step before submitting KYC.",
            "digilocker_required",
            403,
        )
    patch_body = build_finprim_kyc_request_patch(
        user_email=user.email,
        user_phone=user.phone,
        journey=journey,
        signature_file_id=signature_file_id,
    )
    kyc_request = await patch_kyc_request(kyc_request_id, patch_body)
    _mark_marital_locked_if_spouse_in_patch(journey, patch_body)
    finprim_status = kyc_request_status(kyc_request)
    if finprim_status != "esign_required":
        kyc_request = await fetch_kyc_request(kyc_request_id)
        finprim_status = kyc_request_status(kyc_request)
    _require_esign_ready(kyc_request)
    return kyc_request, finprim_status or "esign_required"


async def submit_fresh_kyc_via_finprim(
    db: AsyncSession,
    *,
    user: User,
    journey: Any,
) -> dict[str, Any]:
    """J2 fresh_kyc: Finprim kyc_request + eSign — no Cybrilla POA proof_details."""
    existing = await resolve_fresh_kyc_partner_status(db, user=user, journey=journey)
    if existing.get("nextAction") in {"submitted", "completed", "esign_redirect"}:
        return existing

    signature_draft = journey.signature_draft_json or {}
    data_url = str(signature_draft.get("dataUrl") or "")
    if not data_url:
        raise KycError("Signature file is missing.", "signature_required", 400)

    settings = get_settings()
    postback_url = settings.resolved_kyc_esign_callback_url
    pan = str((journey.pan_draft_json or {}).get("panNumber") or "") or None
    finprim_kyc_status = "esign_required"

    try:
        file_bytes, filename, content_type = data_url_to_file(data_url)
        file_payload = await upload_finprim_kyc_file(
            file_bytes=file_bytes,
            filename=filename,
            content_type=content_type,
        )
        signature_file_id = str(file_payload.get("id") or "").strip()
        if not signature_file_id:
            raise KycError(
                "Could not upload signature to Finprim.",
                "signature_upload_failed",
                502,
            )
        append_kyc_partner_ref(
            journey,
            kind="signature_file",
            external_id=signature_file_id,
            status="uploaded",
            pan=pan,
        )

        _, finprim_kyc_status = await _sync_finprim_kyc_request_from_journey(
            user=user,
            journey=journey,
            signature_file_id=signature_file_id,
        )
        append_kyc_partner_ref(
            journey,
            kind="kyc_request",
            external_id=str(journey.external_kyc_request_id or ""),
            status=finprim_kyc_status,
            pan=pan,
        )

        esign = await create_finprim_esign(
            kyc_request_id=str(journey.external_kyc_request_id or ""),
            postback_url=postback_url,
        )
    except ValueError as exc:
        raise KycError(str(exc), "kyc_patch_invalid", 400) from exc
    except FpClientError as exc:
        raise KycError(exc.message, exc.code, exc.status_code) from exc

    esign_id = str(esign.get("id") or "")
    redirect_url = finprim_esign_redirect_url(esign)
    journey.esign_details_status = str(esign.get("status") or "pending")
    append_kyc_partner_ref(
        journey,
        kind="esign",
        external_id=esign_id or str(journey.external_kyc_request_id or ""),
        status=journey.esign_details_status,
        pan=pan,
    )

    status = await get_or_create_status(db, user.id)
    status.review_step_status = KycStepStatus.saved
    status.signature_step_status = KycStepStatus.saved
    await db.flush()

    if redirect_url:
        return _fresh_submit_response(
            next_action="esign_redirect",
            message="Complete eSign to submit your KYC.",
            journey=journey,
            redirect_url=redirect_url,
            esign_id=esign_id or None,
            kyc_request_status_value=finprim_kyc_status,
        )

    if finprim_esign_complete(esign):
        from app.application.kyc.journey_state_service import mark_kyc_submitted

        mark_kyc_submitted(user=user, status=status, journey=journey)
        await db.flush()
        return _fresh_submit_response(
            next_action="submitted",
            message="KYC submitted successfully.",
            journey=journey,
            esign_id=esign_id or None,
            kyc_request_status_value=finprim_kyc_status,
        )

    return _fresh_submit_response(
        next_action="processing",
        message="Preparing eSign. Try again in a few seconds.",
        journey=journey,
        esign_id=esign_id or None,
        kyc_request_status_value=finprim_kyc_status,
    )


async def continue_fresh_kyc_finprim_esign(
    db: AsyncSession,
    *,
    user: User,
    journey: Any,
) -> dict[str, Any]:
    resolved = await resolve_fresh_kyc_partner_status(db, user=user, journey=journey)
    if resolved.get("nextAction") in {"submitted", "completed", "esign_redirect"}:
        return resolved

    signature_file_id = latest_partner_ref_id(journey, kind="signature_file")
    if not signature_file_id:
        raise KycError("Submit your KYC from Review before continuing eSign.", "signature_required", 400)

    settings = get_settings()
    pan = str((journey.pan_draft_json or {}).get("panNumber") or "") or None
    finprim_kyc_status = "esign_required"
    try:
        _, finprim_kyc_status = await _sync_finprim_kyc_request_from_journey(
            user=user,
            journey=journey,
            signature_file_id=signature_file_id,
        )
        esign = await create_finprim_esign(
            kyc_request_id=str(journey.external_kyc_request_id or ""),
            postback_url=settings.resolved_kyc_esign_callback_url,
        )
    except ValueError as exc:
        raise KycError(str(exc), "kyc_patch_invalid", 400) from exc
    except FpClientError as exc:
        raise KycError(exc.message, exc.code, exc.status_code) from exc

    esign_id = str(esign.get("id") or "")
    redirect_url = finprim_esign_redirect_url(esign)
    journey.esign_details_status = str(esign.get("status") or "pending")
    append_kyc_partner_ref(
        journey,
        kind="esign",
        external_id=esign_id or str(journey.external_kyc_request_id or ""),
        status=journey.esign_details_status,
        pan=pan,
    )

    status = await get_or_create_status(db, user.id)
    if finprim_esign_complete(esign):
        from app.application.kyc.journey_state_service import mark_kyc_submitted

        mark_kyc_submitted(user=user, status=status, journey=journey)
        await db.flush()
        return _fresh_submit_response(
            next_action="submitted",
            message="KYC submitted successfully.",
            journey=journey,
            kyc_request_status_value=finprim_kyc_status,
        )

    if redirect_url:
        return _fresh_submit_response(
            next_action="esign_redirect",
            message="Complete eSign to submit your KYC.",
            journey=journey,
            redirect_url=redirect_url,
            esign_id=esign_id,
            kyc_request_status_value=finprim_kyc_status,
        )

    await db.flush()
    return _fresh_submit_response(
        next_action="processing",
        message="Waiting for eSign confirmation.",
        journey=journey,
        esign_id=esign_id,
        kyc_request_status_value=finprim_kyc_status,
    )
