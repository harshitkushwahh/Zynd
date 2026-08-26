"""Finprim payment gateway client (PG APIs — numeric IDs)."""

from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.infrastructure.mf.fp_oms_client import fp_mf_get, fp_mf_post


def _extract_payment_id(payload: dict[str, Any]) -> int | None:
    value = payload.get("id")
    if value is None:
        data = payload.get("data")
        if isinstance(data, dict):
            value = data.get("id")
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def extract_payment_status(payload: dict[str, Any]) -> str | None:
    status = payload.get("status")
    if status is not None:
        return str(status)
    data = payload.get("data")
    if isinstance(data, dict) and data.get("status") is not None:
        return str(data["status"])
    return None


def is_payment_success_status(status: str | None) -> bool:
    normalized = (status or "").strip().upper()
    return normalized in {"SUCCESS", "SUCCEEDED", "COMPLETED", "APPROVED"}


def extract_payment_token_url(payload: dict[str, Any]) -> str | None:
    token_url = payload.get("token_url")
    if token_url:
        return str(token_url)
    upi = payload.get("upi")
    if isinstance(upi, dict) and upi.get("uri"):
        return str(upi["uri"])
    data = payload.get("data")
    if isinstance(data, dict):
        return extract_payment_token_url(data)
    return None


async def create_netbanking_payment(
    *,
    amc_order_ids: list[int],
    bank_account_id: int,
    method: str = "UPI",
    provider_name: str = "ONDC",
    payment_postback_url: str | None = None,
) -> dict[str, Any]:
    settings = get_settings()
    body: dict[str, Any] = {
        "amc_order_ids": amc_order_ids,
        "bank_account_id": bank_account_id,
        "method": method,
        "provider_name": provider_name,
    }
    if payment_postback_url:
        body["payment_postback_url"] = payment_postback_url
    elif settings.resolved_mf_payment_postback_url:
        body["payment_postback_url"] = settings.resolved_mf_payment_postback_url

    if not settings.resolved_fp_enabled:
        amount = sum(amc_order_ids)  # stub only
        return {
            "id": 1001,
            "token_url": f"upi://pay?pa=stub@bank&am={amount}.00&cu=INR",
            "raw": body,
        }

    payload = await fp_mf_post("/api/pg/payments/netbanking", body=body)
    return {
        "id": _extract_payment_id(payload),
        "token_url": extract_payment_token_url(payload),
        "raw": payload,
    }


async def get_payment(fp_payment_id: int) -> dict[str, Any]:
    settings = get_settings()
    if not settings.resolved_fp_enabled:
        return {
            "id": fp_payment_id,
            "status": "PENDING",
            "upi": {"type": "uri", "uri": f"upi://pay?pa=stub@bank&tr={fp_payment_id}&cu=INR"},
        }
    return await fp_mf_get(f"/api/pg/payments/{fp_payment_id}")
