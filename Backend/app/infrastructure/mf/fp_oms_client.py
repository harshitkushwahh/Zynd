from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

import httpx

from app.application.integrations.provider_log_recorder import record_provider_api_log
from app.application.integrations.integration_runtime import get_finprim_runtime, is_finprim_enabled
from app.core.config import get_settings
from app.infrastructure.kyc.fp_clients import FpClientError, _raise_for_fp_response
from app.infrastructure.persistence.provider_log_models import ProviderLogSource

logger = logging.getLogger(__name__)

_fp_mf_token: str | None = None
_token_lock = asyncio.Lock()


def _invalidate_mf_token() -> None:
    global _fp_mf_token
    _fp_mf_token = None


def invalidate_mf_token() -> None:
    """Clear cached Finprim MF API token (e.g. after 401)."""
    _invalidate_mf_token()


def normalize_fp_user_ip(user_ip: str | None) -> str | None:
    """Finprim requires IPv4 (n.n.n.n). Normalize local/dev proxy addresses."""
    if not user_ip:
        return None
    cleaned = user_ip.strip()
    if cleaned in {"::1", "0:0:0:0:0:0:0:1"}:
        return "127.0.0.1"
    if cleaned.startswith("::ffff:"):
        candidate = cleaned.rsplit(":", 1)[-1]
        if candidate.count(".") == 3:
            return candidate
    return cleaned


async def _get_mf_token(*, force_refresh: bool = False) -> str:
    global _fp_mf_token
    if not is_finprim_enabled():
        return "stub-mf-token"

    runtime = get_finprim_runtime()
    async with _token_lock:
        if force_refresh:
            _fp_mf_token = None
        if _fp_mf_token:
            return _fp_mf_token

        url = f"{runtime.base_url.rstrip('/')}/v2/auth/{runtime.tenant}/token"
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                url,
                data={
                    "client_id": runtime.client_id,
                    "client_secret": runtime.client_secret,
                    "grant_type": "client_credentials",
                },
            )
            response.raise_for_status()
            _fp_mf_token = str(response.json()["access_token"])
        return _fp_mf_token


async def _fp_mf_request(
    method: str,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    body: dict[str, Any] | None = None,
) -> httpx.Response:
    settings = get_settings()
    runtime = get_finprim_runtime()
    url = f"{runtime.base_url.rstrip('/')}{path}"
    timeout = float(settings.zynd_mf_fetch_timeout_seconds)
    started = time.perf_counter()
    status_code: int | None = None
    success = False
    error_code: str | None = None
    response_body: Any = None

    response: httpx.Response | None = None
    try:
        for attempt in range(3):
            token = await _get_mf_token(force_refresh=attempt > 0)
            headers = {
                "Authorization": f"Bearer {token}",
                "x-tenant-id": runtime.tenant,
            }
            if method in {"POST", "PATCH"}:
                headers["Content-Type"] = "application/json"

            async with httpx.AsyncClient(timeout=timeout) as client:
                if method == "GET":
                    response = await client.get(url, headers=headers, params=params or {})
                elif method == "POST":
                    response = await client.post(url, headers=headers, json=body or {})
                else:
                    response = await client.patch(url, headers=headers, json=body or {})

            status_code = response.status_code
            try:
                response_body = response.json() if response.content else {}
            except ValueError:
                response_body = {"raw": response.text[:500]}
            success = response.is_success

            if response.status_code == 401 and attempt < 2:
                logger.info("Finprim MF token expired; refreshing and retrying %s %s", method, path)
                _invalidate_mf_token()
                continue
            return response

        assert response is not None
        return response
    except Exception:
        error_code = "fp_mf_transport_error"
        raise
    finally:
        await record_provider_api_log(
            source=ProviderLogSource.fintech_primitive,
            method=method,
            path=path,
            status_code=status_code,
            success=success,
            duration_ms=int((time.perf_counter() - started) * 1000),
            error_code=error_code,
            request_body=body or params,
            response_body=response_body,
        )


async def fp_mf_get(path: str, *, params: dict[str, Any] | None = None) -> dict[str, Any]:
    if not is_finprim_enabled():
        return {"data": [], "last": True}

    response = await _fp_mf_request("GET", path, params=params)
    _raise_for_fp_response(response)
    payload = response.json()
    return payload if isinstance(payload, dict) else {"data": payload}


async def fp_mf_post(path: str, *, body: dict[str, Any]) -> dict[str, Any]:
    if not is_finprim_enabled():
        return {"id": "stub-fp-id", "old_id": 1, "state": "under_review", **body}

    response = await _fp_mf_request("POST", path, body=body)
    _raise_for_fp_response(response)
    payload = response.json()
    return payload if isinstance(payload, dict) else {"data": payload}


