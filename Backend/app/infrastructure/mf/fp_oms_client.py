from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import get_settings
from app.infrastructure.kyc.fp_clients import FpClientError, _raise_for_fp_response

logger = logging.getLogger(__name__)

_fp_mf_token: str | None = None


async def _get_mf_token() -> str:
    global _fp_mf_token
    settings = get_settings()
    if not settings.resolved_fp_enabled:
        return "stub-mf-token"
    if _fp_mf_token:
        return _fp_mf_token

    url = f"{settings.fp_base_url.rstrip('/')}/v2/auth/{settings.fp_tenant}/token"
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            url,
            data={
                "client_id": settings.fp_client_id,
                "client_secret": settings.fp_client_secret,
                "grant_type": "client_credentials",
            },
        )
        response.raise_for_status()
        _fp_mf_token = str(response.json()["access_token"])
    return _fp_mf_token


async def fp_mf_get(path: str, *, params: dict[str, Any] | None = None) -> dict[str, Any]:
    settings = get_settings()
    if not settings.resolved_fp_enabled:
        return {"data": [], "last": True}

    token = await _get_mf_token()
    async with httpx.AsyncClient(timeout=float(settings.zynd_mf_fetch_timeout_seconds)) as client:
        response = await client.get(
            f"{settings.fp_base_url.rstrip('/')}{path}",
            headers={
                "Authorization": f"Bearer {token}",
                "x-tenant-id": settings.fp_tenant,
            },
            params=params or {},
        )
        _raise_for_fp_response(response)
        payload = response.json()
        return payload if isinstance(payload, dict) else {"data": payload}


async def fp_mf_post(path: str, *, body: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    if not settings.resolved_fp_enabled:
        return {"id": "stub-fp-id", "state": "pending", **body}

    token = await _get_mf_token()
    async with httpx.AsyncClient(timeout=float(settings.zynd_mf_fetch_timeout_seconds)) as client:
        response = await client.post(
            f"{settings.fp_base_url.rstrip('/')}{path}",
            headers={
                "Authorization": f"Bearer {token}",
                "x-tenant-id": settings.fp_tenant,
                "Content-Type": "application/json",
            },
            json=body,
        )
        _raise_for_fp_response(response)
        payload = response.json()
        return payload if isinstance(payload, dict) else {"data": payload}


def _extract_fp_id(payload: dict[str, Any]) -> str | None:
    for key in ("id",):
        value = payload.get(key)
        if value:
            return str(value)
    data = payload.get("data")
    if isinstance(data, dict) and data.get("id"):
        return str(data["id"])
    return None


async def create_mf_purchase(
    *,
    fp_mfia_id: str,
    scheme: str,
    amount_inr: float,
    user_ip: str | None = None,
    gateway: str = "ondc",
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "mf_investment_account": fp_mfia_id,
        "scheme": scheme,
        "amount": amount_inr,
        "gateway": gateway,
    }
    if user_ip:
        body["user_ip"] = user_ip
    payload = await fp_mf_post("/v2/mf_purchases", body=body)
    fp_id = _extract_fp_id(payload)
    state = payload.get("state") or (payload.get("data") or {}).get("state")
    return {"fp_purchase_id": fp_id, "state": state, "raw": payload}


async def get_mf_purchase(fp_purchase_id: str) -> dict[str, Any]:
    return await fp_mf_get(f"/v2/mf_purchases/{fp_purchase_id}")


async def create_mf_investment_account(*, investor_profile_id: str) -> dict[str, Any]:
    body = {"primary_investor_profile": investor_profile_id}
    payload = await fp_mf_post("/v2/mf_investment_accounts", body=body)
    fp_id = _extract_fp_id(payload)
    return {"fp_mfia_id": fp_id, "raw": payload}


async def list_fund_schemes(*, page: int = 1, size: int = 100) -> dict[str, Any]:
    return await fp_mf_get("/api/oms/fund_schemes", params={"page": page, "size": size})


async def get_fund_scheme_by_isin(isin: str) -> dict[str, Any]:
    return await fp_mf_get(f"/api/oms/fund_schemes/{isin.upper()}")
