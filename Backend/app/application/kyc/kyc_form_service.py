from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.kyc.errors import KycError
from app.application.kyc.journey_gate_service import (
    is_rekyc_modification,
    require_phase2_complete,
    requires_full_kyc_submission,
)
from app.application.kyc.journey_state_service import (
    get_or_create_journey,
    get_or_create_status,
    mark_kyc_submitted,
)
from app.application.kyc.kyc_completion_service import on_kyc_completed
from app.application.kyc.kyc_form_mapper import build_kyc_form_patch_payload, data_url_to_file, _full_name
from app.core.config import get_settings
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.kyc.kyc_forms_client import (
    create_kyc_form,
    fetch_kyc_form,
    patch_kyc_form,
    poll_kyc_form_until_created,
    retry_kyc_form_proof_fetch,
    upload_kyc_form_signature,
)
from app.infrastructure.kyc.stub_provider import (
    stub_mark_kyc_form_esign_complete,
    stub_mark_kyc_form_proof_complete,
)
from app.infrastructure.persistence.models import KycOverallStatus, KycStepStatus, User


def _proof_status(form: dict[str, Any]) -> str | None:
    proof = form.get("proof_details") or {}
    if isinstance(proof, dict):
        return proof.get("status")
    return None


def _proof_fetch_url(form: dict[str, Any]) -> str | None:
    proof = form.get("proof_details") or {}
    if isinstance(proof, dict) and proof.get("fetch_url"):
        return str(proof["fetch_url"])
    return None


def _esign_url(form: dict[str, Any]) -> str | None:
    esign = form.get("esign_details") or {}
    if isinstance(esign, dict) and esign.get("esign_url"):
        return str(esign["esign_url"])
    return None


def _esign_status(form: dict[str, Any]) -> str | None:
    esign = form.get("esign_details") or {}
    if isinstance(esign, dict):
        return esign.get("status")
    return None


def _sync_journey_from_form(journey: Any, form: dict[str, Any]) -> None:
    journey.external_kyc_form_id = str(form.get("id") or journey.external_kyc_form_id or "")
    journey.kyc_form_status = str(form.get("status") or "")
    journey.kyc_form_type = str(form.get("type") or journey.kyc_form_type or "")
    journey.kyc_form_failure_reason = form.get("reason")
    journey.proof_details_status = _proof_status(form)
    journey.esign_details_status = _esign_status(form)


def _build_next_action(form: dict[str, Any], *, journey: Any) -> dict[str, Any]:
    status = str(form.get("status") or "")
    if status == "failed":
        return {
            "nextAction": "failed",
            "message": str(form.get("reason") or "KYC submission failed."),
        }
    if status == "submitted":
        return {"nextAction": "submitted", "message": "KYC submitted successfully."}
    if status in {"awaiting_submission"}:
        return {"nextAction": "processing", "message": "KYC is being submitted to the KRA."}

    proof_status = _proof_status(form)
    fetch_url = _proof_fetch_url(form)
    if fetch_url and proof_status in {None, "pending", "failed"}:
        return {
            "nextAction": "proof_redirect",
            "redirectUrl": fetch_url,
            "message": "Complete DigiLocker verification to fetch identity proof.",
        }

    esign_url = _esign_url(form)
    esign_status = _esign_status(form)
    if status == "awaiting_esign" and esign_url and esign_status in {None, "pending"}:
        geolocation = journey.geolocation_json or {}
        if geolocation.get("latitude") is None or geolocation.get("longitude") is None:
            return {
                "nextAction": "failed",
                "message": "Location is required before eSign. Submit again from the review step.",
            }
        return {
            "nextAction": "esign_redirect",
            "redirectUrl": esign_url,
            "message": "Complete eSign to submit your KYC.",
        }

    if status == "created":
        return {"nextAction": "ready", "message": "KYC form is ready for submission."}

    return {"nextAction": "processing", "message": "KYC submission is in progress."}


