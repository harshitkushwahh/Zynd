"""Finprim mandate PG client."""

from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.infrastructure.core.mf.oms_client import fp_mf_get, fp_mf_post
from app.infrastructure.core.mf.pg_payload import extract_numeric_id, extract_status, extract_token_url


def _extract_mandate_id(payload: dict[str, Any]) -> int | None:
    return extract_numeric_id(payload)


def extract_mandate_status(payload: dict[str, Any]) -> str | None:
    return extract_status(payload, "mandate_status", "status")


def extract_mandate_auth_url(payload: dict[str, Any]) -> str | None:
    return extract_token_url(payload)


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
