from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)

_TERMINAL_KYC_FORM_STATUSES = frozenset({"failed", "expired", "submitted"})
_REUSABLE_KYC_FORM_STATUSES = frozenset(
    {"under_review", "created", "awaiting_esign", "awaiting_submission"}
)


def _pick_reusable_kyc_form(candidates: list[dict[str, Any]]) -> dict[str, Any] | None:
    reusable = [
        form
        for form in candidates
        if str(form.get("status") or "") in _REUSABLE_KYC_FORM_STATUSES
        or (
            str(form.get("status") or "") not in _TERMINAL_KYC_FORM_STATUSES
            and str(form.get("status") or "")
        )
    ]
    if not reusable:
        return None
    return reusable[-1]

from app.core.config import get_settings
from app.infrastructure.kyc.cybrilla_terminal_log import log_poa_operation
from app.infrastructure.kyc.fp_clients import FpClientError, fp_get, fp_patch, fp_post, fp_post_multipart


def _require_kyc_form_live() -> None:
    from app.application.integrations.integration_runtime import (
        cybrilla_poa_kyc_configuration_message,
        is_cybrilla_poa_kyc_live,
    )

    if not get_settings().resolved_kyc_form_live or not is_cybrilla_poa_kyc_live():
        raise FpClientError(
            cybrilla_poa_kyc_configuration_message(),
            "kyc_form_provider_unavailable",
            503,
        )


async def create_kyc_form(
    *,
    form_type: str,
    pan: str,
    name: str,
    date_of_birth: str,
    proof_details_callback_url: str,
    esign_callback_url: str,
) -> dict[str, Any]:
    live = get_settings().resolved_kyc_form_live
    log_poa_operation("kyc_form_create", live=live, form_type=form_type, pan=pan)
    _require_kyc_form_live()

    return await fp_post(
        "/poa/kyc_forms",
        {
            "type": form_type,
            "pan": pan.upper(),
            "name": name,
            "date_of_birth": date_of_birth,
            "proof_details_callback_url": proof_details_callback_url,
            "esign_callback_url": esign_callback_url,
        },
        use_poa=True,
    )


async def patch_kyc_form(form_id: str, body: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    payload = {"id": form_id, **body}
    live = settings.resolved_kyc_form_live
    log_poa_operation("kyc_form_patch", live=live, form_id=form_id, patch_keys=list(body.keys()))
    _require_kyc_form_live()

    return await fp_patch("/poa/kyc_forms", payload, use_poa=True)


async def fetch_kyc_form(form_id: str) -> dict[str, Any]:
    settings = get_settings()
    live = settings.resolved_kyc_form_live
    log_poa_operation("kyc_form_fetch", live=live, form_id=form_id)
    _require_kyc_form_live()

    return await fp_get(f"/poa/kyc_forms/{form_id}", use_poa=True)


async def find_kyc_form_by_pan(pan: str) -> dict[str, Any] | None:
    settings = get_settings()
    clean_pan = pan.strip().upper()
    if not clean_pan:
        return None
    if not settings.resolved_kyc_form_live:
        return None

    # Cybrilla gateway does not expose GET /poa/kyc_forms?pan=; reuse via stored form ID instead.
    logger.debug(
        "[KYC] find_kyc_form_by_pan | PAN list lookup skipped (endpoint unavailable) | pan=%s",
        clean_pan,
    )
    return None


async def upload_kyc_form_signature(
    form_id: str,
    *,
    file_bytes: bytes,
    filename: str,
    content_type: str,
) -> dict[str, Any]:
    settings = get_settings()
    live = settings.resolved_kyc_form_live
    log_poa_operation("kyc_form_upload_signature", live=live, form_id=form_id, filename=filename)
    _require_kyc_form_live()

    return await fp_post_multipart(
        f"/poa/kyc_forms/{form_id}/signature",
        fields={},
        files={"file": (filename, file_bytes, content_type)},
        use_poa=True,
    )


async def retry_kyc_form_proof_fetch(form_id: str) -> dict[str, Any]:
    settings = get_settings()
    _require_kyc_form_live()

    return await fp_post(f"/poa/kyc_forms/{form_id}/retry_proof_details_fetch", {}, use_poa=True)


async def poll_kyc_form_until_created(form_id: str, *, max_attempts: int = 20) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    for attempt in range(max_attempts):
        payload = await fetch_kyc_form(form_id)
        status = str(payload.get("status") or "")
        if status in {"created", "awaiting_esign", "awaiting_submission", "submitted", "failed", "expired"}:
            return payload
        if status == "failed":
            return payload
        await asyncio.sleep(min(0.25 * (attempt + 1), 2.0))
    return payload


def _esign_url_from_form(payload: dict[str, Any]) -> str | None:
    esign = payload.get("esign_details") or {}
    if isinstance(esign, dict) and esign.get("esign_url"):
        return str(esign["esign_url"])
    return None


_PROOF_COMPLETE_FOR_ESIGN = frozenset({"fetched", "successful", "success", "completed"})


def _proof_status_from_form(payload: dict[str, Any]) -> str:
    proof = payload.get("proof_details") or {}
    if isinstance(proof, dict):
        return str(proof.get("status") or "").lower()
    return ""


def should_poll_kyc_form_for_esign(payload: dict[str, Any]) -> bool:
    """Cybrilla exposes eSign only after POA proof completes — polling while proof=pending is useless."""
    if _esign_url_from_form(payload):
        return False
    status = str(payload.get("status") or "")
    if status in {"failed", "expired", "submitted"}:
        return False
    proof_status = _proof_status_from_form(payload)
    if proof_status not in _PROOF_COMPLETE_FOR_ESIGN:
        return False
    if status in {"awaiting_esign", "under_review", "awaiting_submission"}:
        return True
    if proof_status in _PROOF_COMPLETE_FOR_ESIGN:
        return True
    return False


async def poll_kyc_form_until_esign_ready(form_id: str, *, max_attempts: int = 8) -> dict[str, Any]:
    payload = await fetch_kyc_form(form_id)
    if not should_poll_kyc_form_for_esign(payload):
        return payload
    for attempt in range(1, max_attempts):
        status = str(payload.get("status") or "")
        if status in {"failed", "expired", "submitted"}:
            return payload
        if _esign_url_from_form(payload):
            return payload
        if status == "awaiting_esign":
            return payload
        await asyncio.sleep(min(0.35 * attempt, 2.0))
        payload = await fetch_kyc_form(form_id)
    return payload

