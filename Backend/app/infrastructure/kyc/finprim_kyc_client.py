from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.infrastructure.kyc.fp_clients import FpClientError, fp_get, fp_patch, fp_post, fp_post_multipart


def finprim_esign_redirect_url(payload: dict[str, Any]) -> str | None:
    for key in ("redirect_url", "esign_url", "signing_url"):
        raw = payload.get(key)
        if raw:
            return str(raw).strip()
    fetch = payload.get("fetch") or {}
    if isinstance(fetch, dict) and fetch.get("redirect_url"):
        return str(fetch["redirect_url"]).strip()
    signing = payload.get("signing") or {}
    if isinstance(signing, dict) and signing.get("redirect_url"):
        return str(signing["redirect_url"]).strip()
    return None


async def patch_kyc_request(kyc_request_id: str, body: dict[str, Any]) -> dict[str, Any]:
    return await fp_patch(f"/v2/kyc_requests/{kyc_request_id}", body, use_poa=False)


async def fetch_kyc_request(kyc_request_id: str) -> dict[str, Any]:
    return await fp_get(f"/v2/kyc_requests/{kyc_request_id}", use_poa=False)


async def upload_finprim_kyc_file(
    *,
    file_bytes: bytes,
    filename: str,
    content_type: str,
) -> dict[str, Any]:
    """Upload via KYC tenant ``POST {base}/files`` (MultiPlus parity — not ``/v2/files``)."""
    return await fp_post_multipart(
        "/files",
        fields={},
        files={"file": (filename, file_bytes, content_type)},
        use_poa=False,
    )


async def upload_kyc_request_signature(
    kyc_request_id: str,
    *,
    file_bytes: bytes,
    filename: str,
    content_type: str,
) -> dict[str, Any]:
    return await fp_post_multipart(
        f"/v2/kyc_requests/{kyc_request_id}/signature",
        fields={},
        files={"file": (filename, file_bytes, content_type)},
        use_poa=False,
    )


async def create_finprim_esign(*, kyc_request_id: str, postback_url: str) -> dict[str, Any]:
    settings = get_settings()
    body: dict[str, Any] = {
        "kyc_request": kyc_request_id,
        "postback_url": postback_url,
    }
    if settings.resolved_kyc_esign_callback_url:
        body["postback_url"] = postback_url or settings.resolved_kyc_esign_callback_url
    return await fp_post("/v2/esigns", body, use_poa=False)


async def fetch_finprim_esign(esign_id: str) -> dict[str, Any]:
    return await fp_get(f"/v2/esigns/{esign_id}", use_poa=False)


def finprim_esign_complete(payload: dict[str, Any]) -> bool:
    status = str(payload.get("status") or "").lower()
    return status in {"successful", "success", "completed", "signed"}