async def ensure_kyc_form(db: AsyncSession, *, user: User, journey: Any) -> dict[str, Any]:
    settings = get_settings()
    pan_draft = journey.pan_draft_json or {}
    pan = str(pan_draft.get("panNumber") or "").upper()
    name = _full_name(pan_draft)
    dob = str(pan_draft.get("dateOfBirth") or "").strip()
    if not pan or not name or not dob:
        raise KycError("Complete PAN verification before submitting KYC.", "pan_not_verified", 403)

    form_type = (
        "modify"
        if journey.kyc_already_registered or is_rekyc_modification(journey)
        else "fresh"
    )

    if journey.external_kyc_form_id:
        form = await fetch_kyc_form(journey.external_kyc_form_id)
        if str(form.get("status")) not in {"failed", "expired"}:
            _sync_journey_from_form(journey, form)
            return form

    created = await create_kyc_form(
        form_type=form_type,
        pan=pan,
        name=name,
        date_of_birth=dob,
        proof_details_callback_url=settings.resolved_kyc_proof_callback_url,
        esign_callback_url=settings.resolved_kyc_esign_callback_url,
    )
    form_id = str(created["id"])
    journey.external_kyc_form_id = form_id
    journey.kyc_form_type = form_type
    form = await poll_kyc_form_until_created(form_id)
    _sync_journey_from_form(journey, form)

    if str(form.get("status")) == "failed":
        raise KycError(
            str(form.get("reason") or "KYC form could not be created."),
            "kyc_form_create_failed",
            400,
        )
    await db.flush()
    return form


async def submit_compliant_kyc_journey(db: AsyncSession, *, user: User) -> dict[str, Any]:
    journey = await get_or_create_journey(db, user.id)
    require_phase2_complete(journey)

    if requires_full_kyc_submission(journey):
        raise KycError("This KYC journey requires full submission.", "full_kyc_required", 400)
    if journey.bank_verification_status != "verified":
        raise KycError("Verify your bank account before submitting KYC.", "bank_not_verified", 403)

    status = await get_or_create_status(db, user.id)
    status.review_step_status = KycStepStatus.saved
    status.signature_step_status = KycStepStatus.skipped
    status.overall_status = KycOverallStatus.completed
    journey.last_completed_step = "review"
    completion = await on_kyc_completed(db, user=user, journey=journey)
    name_updated = completion["nameUpdated"]
    await db.flush()

    return {
        "nextAction": "completed",
        "nameUpdated": name_updated,
        "message": "Your details are saved. Your KRA record is already verified.",
        "formId": None,
        "formStatus": "completed",
        "signatureProvided": False,
        "proofStatus": None,
        "esignStatus": None,
    }


async def submit_kyc_form(
    db: AsyncSession,
    *,
    user: User,
    latitude: float | None = None,
    longitude: float | None = None,
    accuracy_meters: float | None = None,
    client_ip: str | None = None,
) -> dict[str, Any]:
    journey = await get_or_create_journey(db, user.id)
    if not requires_full_kyc_submission(journey):
        return await submit_compliant_kyc_journey(db, user=user)

    from app.application.kyc.geolocation_service import lookup_ip_geolocation, validate_kyc_geolocation

    require_phase2_complete(journey)

    if not journey.signature_draft_json:
        raise KycError("Add your signature before submitting KYC.", "signature_required", 400)
    if journey.bank_verification_status != "verified":
        raise KycError("Verify your bank account before submitting KYC.", "bank_not_verified", 403)

    if latitude is None or longitude is None:
        raise KycError(
            "Location access is required to complete KYC eSign.",
            "location_required",
            400,
        )

    ip_geo = await lookup_ip_geolocation(client_ip)
    validate_kyc_geolocation(
        latitude=latitude,
        longitude=longitude,
        accuracy_meters=accuracy_meters,
        client_ip=client_ip,
        ip_geo=ip_geo,
    )
    journey.geolocation_json = {
        "latitude": latitude,
        "longitude": longitude,
        "accuracyMeters": accuracy_meters,
    }

    try:
        form = await ensure_kyc_form(db, user=user, journey=journey)

        patch_payload = build_kyc_form_patch_payload(
            user_email=user.email,
            user_phone=user.phone,
            journey=journey,
        )
        form = await patch_kyc_form(str(form["id"]), patch_payload)
        _sync_journey_from_form(journey, form)

        signature_draft = journey.signature_draft_json or {}
        if not form.get("signature_provided"):
            data_url = str(signature_draft.get("dataUrl") or "")
            if not data_url:
                raise KycError("Signature file is missing.", "signature_required", 400)
            file_bytes, filename, content_type = data_url_to_file(data_url)
            form = await upload_kyc_form_signature(
                str(form["id"]),
                file_bytes=file_bytes,
                filename=filename,
                content_type=content_type,
            )
            _sync_journey_from_form(journey, form)

        form = await fetch_kyc_form(str(form["id"]))
        _sync_journey_from_form(journey, form)
    except FpClientError as exc:
        raise KycError(exc.message, exc.code, exc.status_code) from exc

    status = await get_or_create_status(db, user.id)
    status.review_step_status = KycStepStatus.saved
    status.signature_step_status = KycStepStatus.saved

    if str(form.get("status")) == "submitted":
        mark_kyc_submitted(user=user, status=status, journey=journey)

    await db.flush()
    response = _build_next_action(form, journey=journey)
    response.update(
        {
            "formId": form.get("id"),
            "formStatus": form.get("status"),
            "signatureProvided": bool(form.get("signature_provided")),
            "proofStatus": _proof_status(form),
            "esignStatus": _esign_status(form),
        }
    )
    return response


