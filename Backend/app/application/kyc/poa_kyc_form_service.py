from __future__ import annotations

import asyncio
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.kyc.errors import KycError
from app.application.kyc.journey_gate_service import (
    requires_full_kyc_submission,
    resolve_kyc_form_type,
)
from app.application.kyc.journey_state_service import get_or_create_journey
from app.application.kyc.kyc_form_mapper import (
    build_kyc_form_patch_payload,
    filter_kyc_form_patch_for_requirements,
    kyc_form_needs_demographic_patch,
)
from app.application.kyc.kyc_form_service import (
    _is_kyc_form_patch_forbidden,
    _is_unusable_kyc_form,
    ensure_kyc_form,
    fetch_journey_kyc_form,
)
from app.application.kyc.kyc_partner_refs import record_kyc_form_partner_ref
from app.application.kyc.path_a_proof import (
    path_a_digilocker_proof_satisfied,
    poa_form_proof_complete,
    skip_user_poa_proof_redirect,
    user_poa_proof_redirect_required,
)
from app.application.integrations.integration_runtime import is_poa_kyc_provider_unavailable_error
from app.core.config import get_settings
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.kyc.kyc_forms_client import (
    fetch_kyc_form,
    patch_kyc_form,
    retry_kyc_form_proof_fetch,
)
from app.infrastructure.persistence.models import User

_PROOF_COMPLETE = frozenset({"fetched", "successful", "success", "completed"})


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


def _partner_fields_needed(form: dict[str, Any]) -> list[str]:
    req = form.get("requirements") or {}
    fields = req.get("fields_needed")
    if isinstance(fields, list):
        return [str(item) for item in fields if item]
    return []


def _needs_poa_proof_redirect(form: dict[str, Any], journey: Any) -> bool:
    return user_poa_proof_redirect_required(form, journey)


async def resolve_poa_proof_server_side(
    journey: Any,
    form: dict[str, Any],
    *,
    max_poll_after_retry: int = 3,
) -> dict[str, Any]:
    """Refresh Cybrilla proof_details after Path A — kra_update (J3) only."""
    from app.application.kyc.kyc_flow_mode import should_use_poa_partner_form

    if not should_use_poa_partner_form(journey):
        return form
    if not skip_user_poa_proof_redirect(journey):
        return form
    form_id = str(form.get("id") or journey.external_kyc_form_id or "").strip()
    if not form_id:
        return form
    if poa_form_proof_complete(form):
        record_kyc_form_partner_ref(journey, form)
        return form

    proof_status = str(_proof_status(form) or "").lower()
    did_retry = False
    if proof_status == "failed":
        try:
            form = await retry_kyc_form_proof_fetch(form_id)
            did_retry = True
            proof_status = str(_proof_status(form) or "").lower()
        except FpClientError:
            record_kyc_form_partner_ref(journey, form)
            return form

    if poa_form_proof_complete(form):
        record_kyc_form_partner_ref(journey, form)
        return form

    # Idle pending does not resolve without partner callback or user proof_fetch_url.
    poll_budget = max_poll_after_retry if did_retry else 1
    for attempt in range(poll_budget):
        if attempt > 0:
            await asyncio.sleep(min(0.5 * attempt, 2.0))
        try:
            form = await fetch_kyc_form(form_id)
        except FpClientError:
            break
        if poa_form_proof_complete(form):
            break
        if str(_proof_status(form) or "").lower() == "pending" and not did_retry:
            break

    record_kyc_form_partner_ref(journey, form)
    return form


def _sync_journey_from_form(journey: Any, form: dict[str, Any]) -> None:
    journey.external_kyc_form_id = str(form.get("id") or journey.external_kyc_form_id or "")
    journey.kyc_form_status = str(form.get("status") or "")
    journey.kyc_form_type = str(form.get("type") or journey.kyc_form_type or "")
    journey.kyc_form_failure_reason = form.get("reason")
    journey.proof_details_status = _proof_status(form)
    esign = form.get("esign_details") or {}
    if isinstance(esign, dict):
        journey.esign_details_status = esign.get("status")
    record_kyc_form_partner_ref(journey, form)


def _status_dict(form: dict[str, Any], journey: Any) -> dict[str, Any]:
    return {
        "formId": form.get("id"),
        "formStatus": form.get("status"),
        "proofDetailsStatus": _proof_status(form),
        "proofFetchUrl": _proof_fetch_url(form),
        "partnerFieldsNeeded": _partner_fields_needed(form),
        "needsDigilocker": _needs_poa_proof_redirect(form, journey),
        "pathADigilockerComplete": path_a_digilocker_proof_satisfied(journey),
    }


async def provision_poa_kyc_form_after_path_a(
    db: AsyncSession,
    *,
    user: User,
    journey: Any,
) -> None:
    """Create/bind Cybrilla kyc_form after Finprim address DigiLocker — kra_update (J3) only."""
    from app.application.kyc.kyc_flow_mode import should_use_poa_partner_form

    if not should_use_poa_partner_form(journey):
        return
    if not requires_full_kyc_submission(journey):
        return
    if not path_a_digilocker_proof_satisfied(journey):
        return
    try:
        form = await ensure_kyc_form(db, user=user, journey=journey)
    except KycError:
        return
    except FpClientError:
        return
    form = await resolve_poa_proof_server_side(journey, form)
    _sync_journey_from_form(journey, form)
    await db.flush()


async def get_poa_form_config() -> dict[str, bool]:
    settings = get_settings()
    return {"freshFormsEnabled": settings.fp_poa_kyc_forms_fresh_enabled}