async def fp_mf_patch(path: str, *, body: dict[str, Any]) -> dict[str, Any]:
    if not is_finprim_enabled():
        state = body.get("state")
        if state == "confirmed":
            return {"id": "stub-fp-id", "state": "submitted", **body}
        if "consent" in body:
            return {"id": "stub-fp-id", "state": "pending", **body}
        return {"id": "stub-fp-id", "state": "pending", **body}

    response = await _fp_mf_request("PATCH", path, body=body)
    _raise_for_fp_response(response)
    payload = response.json()
    return payload if isinstance(payload, dict) else {"data": payload}


def _extract_fp_object(payload: dict[str, Any]) -> dict[str, Any]:
    data = payload.get("data")
    if isinstance(data, dict):
        return data
    return payload


def _extract_fp_id(payload: dict[str, Any]) -> str | None:
    obj = _extract_fp_object(payload)
    value = obj.get("id")
    return str(value) if value else None


extract_fp_id = _extract_fp_id


def extract_fp_old_id(payload: dict[str, Any]) -> int | None:
    obj = _extract_fp_object(payload)
    old_id = obj.get("old_id")
    if old_id is None:
        return None
    try:
        return int(old_id)
    except (TypeError, ValueError):
        return None


def extract_fp_state(payload: dict[str, Any]) -> str | None:
    obj = _extract_fp_object(payload)
    state = obj.get("state")
    return str(state) if state is not None else None


async def create_mf_purchase(
    *,
    fp_mfia_id: str,
    scheme: str,
    amount_inr: float,
    source_ref_id: str,
    user_ip: str | None = None,
    gateway: str = "ondc",
) -> dict[str, Any]:
    settings = get_settings()
    body: dict[str, Any] = {
        "mf_investment_account": fp_mfia_id,
        "scheme": scheme,
        "amount": amount_inr,
        "gateway": gateway,
        "source_ref_id": source_ref_id,
    }
    if user_ip:
        body["user_ip"] = normalize_fp_user_ip(user_ip)
    if settings.zynd_distributor_arn.strip():
        body["distributor_arn"] = settings.zynd_distributor_arn.strip()
    if settings.zynd_distributor_euin.strip():
        body["euin"] = settings.zynd_distributor_euin.strip()

    payload = await fp_mf_post("/v2/mf_purchases", body=body)
    return {
        "fp_purchase_id": _extract_fp_id(payload),
        "fp_purchase_old_id": extract_fp_old_id(payload),
        "state": extract_fp_state(payload),
        "raw": payload,
    }


async def get_mf_purchase(fp_purchase_id: str) -> dict[str, Any]:
    return await fp_mf_get(f"/v2/mf_purchases/{fp_purchase_id}")


async def update_mf_purchase(fp_purchase_id: str, *, body: dict[str, Any]) -> dict[str, Any]:
    payload = await fp_mf_patch(
        "/v2/mf_purchases",
        body={"id": fp_purchase_id, **body},
    )
    return {
        "fp_purchase_id": _extract_fp_id(payload) or fp_purchase_id,
        "fp_purchase_old_id": extract_fp_old_id(payload),
        "state": extract_fp_state(payload),
        "raw": payload,
    }


def _parse_mf_purchase_list(payload: dict[str, Any]) -> list[dict[str, Any]]:
    data = payload.get("data")
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    return []


def _serialize_mf_purchase_item(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "fp_purchase_id": item.get("id"),
        "fp_purchase_old_id": item.get("old_id"),
        "state": item.get("state"),
        "source_ref_id": item.get("source_ref_id"),
        "scheme": item.get("scheme"),
        "raw": item,
    }


async def create_mf_purchases_batch(
    *,
    purchases: list[dict[str, Any]],
    user_ip: str | None = None,
) -> list[dict[str, Any]]:
    settings = get_settings()
    gateway = settings.zynd_mf_order_payment_gateway
    mf_purchases: list[dict[str, Any]] = []
    for purchase in purchases:
        item: dict[str, Any] = {
            "mf_investment_account": purchase["fp_mfia_id"],
            "scheme": purchase["scheme"],
            "amount": float(purchase["amount_inr"]),
            "gateway": purchase.get("gateway", gateway),
            "source_ref_id": purchase["source_ref_id"],
        }
        if user_ip:
            item["user_ip"] = normalize_fp_user_ip(user_ip)
        if settings.zynd_distributor_arn.strip():
            item["distributor_arn"] = settings.zynd_distributor_arn.strip()
        if settings.zynd_distributor_euin.strip():
            item["euin"] = settings.zynd_distributor_euin.strip()
        mf_purchases.append(item)

    if not is_finprim_enabled():
        return [
            {
                "fp_purchase_id": f"stub-fp-{index}",
                "fp_purchase_old_id": index + 1,
                "state": "under_review",
                "source_ref_id": purchase["source_ref_id"],
                "scheme": purchase["scheme"],
                "raw": purchase,
            }
            for index, purchase in enumerate(purchases)
        ]

    payload = await fp_mf_post("/v2/mf_purchases/batch", body={"mf_purchases": mf_purchases})
    return [_serialize_mf_purchase_item(item) for item in _parse_mf_purchase_list(payload)]