async def get_kyc_form_status(db: AsyncSession, *, user: User) -> dict[str, Any]:
    journey = await get_or_create_journey(db, user.id)
    if not journey.external_kyc_form_id:
        return {"formId": None, "formStatus": None, "nextAction": "none"}

    form = await fetch_kyc_form(journey.external_kyc_form_id)
    _sync_journey_from_form(journey, form)

    status = await get_or_create_status(db, user.id)
    if str(form.get("status")) == "submitted":
        mark_kyc_submitted(user=user, status=status, journey=journey)
    await db.flush()

    settings = get_settings()
    if settings.kyc_auto_kra_check_enabled and status.overall_status == KycOverallStatus.submitted:
        from app.application.kyc.readiness_check_service import check_kra_readiness_status

        try:
            kra_result = await check_kra_readiness_status(db, user=user)
            if kra_result.get("kraVerified"):
                response = {
                    "nextAction": "completed",
                    "message": kra_result.get("message"),
                    "formId": form.get("id"),
                    "formStatus": "completed",
                    "kraVerified": True,
                }
                return response
        except KycError:
            pass

    response = _build_next_action(form, journey=journey)
    response.update(
        {
            "formId": form.get("id"),
            "formStatus": form.get("status"),
            "failureReason": form.get("reason"),
        }
    )
    return response


async def continue_kyc_form(db: AsyncSession, *, user: User) -> dict[str, Any]:
    journey = await get_or_create_journey(db, user.id)
    if not journey.external_kyc_form_id:
        raise KycError("No KYC form in progress.", "kyc_form_not_found", 404)

    form = await fetch_kyc_form(journey.external_kyc_form_id)
    _sync_journey_from_form(journey, form)

    proof_status = _proof_status(form)
    if proof_status == "failed":
        form = await retry_kyc_form_proof_fetch(journey.external_kyc_form_id)
        _sync_journey_from_form(journey, form)

    status = await get_or_create_status(db, user.id)
    if str(form.get("status")) == "submitted":
        mark_kyc_submitted(user=user, status=status, journey=journey)

    await db.flush()
    response = _build_next_action(form, journey=journey)
    response.update({"formId": form.get("id"), "formStatus": form.get("status")})
    return response


async def mark_proof_callback(db: AsyncSession, *, form_id: str, callback_status: str) -> None:
    from sqlalchemy import select

    from app.infrastructure.persistence.models import KycJourneyState

    result = await db.execute(
        select(KycJourneyState).where(KycJourneyState.external_kyc_form_id == form_id)
    )
    journey = result.scalar_one_or_none()
    if not journey:
        return

    settings = get_settings()
    if not settings.resolved_kyc_provider_live and callback_status == "successful":
        form = stub_mark_kyc_form_proof_complete(form_id)
        if form:
            _sync_journey_from_form(journey, form)
    elif callback_status == "successful":
        form = await fetch_kyc_form(form_id)
        _sync_journey_from_form(journey, form)
    else:
        journey.proof_details_status = "failed"
        journey.kyc_form_failure_reason = "Proof details fetch failed."
    await db.flush()


async def mark_esign_callback(db: AsyncSession, *, form_id: str, callback_status: str) -> None:
    from sqlalchemy import select

    from app.infrastructure.persistence.models import KycJourneyState, User

    result = await db.execute(
        select(KycJourneyState).where(KycJourneyState.external_kyc_form_id == form_id)
    )
    journey = result.scalar_one_or_none()
    if not journey:
        return

    user = await db.get(User, journey.user_id)
    settings = get_settings()
    if not settings.resolved_kyc_provider_live and callback_status == "successful":
        form = stub_mark_kyc_form_esign_complete(form_id)
        if form:
            _sync_journey_from_form(journey, form)
            status = await get_or_create_status(db, journey.user_id)
            if str(form.get("status")) == "submitted" and user:
                mark_kyc_submitted(user=user, status=status, journey=journey)
    elif callback_status == "successful":
        form = await fetch_kyc_form(form_id)
        _sync_journey_from_form(journey, form)
        status = await get_or_create_status(db, journey.user_id)
        if str(form.get("status")) == "submitted" and user:
            mark_kyc_submitted(user=user, status=status, journey=journey)
    else:
        journey.esign_details_status = "failed"
        journey.kyc_form_failure_reason = "eSign was not completed successfully."
    await db.flush()
