from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class MfCentralClientError(Exception):
    pass


async def request_cas_import(*, pan: str, mobile: str, email: str | None = None) -> dict[str, Any]:
    settings = get_settings()
    if not settings.zynd_mf_cas_enabled:
        return {"request_id": f"stub-cas-{pan[-4:]}", "status": "pending"}

    base = settings.zynd_mf_central_base_url.rstrip("/")
    if not base:
        raise MfCentralClientError("MF Central base URL is not configured")

    payload = {"pan": pan, "mobile": mobile}
    if email:
        payload["email"] = email

    timeout = float(settings.zynd_mf_fetch_timeout_seconds)
    headers = {"Content-Type": "application/json"}
    if settings.zynd_mf_central_api_key:
        headers["Authorization"] = f"Bearer {settings.zynd_mf_central_api_key}"

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(f"{base}/cas/request", json=payload, headers=headers)
        response.raise_for_status()
        body = response.json()
        return body if isinstance(body, dict) else {"data": body}


async def fetch_cas_payload(*, external_request_id: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.zynd_mf_cas_enabled:
        return {"holdings": []}

    base = settings.zynd_mf_central_base_url.rstrip("/")
    if not base:
        raise MfCentralClientError("MF Central base URL is not configured")

    timeout = float(settings.zynd_mf_fetch_timeout_seconds)
    headers: dict[str, str] = {}
    if settings.zynd_mf_central_api_key:
        headers["Authorization"] = f"Bearer {settings.zynd_mf_central_api_key}"

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(f"{base}/cas/{external_request_id}", headers=headers)
        response.raise_for_status()
        body = response.json()
        return body if isinstance(body, dict) else {"data": body}
