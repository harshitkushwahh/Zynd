from __future__ import annotations

import asyncio
from typing import Any

from app.core.config import get_settings
from app.infrastructure.kyc.fp_clients import fp_get, fp_patch, fp_post, fp_post_multipart
from app.infrastructure.kyc.stub_provider import (
    stub_create_kyc_form,
    stub_fetch_kyc_form,
    stub_patch_kyc_form,
    stub_retry_kyc_form_proof,
    stub_upload_kyc_form_signature,
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
    settings = get_settings()
    if not settings.resolved_kyc_provider_live:
        return await stub_create_kyc_form(
            form_type=form_type,
            pan=pan,
            name=name,
            date_of_birth=date_of_birth,
            proof_details_callback_url=proof_details_callback_url,
            esign_callback_url=esign_callback_url,
        )

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
    if not settings.resolved_kyc_provider_live:
        return await stub_patch_kyc_form(form_id, payload)

    return await fp_patch("/poa/kyc_forms", payload, use_poa=True)


async def fetch_kyc_form(form_id: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.resolved_kyc_provider_live:
        return await stub_fetch_kyc_form(form_id)

    return await fp_get(f"/poa/kyc_forms/{form_id}", use_poa=True)


async def upload_kyc_form_signature(
    form_id: str,
    *,
    file_bytes: bytes,
    filename: str,
    content_type: str,
) -> dict[str, Any]:
    settings = get_settings()
    if not settings.resolved_kyc_provider_live:
        return await stub_upload_kyc_form_signature(form_id)

    return await fp_post_multipart(
        f"/poa/kyc_forms/{form_id}/signature",
        fields={},
        files={"file": (filename, file_bytes, content_type)},
        use_poa=True,
    )


async def retry_kyc_form_proof_fetch(form_id: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.resolved_kyc_provider_live:
        return await stub_retry_kyc_form_proof(form_id)

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