async def update_mf_purchases_batch(*, updates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not is_finprim_enabled():
        return [
            {
                "fp_purchase_id": update.get("id"),
                "fp_purchase_old_id": 1,
                "state": update.get("state", "submitted"),
                "source_ref_id": None,
                "scheme": None,
                "raw": update,
            }
            for update in updates
        ]

    payload = await fp_mf_patch("/v2/mf_purchases/batch", body={"mf_purchases": updates})
    return [_serialize_mf_purchase_item(item) for item in _parse_mf_purchase_list(payload)]


async def update_mf_investment_account(*, fp_mfia_id: str, body: dict[str, Any]) -> dict[str, Any]:
    payload = await fp_mf_patch(
        "/v2/mf_investment_accounts",
        body={"id": fp_mfia_id, **body},
    )
    return {
        "fp_mfia_id": _extract_fp_id(payload) or fp_mfia_id,
        "fp_mfia_old_id": extract_fp_old_id(payload),
        "raw": payload,
    }


def _serialize_mf_plan_item(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "fp_plan_id": item.get("id"),
        "state": item.get("state"),
        "source_ref_id": item.get("source_ref_id"),
        "next_installment_date": item.get("next_installment_date"),
        "raw": item,
    }


async def create_mf_purchase_plan(*, body: dict[str, Any]) -> dict[str, Any]:
    if not is_finprim_enabled():
        return {
            "fp_plan_id": "stub-mfpp-id",
            "state": "created",
            "source_ref_id": body.get("source_ref_id"),
            "next_installment_date": None,
            "raw": body,
        }

    payload = await fp_mf_post("/v2/mf_purchase_plans", body=body)
    obj = _extract_fp_object(payload)
    return _serialize_mf_plan_item(obj)


async def get_mf_purchase_plan(fp_plan_id: str) -> dict[str, Any]:
    return await fp_mf_get(f"/v2/mf_purchase_plans/{fp_plan_id}")


async def update_mf_purchase_plan(*, body: dict[str, Any]) -> dict[str, Any]:
    if not is_finprim_enabled():
        state = body.get("state")
        if state == "confirmed":
            return {
                "fp_plan_id": body.get("id", "stub-mfpp-id"),
                "state": "active",
                "source_ref_id": None,
                "next_installment_date": None,
                "raw": body,
            }
        if "consent" in body:
            return {
                "fp_plan_id": body.get("id", "stub-mfpp-id"),
                "state": "review_completed",
                "source_ref_id": None,
                "next_installment_date": None,
                "raw": body,
            }
        return {
            "fp_plan_id": body.get("id", "stub-mfpp-id"),
            "state": "review_completed",
            "source_ref_id": None,
            "next_installment_date": None,
            "raw": body,
        }

    payload = await fp_mf_patch("/v2/mf_purchase_plans", body=body)
    obj = _extract_fp_object(payload)
    return _serialize_mf_plan_item(obj)


async def cancel_mf_purchase_plan(*, fp_plan_id: str, cancellation_code: str = "investor_request") -> dict[str, Any]:
    body = {"id": fp_plan_id, "cancellation_code": cancellation_code}
    if not is_finprim_enabled():
        return {
            "fp_plan_id": fp_plan_id,
            "state": "cancelled",
            "source_ref_id": None,
            "next_installment_date": None,
            "raw": body,
        }

    payload = await fp_mf_post("/v2/mf_purchase_plans/cancel", body=body)
    obj = _extract_fp_object(payload)
    return _serialize_mf_plan_item(obj)


async def create_mf_investment_account(*, investor_profile_id: str) -> dict[str, Any]:
    body = {
        "primary_investor": investor_profile_id,
        "holding_pattern": "single",
    }
    payload = await fp_mf_post("/v2/mf_investment_accounts", body=body)
    return {
        "fp_mfia_id": _extract_fp_id(payload),
        "fp_mfia_old_id": extract_fp_old_id(payload),
        "raw": payload,
    }


async def list_fund_schemes(*, page: int = 1, size: int = 100) -> dict[str, Any]:
    return await fp_mf_get("/api/oms/fund_schemes", params={"page": page, "size": size})


async def get_fund_scheme_by_isin(isin: str) -> dict[str, Any]:
    return await fp_mf_get(f"/api/oms/fund_schemes/{isin.upper()}")
