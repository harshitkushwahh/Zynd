"""Finprim payment gateway client (PG APIs — numeric IDs)."""

from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.infrastructure.core.mf.oms_client import fp_mf_get, fp_mf_post
from app.infrastructure.core.mf.pg_payload import extract_numeric_id, extract_status, extract_token_url


def _extract_payment_id(payload: dict[str, Any]) -> int | None:
    return extract_numeric_id(payload)


def extract_payment_status(payload: dict[str, Any]) -> str | None:
    return extract_status(payload, "status")


def is_payment_success_status(status: str | None) -> bool:
    normalized = (status or "").strip().upper()
    return normalized in {"SUCCESS", "SUCCEEDED", "COMPLETED", "APPROVED"}


def is_payment_failure_status(status: str | None) -> bool:
    normalized = (status or "").strip().upper()
    return normalized in {
        "FAILED",
        "FAILURE",
        "CANCELLED",
        "CANCELED",
        "EXPIRED",
        "REJECTED",
        "DECLINED",
        "TIMEOUT",
        "TIMED_OUT",
    }


def is_payment_pending_status(status: str | None) -> bool:
    normalized = (status or "").strip().upper()
    return normalized in {"PENDING", "INITIATED", "CREATED", "IN_PROGRESS", ""}


def extract_payment_token_url(payload: dict[str, Any]) -> str | None:
    return extract_token_url(payload)


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