async def start_poa_kyc_form(db: AsyncSession, *, user: User) -> dict[str, Any]:
    from app.application.kyc.kyc_flow_mode import should_use_poa_partner_form

    journey = await get_or_create_journey(db, user.id)
    if not should_use_poa_partner_form(journey):
        raise KycError("POA KYC form is not required for fresh KYC.", "poa_form_not_required", 400)
    if not requires_full_kyc_submission(journey):
        raise KycError("POA KYC form is not required for this journey.", "poa_form_not_required", 400)
    form_type = resolve_kyc_form_type(journey)
    settings = get_settings()
    if form_type == "fresh" and not settings.fp_poa_kyc_forms_fresh_enabled:
        raise KycError("Fresh POA KYC forms are disabled.", "poa_fresh_disabled", 400)
    form = await ensure_kyc_form(db, user=user, journey=journey)
    _sync_journey_from_form(journey, form)
    await db.flush()
    return _status_dict(form, journey)


async def get_poa_kyc_form_status(db: AsyncSession, *, user: User) -> dict[str, Any]:
    journey = await get_or_create_journey(db, user.id)
    empty = {
        "formId": None,
        "formStatus": None,
        "proofDetailsStatus": None,
        "proofFetchUrl": None,
        "partnerFieldsNeeded": [],
        "needsDigilocker": False,
        "pathADigilockerComplete": path_a_digilocker_proof_satisfied(journey),
    }
    try:
        form = await fetch_journey_kyc_form(db, journey, clear_if_missing=True)
    except FpClientError as exc:
        if is_poa_kyc_provider_unavailable_error(exc):
            return {
                **empty,
                "formId": journey.external_kyc_form_id,
                "formStatus": journey.kyc_form_status,
                "proofDetailsStatus": journey.proof_details_status,
            }
        raise
    if not form:
        return empty
    if _is_unusable_kyc_form(form):
        try:
            form = await ensure_kyc_form(db, user=user, journey=journey)
        except KycError:
            _sync_journey_from_form(journey, form)
            await db.flush()
            return _status_dict(form, journey)
    _sync_journey_from_form(journey, form)
    await db.flush()
    return _status_dict(form, journey)


async def sync_poa_kyc_form(db: AsyncSession, *, user: User) -> dict[str, Any]:
    from app.application.kyc.kyc_flow_mode import should_use_poa_partner_form

    journey = await get_or_create_journey(db, user.id)
    if not should_use_poa_partner_form(journey):
        raise KycError("POA KYC form sync is not required for fresh KYC.", "poa_form_not_required", 400)
    if not journey.external_kyc_form_id:
        raise KycError("Start POA KYC form before sync.", "poa_form_not_found", 404)

    form = await fetch_journey_kyc_form(db, journey, clear_if_missing=False)
    if not form or _is_unusable_kyc_form(form):
        form = await ensure_kyc_form(db, user=user, journey=journey)

    full_patch = build_kyc_form_patch_payload(
        user_email=user.email,
        user_phone=user.phone,
        journey=journey,
        include_geolocation=False,
    )
    patch_payload = filter_kyc_form_patch_for_requirements(form, full_patch)
    if not patch_payload and kyc_form_needs_demographic_patch(form, full_patch):
        patch_payload = full_patch
    if patch_payload:
        form_id = str(form.get("id") or journey.external_kyc_form_id or "")
        try:
            form = await patch_kyc_form(form_id, patch_payload)
        except FpClientError as exc:
            if _is_kyc_form_patch_forbidden(exc) or _is_unusable_kyc_form(form):
                form = await ensure_kyc_form(db, user=user, journey=journey)
                patch_payload = filter_kyc_form_patch_for_requirements(
                    form,
                    full_patch,
                )
                if not patch_payload and kyc_form_needs_demographic_patch(form, full_patch):
                    patch_payload = full_patch
                if patch_payload:
                    form_id = str(form.get("id") or journey.external_kyc_form_id or "")
                    try:
                        form = await patch_kyc_form(form_id, patch_payload)
                    except FpClientError as retry_exc:
                        raise KycError(
                            retry_exc.message,
                            retry_exc.code,
                            retry_exc.status_code,
                        ) from retry_exc
            else:
                raise KycError(exc.message, exc.code, exc.status_code) from exc
    form = await resolve_poa_proof_server_side(journey, form)
    _sync_journey_from_form(journey, form)
    await db.flush()
    payload = _status_dict(form, journey)
    payload["success"] = True
    return payload


async def retry_poa_proof_fetch(db: AsyncSession, *, user: User) -> dict[str, Any]:
    journey = await get_or_create_journey(db, user.id)
    if not journey.external_kyc_form_id:
        raise KycError("No POA KYC form in progress.", "poa_form_not_found", 404)
    if resolve_kyc_form_type(journey) != "modify":
        raise KycError("Proof retry is only available for KRA update journeys.", "poa_retry_modify_only", 400)
    form = await retry_kyc_form_proof_fetch(journey.external_kyc_form_id)
    _sync_journey_from_form(journey, form)
    await db.flush()
    return _status_dict(form, journey)


def build_poa_proof_web_return_url(*, form_id: str, status: str) -> str:
    from urllib.parse import urlencode

    settings = get_settings()
    base = settings.resolved_kyc_digilocker_web_return_url()
    return f"{base}?{urlencode({'poa_proof_return': '1', 'kyc_form': form_id, 'status': status})}"
