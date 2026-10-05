from __future__ import annotations

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.application.kyc.errors import KycError
from app.application.kyc.journey_gate_service import (
    is_kra_compliant_short_submit,
    require_phase2_complete,
    requires_full_kyc_submission,
    resolve_kyc_form_type,
)
from app.application.kyc.journey_state_service import (
    get_or_create_journey,
    get_or_create_status,
    mark_kyc_submitted,
)
from app.application.kyc.kyc_completion_service import on_kyc_completed
from app.infrastructure.kyc.cybrilla_terminal_log import log_kyc_step
from app.application.kyc.kyc_form_mapper import build_kyc_form_patch_payload, data_url_to_file, _full_name
from app.application.kyc.path_a_proof import (
    poa_form_proof_complete,
    poa_partner_proof_satisfied,
    skip_user_poa_proof_redirect,
    user_poa_proof_redirect_required,
)
from app.core.config import get_settings
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.kyc.kyc_forms_client import (
    create_kyc_form,
    fetch_kyc_form,
    patch_kyc_form,
    poll_kyc_form_until_created,
    poll_kyc_form_until_esign_ready,
    retry_kyc_form_proof_fetch,
    should_poll_kyc_form_for_esign,
    upload_kyc_form_signature,
)
from app.application.kyc.kyc_partner_refs import (
    append_kyc_partner_ref,
    archive_kyc_form_partner_ref,
    find_reusable_kyc_form_id_for_pan,
    record_kyc_form_partner_ref,
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


_PROOF_COMPLETE = frozenset({"fetched", "successful", "success", "completed"})


def _proof_is_complete(form: dict[str, Any]) -> bool:
    return str(_proof_status(form) or "").lower() in _PROOF_COMPLETE


def _esign_url(form: dict[str, Any]) -> str | None:
    esign = form.get("esign_details") or {}
    if isinstance(esign, dict) and esign.get("esign_url"):
        url = str(esign["esign_url"]).strip()
        return url or None
    return None


def _esign_status(form: dict[str, Any]) -> str | None:
    esign = form.get("esign_details") or {}
    if isinstance(esign, dict):
        return esign.get("status")
    return None


_ESIGN_COMPLETE_STATUSES = frozenset({"successful", "success", "completed"})


def _form_provider_submission_complete(form: dict[str, Any]) -> bool:
    if str(form.get("status") or "") != "submitted":
        return False
    esign_status = _esign_status(form)
    if esign_status is not None and str(esign_status).lower() not in _ESIGN_COMPLETE_STATUSES:
        return False
    return True


def _maybe_mark_kyc_submitted(
    *,
    user: User,
    status: Any,
    journey: Any,
    form: dict[str, Any],
) -> None:
    if _form_provider_submission_complete(form):
        mark_kyc_submitted(user=user, status=status, journey=journey)


def _sync_journey_from_form(journey: Any, form: dict[str, Any]) -> None:
    journey.external_kyc_form_id = str(form.get("id") or journey.external_kyc_form_id or "")
    journey.kyc_form_status = str(form.get("status") or "")
    journey.kyc_form_type = str(form.get("type") or journey.kyc_form_type or "")
    journey.kyc_form_failure_reason = form.get("reason")
    journey.proof_details_status = _proof_status(form)
    journey.esign_details_status = _esign_status(form)


def _kyc_form_status(form: dict[str, Any]) -> str:
    return str(form.get("status") or "").strip().lower()


def _is_unusable_kyc_form(form: dict[str, Any]) -> bool:
    return _kyc_form_status(form) in {"failed", "expired"}


def _is_kyc_form_not_found_error(exc: FpClientError) -> bool:
    text = f"{exc.message} {exc.response_data}".lower()
    return "kyc form not found" in text or (
        exc.status_code in {400, 404} and "not found" in text
    )


async def fetch_journey_kyc_form(
    db: AsyncSession,
    journey: Any,
    *,
    clear_if_missing: bool = False,
) -> dict[str, Any] | None:
    """Load the journey's bound Cybrilla kyc_form; optionally clear missing partner forms."""
    form_id = journey.external_kyc_form_id
    if not form_id:
        return None
    try:
        form = await fetch_kyc_form(form_id)
    except FpClientError as exc:
        if clear_if_missing and _is_kyc_form_not_found_error(exc):
            logger.warning(
                "[KYC] Partner kyc_form missing; clearing binding | form_id=%s | error=%s",
                form_id,
                exc.message,
            )
            await _clear_bound_kyc_form(db, journey)
            return None
        raise
    return form


async def _clear_bound_kyc_form(db: AsyncSession, journey: Any) -> None:
    if journey.external_kyc_form_id:
        archive_kyc_form_partner_ref(
            journey,
            str(journey.external_kyc_form_id),
            reason="journey_unbound",
        )
    from app.application.kyc.journey_gate_service import ensure_journey_kyc_form_type_recorded

    ensure_journey_kyc_form_type_recorded(journey)
    finprim_kyc_request = bool(str(journey.external_kyc_request_id or "").strip())

    journey.external_kyc_form_id = None
    journey.kyc_form_failure_reason = None
    journey.proof_details_status = None
    if not finprim_kyc_request:
        journey.kyc_form_status = None
        journey.esign_details_status = None
    await db.flush()
    await db.commit()


def _validate_form_for_submission(form: dict[str, Any]) -> None:
    status = _kyc_form_status(form)
    if status == "failed":
        raise KycError(
            str(form.get("reason") or "KYC form failed at the provider."),
            "kyc_form_create_failed",
            400,
        )
    if status == "expired":
        raise KycError(
            str(form.get("reason") or "KYC form has expired."),
            "kyc_form_expired",
            400,
        )
    if status == "submitted":
        raise KycError(
            "KYC form was already submitted.",
            "kyc_form_already_submitted",
            400,
        )


async def _fetch_bound_kyc_form(
    db: AsyncSession,
    journey: Any,
    form_id: str,
) -> dict[str, Any]:
    """Load an existing Cybrilla kyc_form by ID and sync the journey reference."""
    try:
        form = await fetch_kyc_form(form_id)
    except FpClientError as exc:
        logger.warning(
            "[KYC] Could not fetch kyc_form | form_id=%s | error=%s",
            form_id,
            exc.message,
        )
        if _is_kyc_form_not_found_error(exc):
            await _clear_bound_kyc_form(db, journey)
        raise KycError(
            f"Could not load KYC form {form_id}.",
            "kyc_form_not_found",
            502 if not _is_kyc_form_not_found_error(exc) else 404,
        ) from exc

    from app.application.integrations.integration_runtime import (
        cybrilla_poa_kyc_uses_sandbox_partner_credentials,
    )
    from app.application.kyc.poa_kyc_sandbox import finprim_partner_url_is_production

    if cybrilla_poa_kyc_uses_sandbox_partner_credentials() and (
        finprim_partner_url_is_production(_proof_fetch_url(form))
        or finprim_partner_url_is_production(_esign_url(form))
    ):
        await _clear_bound_kyc_form(db, journey)
        raise KycError(
            "This KYC form was created on production Finprim. "
            "Set FP_POA_*_TEST credentials and start a new sandbox form.",
            "poa_form_sandbox_mismatch",
            409,
        )

    await _persist_kyc_form_reference(db, journey, form)
    return form


async def _persist_kyc_form_reference(
    db: AsyncSession,
    journey: Any,
    form: dict[str, Any],
) -> None:
    _sync_journey_from_form(journey, form)
    record_kyc_form_partner_ref(journey, form)
    await db.flush()
    await db.commit()


async def _persist_created_form_reference(
    db: AsyncSession,
    journey: Any,
    *,
    form_id: str,
    form_type: str,
    status: str | None = None,
) -> None:
    journey.external_kyc_form_id = form_id
    journey.kyc_form_type = form_type
    journey.kyc_form_status = status or "created"
    pan = str((journey.pan_draft_json or {}).get("panNumber") or "")
    append_kyc_partner_ref(
        journey,
        kind="kyc_form",
        external_id=form_id,
        status=status or "created",
        pan=pan or None,
        extra={"form_type": form_type},
    )
    await db.flush()
    await db.commit()


async def _finalize_new_kyc_form(
    db: AsyncSession,
    journey: Any,
    *,
    created: dict[str, Any],
    form_type: str,
) -> dict[str, Any]:
    form_id = str(created["id"])
    await _persist_created_form_reference(
        db,
        journey,
        form_id=form_id,
        form_type=form_type,
        status=str(created.get("status") or "created"),
    )

    form = await poll_kyc_form_until_created(form_id)
    failure_text = _kyc_form_failure_text(form)
    print(
        f"[KYC] Polled new form | form_id={form_id} | status={form.get('status')} | reason={failure_text}",
        flush=True,
    )
    logger.info(
        "[KYC] Polled new form | form_id=%s | status=%s | reason=%s",
        form_id,
        form.get("status"),
        failure_text,
    )
    if _is_unusable_kyc_form(form) and _reason_means_existing_kyc_or_form(failure_text):
        archive_kyc_form_partner_ref(journey, form_id, reason="ongoing_conflict_stub")
        pan = str((journey.pan_draft_json or {}).get("panNumber") or "").upper()
        discovered = await _discover_live_kyc_form_for_pan(
            db,
            journey,
            pan,
            skip_ids={form_id},
        )
        if discovered:
            return discovered
        await _clear_bound_kyc_form(db, journey)
        return form

    await _persist_kyc_form_reference(db, journey, form)
    return form


def _extract_form_id_from_text(raw_text: str) -> str | None:
    matched = re.search(r"kycf_[a-zA-Z0-9_]+", raw_text)
    return matched.group(0) if matched else None


def _extract_form_id_from_error(exc: FpClientError) -> str | None:
    raw_text = f"{exc.response_data} {exc.message}"
    matched_id = _extract_form_id_from_text(raw_text)
    if matched_id:
        return matched_id

    if isinstance(exc.response_data, dict):
        resp_id = exc.response_data.get("id")
        if not resp_id and isinstance(exc.response_data.get("error"), dict):
            resp_id = exc.response_data["error"].get("id")
        if resp_id and str(resp_id).startswith("kycf_"):
            return str(resp_id)
    return None


def _kyc_form_failure_text(form: dict[str, Any]) -> str:
    parts: list[str] = []
    for key in ("reason", "failure_reason", "message"):
        value = form.get(key)
        if value:
            parts.append(str(value))
    error = form.get("error")
    if isinstance(error, dict):
        for key in ("message", "reason", "code"):
            value = error.get(key)
            if value:
                parts.append(str(value))
    elif error:
        parts.append(str(error))
    return " ".join(parts)


def _reason_means_existing_kyc_or_form(reason: str) -> bool:
    text = reason.lower()
    return any(
        token in text
        for token in (
            "ineligible_for_fresh_kyc",
            "already exists",
            "already existed",
            "ongoing kyc form",
            "kyc_form_already_exists",
            "kyc already exists",
        )
    )


def _reason_means_retry_fresh(reason: str) -> bool:
    return "ineligible_for_kyc_modification" in reason.lower()


def _is_ongoing_form_exists_error(exc: FpClientError) -> bool:
    raw_text = f"{exc.response_data} {exc.message}".lower()
    return "already exists" in raw_text or "ongoing kyc form" in raw_text


def _is_kyc_form_patch_forbidden(exc: FpClientError) -> bool:
    text = f"{exc.message} {exc.response_data}".lower()
    return "update is not allowed" in text


def _merge_kyc_form_id_candidates(*groups: list[str]) -> list[str]:
    merged: list[str] = []
    seen: set[str] = set()
    for group in groups:
        for form_id in group:
            clean = str(form_id or "").strip()
            if clean.startswith("kycf_") and clean not in seen:
                seen.add(clean)
                merged.append(clean)
    return merged


def _kyc_form_ids_in_blob(raw: object) -> list[str]:
    if raw is None:
        return []
    text = raw if isinstance(raw, str) else str(raw)
    return list(dict.fromkeys(re.findall(r"kycf_[a-zA-Z0-9_]+", text)))


def _all_known_kyc_form_ids(journey: Any, *, extra_ids: list[str] | None = None) -> list[str]:
    """Every Cybrilla kycf_* we have ever recorded on this journey (newest first)."""
    from_refs: list[str] = []
    seen: set[str] = set()
    bound = str(journey.external_kyc_form_id or "").strip()
    if bound.startswith("kycf_"):
        seen.add(bound)
        from_refs.append(bound)
    for row in reversed(list(journey.kyc_partner_external_refs_json or [])):
        if row.get("kind") != "kyc_form":
            continue
        form_id = str(row.get("external_id") or "")
        if form_id.startswith("kycf_") and form_id not in seen:
            seen.add(form_id)
            from_refs.append(form_id)
    return _merge_kyc_form_id_candidates(from_refs, list(extra_ids or []))


async def _kyc_form_ids_from_provider_logs(db: AsyncSession, user_id: UUID | None) -> list[str]:
    """Recover kycf_* ids seen in Cybrilla POA logs when partner refs were not persisted."""
    from app.infrastructure.persistence.provider_log_models import ProviderApiLog, ProviderLogSource

    def _build_query(*, scoped_user: bool):
        query = (
            select(ProviderApiLog.path, ProviderApiLog.response_summary, ProviderApiLog.request_summary)
            .where(ProviderApiLog.source == ProviderLogSource.cybrilla)
            .where(ProviderApiLog.path.like("%/poa/kyc_forms%"))
            .order_by(ProviderApiLog.created_at.desc())
            .limit(400)
        )
        if scoped_user and user_id is not None:
            query = query.where(ProviderApiLog.user_id == user_id)
        return query

    async def _collect(query) -> list[str]:
        result = await db.execute(query)
        ids: list[str] = []
        for path, response_summary, request_summary in result.all():
            ids.extend(_kyc_form_ids_in_blob(path))
            ids.extend(_kyc_form_ids_in_blob(response_summary))
            ids.extend(_kyc_form_ids_in_blob(request_summary))
        return _merge_kyc_form_id_candidates(ids)

    ids = await _collect(_build_query(scoped_user=True))
    if ids or user_id is None:
        return ids
    if get_settings().app_env != "development":
        return ids
    return await _collect(_build_query(scoped_user=False))


def _candidate_kyc_form_ids_for_pan(journey: Any, pan: str) -> list[str]:
    _ = pan
    return _all_known_kyc_form_ids(journey)


async def _discover_live_kyc_form_for_pan(
    db: AsyncSession,
    journey: Any,
    pan: str,
    *,
    skip_ids: set[str] | None = None,
) -> dict[str, Any] | None:
    """Rebind the real in-progress Cybrilla form — never create another stub."""
    skip = {item for item in (skip_ids or set()) if item}
    log_ids: list[str] = []
    user_id = getattr(journey, "user_id", None)
    if user_id:
        try:
            log_ids = await _kyc_form_ids_from_provider_logs(db, user_id)
        except Exception:
            logger.exception("[KYC] Could not load kyc_form ids from provider logs")
    candidate_ids = _all_known_kyc_form_ids(journey, extra_ids=log_ids)
    print(
        f"[KYC] Discover live kyc_form | pan={pan} | candidates={len(candidate_ids)} | skip={len(skip)}",
        flush=True,
    )
    for form_id in candidate_ids:
        if form_id in skip:
            continue
        bound = await _try_bind_usable_kyc_form(db, journey, form_id)
        if bound:
            logger.info(
                "[KYC] Rebound live kyc_form | form_id=%s | pan=%s",
                form_id,
                pan,
            )
            print(f"[KYC] Rebound live kyc_form | form_id={form_id}", flush=True)
            return bound
    print(
        "[KYC] Ongoing KYC at Cybrilla — no live form among known ids; will not create another stub",
        flush=True,
    )
    return None


def _ongoing_kyc_form_user_message() -> str:
    return (
        "A KYC application for this PAN is already open at the KRA. "
        "Continue that application from review (we will reuse your saved form link). "
        "If you did not finish earlier, wait for it to expire (about 7 days) or contact support."
    )


async def _try_bind_usable_kyc_form(
    db: AsyncSession,
    journey: Any,
    form_id: str,
) -> dict[str, Any] | None:
    if not form_id:
        return None
    try:
        form = await fetch_kyc_form(form_id)
    except FpClientError:
        return None
    if _is_unusable_kyc_form(form):
        return None
    await _persist_kyc_form_reference(db, journey, form)
    _validate_form_for_submission(form)
    return form


def _proof_redirect_action(form: dict[str, Any]) -> dict[str, Any]:
    fetch_url = _proof_fetch_url(form)
    return {
        "nextAction": "proof_redirect",
        "redirectUrl": fetch_url,
        "message": (
            "Link your KRA KYC form with DigiLocker to enable Aadhaar eSign "
            "(sandbox Finprim when configured)."
        ),
    }


def _build_next_action(form: dict[str, Any], *, journey: Any) -> dict[str, Any]:
    status = str(form.get("status") or "")
    if status == "failed":
        return {
            "nextAction": "failed",
            "message": str(form.get("reason") or "KYC submission failed."),
        }
    if _form_provider_submission_complete(form):
        return {"nextAction": "submitted", "message": "KYC submitted successfully."}
    proof_status = _proof_status(form)
    fetch_url = _proof_fetch_url(form)
    if (
        fetch_url
        and proof_status in {None, "pending", "failed"}
        and user_poa_proof_redirect_required(form, journey)
        and not skip_user_poa_proof_redirect(journey)
    ):
        return _proof_redirect_action(form)

    esign_url = _esign_url(form)
    esign_status = _esign_status(form)
    pending_esign = esign_status is None or str(esign_status).lower() in {"pending", "initiated", "in_progress"}
    if esign_url and pending_esign and status not in {"failed", "expired"}:
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

    if status == "submitted" and not _form_provider_submission_complete(form):
        return {
            "nextAction": "processing",
            "message": "Waiting for eSign confirmation from the KRA provider.",
        }

    if status in {"awaiting_submission", "under_review"}:
        return {
            "nextAction": "processing",
            "message": "KYC submission is being processed. Try again in a few seconds.",
        }

    if status == "created":
        from app.application.kyc.kyc_flow_mode import should_use_poa_partner_form

        if should_use_poa_partner_form(journey) and not poa_form_proof_complete(form):
            return {
                "nextAction": "processing",
                "message": (
                    "Waiting for KRA proof details to sync after DigiLocker. "
                    "Use sync on the review step or try again shortly."
                ),
                "proofStatus": proof_status,
            }
        return {"nextAction": "ready", "message": "KYC form is ready for submission."}

    if status == "awaiting_esign" and not esign_url:
        return {
            "nextAction": "processing",
            "message": "Preparing eSign. Try again in a few seconds.",
        }

    return {"nextAction": "processing", "message": "KYC submission is in progress."}


async def _recover_or_retry_failed_new_form(
    db: AsyncSession,
    journey: Any,
    *,
    failed_form: dict[str, Any],
    attempted_type: str,
    pan: str,
    name: str,
    dob: str,
    settings: Any,
) -> dict[str, Any]:
    reason = _kyc_form_failure_text(failed_form)
    print(
        f"[KYC] New form unusable after create | form_id={failed_form.get('id')} | type={attempted_type} | reason={reason}",
        flush=True,
    )
    logger.info(
        "[KYC] New form unusable after create | form_id=%s | type=%s | reason=%s",
        failed_form.get("id"),
        attempted_type,
        reason,
    )

    failed_id = str(failed_form.get("id") or "")
    if failed_id:
        archive_kyc_form_partner_ref(journey, failed_id, reason="failed_after_create")
    await _clear_bound_kyc_form(db, journey)

    skip_ids = {failed_id} if failed_id else set()
    other_id = _extract_form_id_from_text(reason)
    if other_id:
        skip_ids.add(other_id)
        bound = await _try_bind_usable_kyc_form(db, journey, other_id)
        if bound:
            print(
                f"[KYC] Recovered referenced form | form_id={other_id} | status={bound.get('status')}",
                flush=True,
            )
            return bound

    if _reason_means_existing_kyc_or_form(reason):
        discovered = await _discover_live_kyc_form_for_pan(
            db,
            journey,
            pan,
            skip_ids=skip_ids,
        )
        if discovered:
            return discovered
        raise KycError(
            _ongoing_kyc_form_user_message(),
            "kyc_form_already_exists",
            400,
        )

    retry_type: str | None = None
    if attempted_type == "fresh" and "ineligible_for_fresh_kyc" in reason.lower():
        retry_type = "modify"
    elif attempted_type == "modify" and _reason_means_retry_fresh(reason):
        retry_type = "fresh"

    if retry_type is None:
        raise KycError(
            reason or "KYC form could not be created.",
            "kyc_form_create_failed",
            400,
        )

    print(
        f"[KYC] Retrying create as {retry_type} after failed {attempted_type}",
        flush=True,
    )
    logger.info(
        "[KYC] Retrying create as %s after failed %s | reason=%s",
        retry_type,
        attempted_type,
        reason,
    )
    try:
        created = await create_kyc_form(
            form_type=retry_type,
            pan=pan,
            name=name,
            date_of_birth=dob,
            proof_details_callback_url=settings.resolved_kyc_proof_callback_url,
            esign_callback_url=settings.resolved_kyc_esign_callback_url,
        )
    except FpClientError as exc:
        if _is_ongoing_form_exists_error(exc):
            matched_id = _extract_form_id_from_error(exc)
            if matched_id:
                bound = await _try_bind_usable_kyc_form(db, journey, matched_id)
                if bound:
                    return bound
            discovered = await _discover_live_kyc_form_for_pan(db, journey, pan)
            if discovered:
                return discovered
            raise KycError(
                _ongoing_kyc_form_user_message(),
                "kyc_form_already_exists",
                400,
            ) from exc
        raise KycError(
            reason or str(exc.message),
            "kyc_form_create_failed",
            400,
        ) from exc

    retried = await _finalize_new_kyc_form(
        db, journey, created=created, form_type=retry_type
    )
    if _is_unusable_kyc_form(retried):
        return await _recover_or_retry_failed_new_form(
            db,
            journey,
            failed_form=retried,
            attempted_type=retry_type,
            pan=pan,
            name=name,
            dob=dob,
            settings=settings,
        )
    return retried


async def ensure_kyc_form(db: AsyncSession, *, user: User, journey: Any) -> dict[str, Any]:
    settings = get_settings()
    pan_draft = journey.pan_draft_json or {}
    pan = str(pan_draft.get("panNumber") or "").upper()
    name = _full_name(pan_draft)
    dob = str(pan_draft.get("dateOfBirth") or "").strip()
    if not pan or not name or not dob:
        raise KycError("Complete PAN verification before submitting KYC.", "pan_not_verified", 403)

    form_type = resolve_kyc_form_type(journey)
    if not settings.resolved_kyc_form_live:
        raise KycError(
            "KYC submission requires Cybrilla POA (FP_POA_*). Configure partner credentials and retry.",
            "kyc_form_provider_unavailable",
            503,
        )

    print(f"[KYC] ensure_kyc_form started | pan={pan} | form_type={form_type} | existing_form_id={journey.external_kyc_form_id} | kyc_already_registered={journey.kyc_already_registered}", flush=True)
    logger.info(
        "[KYC] ensure_kyc_form started | pan=%s | form_type=%s | existing_form_id=%s | kyc_already_registered=%s",
        pan, form_type, journey.external_kyc_form_id, journey.kyc_already_registered,
    )

    if not journey.external_kyc_form_id:
        discovered = await _discover_live_kyc_form_for_pan(db, journey, pan)
        if discovered:
            print(
                f"[KYC] Rebound live form from partner history | form_id={discovered.get('id')}",
                flush=True,
            )
            return discovered
        recovered_id = find_reusable_kyc_form_id_for_pan(journey, pan)
        if recovered_id:
            journey.external_kyc_form_id = recovered_id
            await db.flush()
            await db.commit()
            print(f"[KYC] Rebound reusable form from partner refs | form_id={recovered_id}", flush=True)

    from app.application.integrations.integration_runtime import (
        cybrilla_poa_kyc_uses_sandbox_partner_credentials,
    )
    from app.application.kyc.kyc_partner_refs import latest_kyc_form_proof_fetch_url
    from app.application.kyc.poa_kyc_sandbox import finprim_partner_url_is_production

    if journey.external_kyc_form_id and cybrilla_poa_kyc_uses_sandbox_partner_credentials():
        stored_proof_url = latest_kyc_form_proof_fetch_url(journey)
        if finprim_partner_url_is_production(stored_proof_url):
            print(
                "[KYC] Unbinding production POA kyc_form — KYC sandbox flags require FP_POA_*_TEST",
                flush=True,
            )
            await _clear_bound_kyc_form(db, journey)

    if journey.external_kyc_form_id:
        print(
            f"[KYC] Loading bound form from journey | form_id={journey.external_kyc_form_id}",
            flush=True,
        )
        logger.info(
            "[KYC] Loading bound form from journey | form_id=%s",
            journey.external_kyc_form_id,
        )
        try:
            form = await _fetch_bound_kyc_form(db, journey, journey.external_kyc_form_id)
        except KycError as exc:
            if exc.code != "poa_form_sandbox_mismatch":
                raise
            print("[KYC] Recreating POA kyc_form under sandbox credentials", flush=True)
            form = None
        if form is not None:
            print(
                f"[KYC] Bound form loaded | form_id={form.get('id')} | status={form.get('status')}",
                flush=True,
            )
        if form is not None and _is_unusable_kyc_form(form):
            bound_id = str(form.get("id") or "")
            failure_text = _kyc_form_failure_text(form)
            print(
                f"[KYC] Bound form is {_kyc_form_status(form)} | form_id={bound_id} | reason={failure_text}",
                flush=True,
            )
            logger.info(
                "[KYC] Bound form unusable | form_id=%s | status=%s | reason=%s",
                bound_id,
                form.get("status"),
                failure_text,
            )
            if bound_id:
                archive_kyc_form_partner_ref(journey, bound_id, reason="bound_form_unusable")
            await _clear_bound_kyc_form(db, journey)
            if _reason_means_existing_kyc_or_form(failure_text):
                discovered = await _discover_live_kyc_form_for_pan(
                    db,
                    journey,
                    pan,
                    skip_ids={bound_id} if bound_id else set(),
                )
                if discovered:
                    return discovered
                raise KycError(
                    _ongoing_kyc_form_user_message(),
                    "kyc_form_already_exists",
                    400,
                )
        elif form is not None:
            _validate_form_for_submission(form)
            return form

    print(f"[KYC] Creating new KYC form | pan={pan} | form_type={form_type}", flush=True)
    logger.info("[KYC] Creating new KYC form | pan=%s | form_type=%s", pan, form_type)

    import traceback as _tb
    _created: dict[str, Any] | None = None
    _kyc_create_exc: FpClientError | None = None
    try:
        _created = await create_kyc_form(
            form_type=form_type,
            pan=pan,
            name=name,
            date_of_birth=dob,
            proof_details_callback_url=settings.resolved_kyc_proof_callback_url,
            esign_callback_url=settings.resolved_kyc_esign_callback_url,
        )
        print(f"[KYC] KYC form created successfully | form_id={_created.get('id')}", flush=True)
        logger.info("[KYC] KYC form created successfully | form_id=%s", _created.get("id"))
    except FpClientError as _fp_exc:
        _kyc_create_exc = _fp_exc
        print(f"[KYC] create_kyc_form FpClientError | status_code={_fp_exc.status_code} | message={_fp_exc.message} | response_data={_fp_exc.response_data}", flush=True)
    except Exception as _other_exc:
        print(f"[KYC] create_kyc_form NON-FpClientError EXCEPTION type={type(_other_exc).__name__} | repr={repr(_other_exc)}", flush=True)
        print(_tb.format_exc(), flush=True)
        raise

    if _kyc_create_exc is not None:
        exc = _kyc_create_exc
        raw_text = f"{exc.response_data} {exc.message}"
        is_already_exists = _is_ongoing_form_exists_error(exc)
        is_ineligible_fresh = "ineligible_for_fresh_kyc" in raw_text.lower()
        is_ineligible_modify = "ineligible_for_kyc_modification" in raw_text.lower()
        print(f"[KYC] Error flags | is_already_exists={is_already_exists} | is_ineligible_fresh={is_ineligible_fresh} | is_ineligible_modify={is_ineligible_modify}", flush=True)
        logger.error(
            "[KYC] create_kyc_form FAILED | pan=%s | form_type=%s | status_code=%s | message=%s | response_data=%s",
            pan, form_type, exc.status_code, exc.message, exc.response_data,
        )

        if is_already_exists:
            matched_id_str = _extract_form_id_from_error(exc)
            print(f"[KYC] Recovered form ID from error | matched_id_str={matched_id_str}", flush=True)

            if matched_id_str:
                bound = await _try_bind_usable_kyc_form(db, journey, matched_id_str)
                if bound:
                    print(
                        f"[KYC] Bound recovered form | form_id={matched_id_str} | status={bound.get('status')}",
                        flush=True,
                    )
                    return bound
                await _clear_bound_kyc_form(db, journey)
                for candidate_id in _candidate_kyc_form_ids_for_pan(journey, pan):
                    if candidate_id == matched_id_str:
                        continue
                    bound = await _try_bind_usable_kyc_form(db, journey, candidate_id)
                    if bound:
                        return bound

            recovered = await _discover_live_kyc_form_for_pan(db, journey, pan)
            if recovered:
                return recovered

            raise KycError(
                _ongoing_kyc_form_user_message(),
                "kyc_form_already_exists",
                400,
            ) from exc
        elif is_ineligible_fresh and form_type == "fresh":
            print("[KYC] Retrying as modify due to ineligible_for_fresh_kyc", flush=True)
            try:
                _created = await create_kyc_form(
                    form_type="modify", pan=pan, name=name, date_of_birth=dob,
                    proof_details_callback_url=settings.resolved_kyc_proof_callback_url,
                    esign_callback_url=settings.resolved_kyc_esign_callback_url,
                )
                form_type = "modify"
            except FpClientError:
                raise exc
        elif is_ineligible_modify and form_type == "modify":
            print("[KYC] Retrying as fresh due to ineligible_for_kyc_modification", flush=True)
            try:
                _created = await create_kyc_form(
                    form_type="fresh", pan=pan, name=name, date_of_birth=dob,
                    proof_details_callback_url=settings.resolved_kyc_proof_callback_url,
                    esign_callback_url=settings.resolved_kyc_esign_callback_url,
                )
                form_type = "fresh"
            except FpClientError:
                raise exc
        else:
            raise exc

    assert _created is not None
    form = await _finalize_new_kyc_form(db, journey, created=_created, form_type=form_type)
    if _kyc_form_status(form) == "failed":
        return await _recover_or_retry_failed_new_form(
            db,
            journey,
            failed_form=form,
            attempted_type=form_type,
            pan=pan,
            name=name,
            dob=dob,
            settings=settings,
        )
    return form


async def submit_compliant_kyc_journey(db: AsyncSession, *, user: User) -> dict[str, Any]:
    journey = await get_or_create_journey(db, user.id)
    require_phase2_complete(journey)
    log_kyc_step(
        "submit_compliant_journey",
        kyc_already_registered=journey.kyc_already_registered,
        readiness_code=journey.readiness_code,
    )

    if not is_kra_compliant_short_submit(journey):
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
    log_kyc_step(
        "submit_kyc_form",
        requires_full=requires_full_kyc_submission(journey),
        readiness_code=journey.readiness_code,
        kyc_already_registered=journey.kyc_already_registered,
    )
    if not requires_full_kyc_submission(journey):
        return await submit_compliant_kyc_journey(db, user=user)

    from app.application.kyc.geolocation_service import lookup_ip_geolocation, validate_kyc_geolocation

    require_phase2_complete(journey)

    status = await get_or_create_status(db, user.id)
    if status.overall_status in {KycOverallStatus.submitted, KycOverallStatus.completed}:
        return {
            "nextAction": "submitted" if status.overall_status == KycOverallStatus.submitted else "completed",
            "message": "KYC was already submitted.",
            "formId": journey.external_kyc_form_id or journey.external_kyc_request_id,
            "formStatus": str(journey.kyc_form_status or journey.esign_details_status or "submitted"),
        }

    from app.application.kyc.kyc_flow_mode import should_use_poa_partner_form

    if should_use_poa_partner_form(journey) and journey.external_kyc_form_id:
        existing_form = await fetch_journey_kyc_form(db, journey, clear_if_missing=False)
        if existing_form and _kyc_form_status(existing_form) == "submitted":
            _maybe_mark_kyc_submitted(user=user, status=status, journey=journey, form=existing_form)
            await db.flush()
            return {
                "nextAction": "submitted",
                "message": "KYC form was already submitted.",
                "formId": existing_form.get("id"),
                "formStatus": "submitted",
            }

    from app.application.kyc.journey_gate_service import requires_digilocker

    if requires_digilocker(journey):
        raise KycError(
            "Complete DigiLocker on the address step before submitting KYC.",
            "digilocker_required",
            403,
        )

    if not journey.signature_draft_json:
        raise KycError("Add your signature before submitting KYC.", "signature_required", 400)
    if journey.bank_verification_status != "verified":
        raise KycError("Verify your bank account before submitting KYC.", "bank_not_verified", 403)

    if latitude is None or longitude is None:
        raise KycError(
            "Location access is required to submit KYC.",
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
    from app.application.kyc.geolocation_service import round_kyc_geo_coordinate

    journey.geolocation_json = {
        "latitude": round_kyc_geo_coordinate(latitude),
        "longitude": round_kyc_geo_coordinate(longitude),
        "accuracyMeters": accuracy_meters,
    }

    from app.application.kyc.kyc_flow_mode import should_use_poa_partner_form

    if not should_use_poa_partner_form(journey):
        from app.application.kyc.finprim_fresh_kyc_service import submit_fresh_kyc_via_finprim

        return await submit_fresh_kyc_via_finprim(db, user=user, journey=journey)

    try:
        form = await ensure_kyc_form(db, user=user, journey=journey)
        print(f"[KYC] ensure_kyc_form OK | form_id={form.get('id')} | status={form.get('status')}", flush=True)

        patch_payload = build_kyc_form_patch_payload(
            user_email=user.email,
            user_phone=user.phone,
            journey=journey,
        )
        print(f"[KYC] Calling patch_kyc_form | form_id={form.get('id')} | patch_keys={list(patch_payload.keys())}", flush=True)
        try:
            form = await patch_kyc_form(str(form["id"]), patch_payload)
            print(f"[KYC] patch_kyc_form OK | form_id={form.get('id')} | status={form.get('status')}", flush=True)
        except FpClientError as _pe:
            print(f"[KYC] patch_kyc_form FAILED | status_code={_pe.status_code} | message={_pe.message} | response_data={_pe.response_data}", flush=True)
            await _persist_kyc_form_reference(db, journey, form)
            raise
        _sync_journey_from_form(journey, form)

        from app.application.kyc.poa_kyc_form_service import resolve_poa_proof_server_side

        form = await resolve_poa_proof_server_side(journey, form)
        _sync_journey_from_form(journey, form)

        if user_poa_proof_redirect_required(form, journey):
            status = await get_or_create_status(db, user.id)
            status.review_step_status = KycStepStatus.saved
            await db.flush()
            response = _proof_redirect_action(form)
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

        signature_draft = journey.signature_draft_json or {}
        if not form.get("signature_provided"):
            data_url = str(signature_draft.get("dataUrl") or "")
            if not data_url:
                raise KycError("Signature file is missing.", "signature_required", 400)
            file_bytes, filename, content_type = data_url_to_file(data_url)
            print(f"[KYC] Uploading signature | form_id={form.get('id')}", flush=True)
            try:
                form = await upload_kyc_form_signature(
                    str(form["id"]),
                    file_bytes=file_bytes,
                    filename=filename,
                    content_type=content_type,
                )
                print(f"[KYC] upload_signature OK | status={form.get('status')}", flush=True)
            except FpClientError as _se:
                print(f"[KYC] upload_signature FAILED | status_code={_se.status_code} | message={_se.message} | response_data={_se.response_data}", flush=True)
                await _persist_kyc_form_reference(db, journey, form)
                raise
            _sync_journey_from_form(journey, form)
            form = await fetch_kyc_form(str(form["id"]))
            _sync_journey_from_form(journey, form)
        if bool(form.get("signature_provided")) and not _esign_url(form):
            if should_poll_kyc_form_for_esign(form):
                form = await poll_kyc_form_until_esign_ready(str(form["id"]))
                _sync_journey_from_form(journey, form)
            else:
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
                await db.flush()
                return response
    except FpClientError as exc:
        print(f"[KYC] submit_kyc_form FpClientError (outer) | message={exc.message} | response_data={exc.response_data}", flush=True)
        raise KycError(exc.message, exc.code, exc.status_code) from exc

    status = await get_or_create_status(db, user.id)
    status.review_step_status = KycStepStatus.saved
    status.signature_step_status = KycStepStatus.saved

    _maybe_mark_kyc_submitted(user=user, status=status, journey=journey, form=form)

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
    from app.application.kyc.kyc_flow_mode import should_use_poa_partner_form

    if not should_use_poa_partner_form(journey):
        from app.application.kyc.finprim_fresh_kyc_service import resolve_fresh_kyc_partner_status

        return await resolve_fresh_kyc_partner_status(db, user=user, journey=journey)

    form = await fetch_journey_kyc_form(db, journey, clear_if_missing=True)
    if not form:
        return {"formId": None, "formStatus": None, "nextAction": "none"}

    _sync_journey_from_form(journey, form)

    status = await get_or_create_status(db, user.id)
    _maybe_mark_kyc_submitted(user=user, status=status, journey=journey, form=form)
    await db.flush()

    settings = get_settings()
    if settings.kyc_auto_kra_check_enabled and status.overall_status == KycOverallStatus.submitted:
        from app.application.kyc.readiness_check_service import check_kra_readiness_status

        try:
            kra_result = await check_kra_readiness_status(db, user=user, force_refresh=False)
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
    from app.application.kyc.kyc_flow_mode import should_use_poa_partner_form

    if not should_use_poa_partner_form(journey):
        from app.application.kyc.finprim_fresh_kyc_service import continue_fresh_kyc_finprim_esign

        return await continue_fresh_kyc_finprim_esign(db, user=user, journey=journey)

    form = await fetch_journey_kyc_form(db, journey, clear_if_missing=True)
    if not form:
        raise KycError("No KYC form in progress.", "kyc_form_not_found", 404)

    _sync_journey_from_form(journey, form)

    proof_status = _proof_status(form)
    if proof_status == "failed":
        form = await retry_kyc_form_proof_fetch(journey.external_kyc_form_id)
        _sync_journey_from_form(journey, form)

    if bool(form.get("signature_provided")) and not _esign_url(form) and should_poll_kyc_form_for_esign(
        form
    ):
        form = await poll_kyc_form_until_esign_ready(journey.external_kyc_form_id)
        _sync_journey_from_form(journey, form)

    status = await get_or_create_status(db, user.id)
    _maybe_mark_kyc_submitted(user=user, status=status, journey=journey, form=form)

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

    if callback_status == "successful":
        form = await fetch_kyc_form(form_id)
        _sync_journey_from_form(journey, form)
        record_kyc_form_partner_ref(journey, form)
    else:
        journey.proof_details_status = "failed"
        journey.kyc_form_failure_reason = "Proof details fetch failed."
    await db.flush()


async def mark_esign_callback(db: AsyncSession, *, form_id: str, callback_status: str) -> None:
    from sqlalchemy import select

    from app.application.kyc.journey_state_service import mark_kyc_submitted
    from app.application.kyc.kyc_flow_mode import should_use_poa_partner_form
    from app.application.kyc.kyc_partner_refs import find_journey_esign_lookup_ids
    from app.infrastructure.kyc.finprim_kyc_client import fetch_finprim_esign, finprim_esign_complete
    from app.infrastructure.persistence.models import KycJourneyState

    clean_id = str(form_id or "").strip()
    if not clean_id:
        return

    result = await db.execute(
        select(KycJourneyState).where(KycJourneyState.external_kyc_form_id == clean_id)
    )
    journey = result.scalar_one_or_none()
    if journey is None:
        result = await db.execute(
            select(KycJourneyState).where(KycJourneyState.external_kyc_request_id == clean_id)
        )
        journey = result.scalar_one_or_none()
    if journey is None:
        rows = await db.execute(select(KycJourneyState))
        for candidate in rows.scalars():
            if clean_id in find_journey_esign_lookup_ids(candidate):
                journey = candidate
                break
    if not journey:
        return

    if callback_status == "successful":
        status = await get_or_create_status(db, journey.user_id)
        user = await db.get(User, journey.user_id)
        if should_use_poa_partner_form(journey) and clean_id.startswith("kycf_"):
            form = await fetch_kyc_form(clean_id)
            _sync_journey_from_form(journey, form)
            record_kyc_form_partner_ref(journey, form)
            if user:
                _maybe_mark_kyc_submitted(user=user, status=status, journey=journey, form=form)
        else:
            try:
                esign = await fetch_finprim_esign(clean_id)
                journey.esign_details_status = str(esign.get("status") or "successful")
            except FpClientError:
                journey.esign_details_status = "successful"
            if user and finprim_esign_complete({"status": journey.esign_details_status}):
                mark_kyc_submitted(user=user, status=status, journey=journey)
    else:
        journey.esign_details_status = "failed"
        journey.kyc_form_failure_reason = "eSign was not completed successfully."
    await db.flush()

