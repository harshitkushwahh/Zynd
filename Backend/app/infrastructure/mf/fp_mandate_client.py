"""Finprim mandate PG client."""

from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.infrastructure.mf.fp_oms_client import fp_mf_get, fp_mf_post


def _extract_mandate_id(payload: dict[str, Any]) -> int | None:
    value = payload.get("id")
    if value is None:
        data = payload.get("data")
        if isinstance(data, dict):
            value = data.get("id")
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def extract_mandate_status(payload: dict[str, Any]) -> str | None:
    for key in ("mandate_status", "status"):
        value = payload.get(key)
        if value is not None:
            return str(value)
    data = payload.get("data")
    if isinstance(data, dict):
        return extract_mandate_status(data)
    return None


def extract_mandate_auth_url(payload: dict[str, Any]) -> str | None:
    token_url = payload.get("token_url")
    if token_url:
        return str(token_url)
    upi = payload.get("upi")
    if isinstance(upi, dict) and upi.get("uri"):
        return str(upi["uri"])
    data = payload.get("data")
    if isinstance(data, dict):
        return extract_mandate_auth_url(data)
    return None


async def create_mandate(
    *,
    bank_account_id: int,
    mandate_limit: int,
    mandate_type: str = "UPI",
    provider_name: str | None = None,
) -> dict[str, Any]:
    settings = get_settings()
    body: dict[str, Any] = {
        "mandate_type": mandate_type,
        "bank_account_id": int(bank_account_id),
        "mandate_limit": int(mandate_limit),
    }
    provider = provider_name or settings.zynd_mf_mandate_provider
    if provider:
        body["provider_name"] = provider

    if not settings.resolved_fp_enabled:
        return {"id": 2001, "raw": body}

    payload = await fp_mf_post("/api/pg/mandates", body=body)
    return {"id": _extract_mandate_id(payload), "raw": payload}


async def authorize_mandate(
    *,
    mandate_id: int,
    payment_postback_url: str | None = None,
) -> dict[str, Any]:
    settings = get_settings()
    body: dict[str, Any] = {"mandate_id": int(mandate_id)}
    if payment_postback_url:
        body["payment_postback_url"] = payment_postback_url
    elif settings.resolved_mf_sip_mandate_postback_url:
        body["payment_postback_url"] = settings.resolved_mf_sip_mandate_postback_url

    if not settings.resolved_fp_enabled:
        return {
            "id": mandate_id,
            "token_url": f"upi://mandate?pa=stub@bank&mn=Zynd&am={mandate_id}&cu=INR",
            "raw": body,
        }

    payload = await fp_mf_post("/api/pg/payments/emandate/auth", body=body)
    return {
        "id": _extract_mandate_id(payload),
        "token_url": extract_mandate_auth_url(payload),
        "raw": payload,
    }


async def get_mandate(fp_mandate_id: int) -> dict[str, Any]:
    settings = get_settings()
    if not settings.resolved_fp_enabled:
        return {
            "id": fp_mandate_id,
            "mandate_status": "APPROVED",
            "bank_account_id": 1,
        }
    return await fp_mf_get(f"/api/pg/mandates/{fp_mandate_id}")


async def cancel_mandate(fp_mandate_id: int) -> dict[str, Any]:
    settings = get_settings()
    if not settings.resolved_fp_enabled:
        return {"id": fp_mandate_id, "mandate_status": "CANCELLED"}
    return await fp_mf_post(f"/api/pg/mandates/{fp_mandate_id}/cancel", body={})
