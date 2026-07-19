from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from typing import Any

import httpx

from app.application.integrations.provider_log_recorder import record_provider_api_log
from app.application.integrations.integration_runtime import (
    get_cybrilla_runtime,
    get_finprim_runtime,
    is_cybrilla_poa_live,
    is_kyckart_live,
)
from app.core.config import get_settings
from app.infrastructure.kyc.stub_provider import (
    stub_create_kyc_request,
    stub_fetch_identity_document,
    stub_ifsc_lookup,
    stub_pincode_lookup,
    stub_states,
    stub_countries,
)
from app.infrastructure.persistence.provider_log_models import ProviderLogSource


class FpClientError(Exception):
    def __init__(self, message: str, code: str = "fp_client_error", status_code: int = 502) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


def _parse_fp_error_message(payload: Any, *, fallback: str) -> str:
    if not isinstance(payload, dict):
        return fallback

    error_block = payload.get("error")
    if isinstance(error_block, dict):
        errors = error_block.get("errors")
        if isinstance(errors, list):
            messages: list[str] = []
            for item in errors:
                if not isinstance(item, dict):
                    continue
                field = str(item.get("field") or "").strip()
                message = str(item.get("message") or "").strip()
                if field and message:
                    messages.append(f"{field}: {message}")
                elif message:
                    messages.append(message)
            if messages:
                return "; ".join(messages)
        message = str(error_block.get("message") or "").strip()
        if message:
            return message

    detail = payload.get("detail")
    if isinstance(detail, dict):
        message = str(detail.get("message") or "").strip()
        if message:
            return message
    if isinstance(detail, str) and detail.strip():
        return detail.strip()

    message = str(payload.get("message") or "").strip()
    return message or fallback


def _raise_for_fp_response(response: httpx.Response) -> None:
    if not response.is_error:
        return
    fallback = "Verification service rejected the request. Check your details and try again."
    try:
        payload = response.json()
    except ValueError:
        payload = None
    message = _parse_fp_error_message(payload, fallback=fallback)
    raise FpClientError(message, "fp_client_error", response.status_code)


class FpTokenService:
    def __init__(self) -> None:
        self._kyc_token: str | None = None
        self._poa_token: str | None = None

    async def get_kyc_token(self) -> str:
        if not is_kyckart_live():
            return "stub-kyc-token"
        if self._kyc_token:
            return self._kyc_token
        runtime = get_finprim_runtime()
        token = await self._fetch_token(
            token_base_url=runtime.base_url,
            auth_tenant=runtime.tenant,
            client_id=runtime.client_id,
            client_secret=runtime.client_secret,
        )
        self._kyc_token = token
        return token

    async def get_poa_token(self) -> str:
        if not is_cybrilla_poa_live():
            return "stub-poa-token"
        if self._poa_token:
            return self._poa_token
        runtime = get_cybrilla_runtime()
        token = await self._fetch_token(
            token_base_url=runtime.resolved_token_base_url,
            auth_tenant=runtime.auth_tenant,
            client_id=runtime.client_id,
            client_secret=runtime.client_secret,
        )
        self._poa_token = token
        return token

    def invalidate(self) -> None:
        self._kyc_token = None
        self._poa_token = None

    async def _fetch_token(
        self,
        *,
        token_base_url: str,
        auth_tenant: str,
        client_id: str,
        client_secret: str,
    ) -> str:
        url = f"{token_base_url.rstrip('/')}/v2/auth/{auth_tenant}/token"
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                url,
                data={"client_id": client_id, "client_secret": client_secret, "grant_type": "client_credentials"},
            )
            response.raise_for_status()
            payload = response.json()
        return str(payload["access_token"])


_fp_tokens = FpTokenService()


def invalidate_fp_tokens() -> None:
    _fp_tokens.invalidate()


async def _record_fp_client_log(
    *,
    method: str,
    path: str,
    use_poa: bool,
    started: float,
    status_code: int | None,
    success: bool,
    error_code: str | None = None,
    request_body: Any = None,
    response_body: Any = None,
) -> None:
    await record_provider_api_log(
        source=ProviderLogSource.cybrilla if use_poa else ProviderLogSource.fintech_primitive,
        method=method,
        path=path,
        status_code=status_code,
        success=success,
        duration_ms=int((time.perf_counter() - started) * 1000),
        error_code=error_code,
        request_body=request_body,
        response_body=response_body,
    )


async def _run_logged_fp_request(
    *,
    method: str,
    path: str,
    use_poa: bool,
    request_body: Any,
    runner: Callable[[], Awaitable[httpx.Response]],
) -> dict[str, Any]:
    started = time.perf_counter()
    status_code: int | None = None
    success = False
    error_code: str | None = None
    response_body: Any = None
    try:
        response = await runner()
        status_code = response.status_code
        try:
            response_body = response.json() if response.content else {}
        except ValueError:
            response_body = {"raw": response.text[:500]}
        _raise_for_fp_response(response)
        success = True
        return response_body if isinstance(response_body, dict) else {"data": response_body}
    except FpClientError as exc:
        status_code = exc.status_code
        error_code = exc.code
        raise
    except Exception:
        error_code = "fp_transport_error"
        raise
    finally:
        await _record_fp_client_log(
            method=method,
            path=path,
            use_poa=use_poa,
            started=started,
            status_code=status_code,
            success=success,
            error_code=error_code,
            request_body=request_body,
            response_body=response_body,
        )


def _normalize_state_row(item: dict[str, Any]) -> dict[str, str] | None:
    name = str(item.get("name") or item.get("state_name") or "").strip()
    if not name:
        return None
    return {
        "name": name,
        "state_code": str(item.get("state_code") or item.get("code") or "").strip(),
        "country_ansi_code": str(item.get("country_ansi_code") or "IN"),
    }


def _normalize_country_row(item: dict[str, Any]) -> dict[str, str] | None:
    name = str(item.get("name") or "").strip()
    ansi_code = str(item.get("ansi_code") or item.get("country_ansi_code") or "").strip()
    if not name or not ansi_code:
        return None
    return {"name": name, "ansi_code": ansi_code}


async def ensure_kyc_tokens() -> None:
    await _fp_tokens.get_kyc_token()
    await _fp_tokens.get_poa_token()


async def fp_get(path: str, *, use_poa: bool = False) -> dict[str, Any]:
    token = await (_fp_tokens.get_poa_token() if use_poa else _fp_tokens.get_kyc_token())
    if use_poa:
        runtime = get_cybrilla_runtime()
        base = runtime.base_url
        tenant = runtime.auth_tenant
    else:
        runtime = get_finprim_runtime()
        base = runtime.base_url
        tenant = runtime.tenant

    async def runner() -> httpx.Response:
        async with httpx.AsyncClient(timeout=30.0) as client:
            return await client.get(
                f"{base.rstrip('/')}{path}",
                headers={"Authorization": f"Bearer {token}", "x-tenant-id": tenant},
            )

    return await _run_logged_fp_request(
        method="GET",
        path=path,
        use_poa=use_poa,
        request_body=None,
        runner=runner,
    )


async def fp_post(path: str, body: dict[str, Any], *, use_poa: bool = False) -> dict[str, Any]:
    token = await (_fp_tokens.get_poa_token() if use_poa else _fp_tokens.get_kyc_token())
    if use_poa:
        runtime = get_cybrilla_runtime()
        base = runtime.base_url
        tenant = runtime.auth_tenant
    else:
        runtime = get_finprim_runtime()
        base = runtime.base_url
        tenant = runtime.tenant

    async def runner() -> httpx.Response:
        async with httpx.AsyncClient(timeout=30.0) as client:
            return await client.post(
                f"{base.rstrip('/')}{path}",
                headers={
                    "Authorization": f"Bearer {token}",
                    "x-tenant-id": tenant,
                    "Content-Type": "application/json",
                },
                json=body,
            )

    return await _run_logged_fp_request(
        method="POST",
        path=path,
        use_poa=use_poa,
        request_body=body,
        runner=runner,
    )


async def fp_post_multipart(
    path: str,
    *,
    fields: dict[str, str],
    files: dict[str, tuple[str, bytes, str]],
    use_poa: bool = False,
) -> dict[str, Any]:
    token = await (_fp_tokens.get_poa_token() if use_poa else _fp_tokens.get_kyc_token())
    if use_poa:
        runtime = get_cybrilla_runtime()
        base = runtime.base_url
        tenant = runtime.auth_tenant
    else:
        runtime = get_finprim_runtime()
        base = runtime.base_url
        tenant = runtime.tenant
    multipart_files = {
        key: (filename, content, mime)
        for key, (filename, content, mime) in files.items()
    }

    async def runner() -> httpx.Response:
        async with httpx.AsyncClient(timeout=60.0) as client:
            return await client.post(
                f"{base.rstrip('/')}{path}",
                headers={"Authorization": f"Bearer {token}", "x-tenant-id": tenant},
                data=fields,
                files=multipart_files,
            )

    return await _run_logged_fp_request(
        method="POST",
        path=path,
        use_poa=use_poa,
        request_body={"fields": list(fields.keys()), "files": list(files.keys())},
        runner=runner,
    )


async def fp_patch(path: str, body: dict[str, Any], *, use_poa: bool = False) -> dict[str, Any]:
    token = await (_fp_tokens.get_poa_token() if use_poa else _fp_tokens.get_kyc_token())
    if use_poa:
        runtime = get_cybrilla_runtime()
        base = runtime.base_url
        tenant = runtime.auth_tenant
    else:
        runtime = get_finprim_runtime()
        base = runtime.base_url
        tenant = runtime.tenant

    async def runner() -> httpx.Response:
        async with httpx.AsyncClient(timeout=30.0) as client:
            return await client.patch(
                f"{base.rstrip('/')}{path}",
                headers={
                    "Authorization": f"Bearer {token}",
                    "x-tenant-id": tenant,
                    "Content-Type": "application/json",
                },
                json=body,
            )

    return await _run_logged_fp_request(
        method="PATCH",
        path=path,
        use_poa=use_poa,
        request_body=body,
        runner=runner,
    )


async def poll_poa_preverification(preverify_id: str, *, max_attempts: int = 20) -> dict[str, Any]:
    for attempt in range(max_attempts):
        payload = await fp_get(f"/poa/pre_verifications/{preverify_id}", use_poa=True)
        if payload.get("status") == "completed":
            return payload
        await asyncio.sleep(min(0.25 * (attempt + 1), 2.0))
    return payload


async def create_kyc_request_and_identity_document(
    *,
    user_email: str,
    phone: str | None,
    pan: str,
    name: str,
    date_of_birth: str,
    postback_url: str,
) -> dict[str, Any]:
    settings = get_settings()
    if not settings.resolved_kyc_provider_live:
        return await stub_create_kyc_request(
            user_email=user_email, pan=pan, name=name, dob=date_of_birth
        )

    mobile_number = (phone or "").strip()
    if mobile_number.startswith("+91"):
        mobile_number = mobile_number[3:]
    mobile_number = mobile_number.lstrip("+").replace(" ", "")

    kyc_request = await fp_post(
        "/v2/kyc_requests",
        {
            "name": name,
            "pan": pan.upper(),
            "email": user_email,
            "date_of_birth": date_of_birth,
            "mobile": {"isd": "+91", "number": mobile_number or "9999999999"},
        },
    )
    kyc_request_id = str(kyc_request["id"])
    identity_document = await fp_post(
        "/v2/identity_documents",
        {
            "kyc_request": kyc_request_id,
            "type": "aadhaar",
            "postback_url": postback_url,
        },
    )
    fetch = identity_document.get("fetch") or {}
    return {
        "kycRequestId": kyc_request_id,
        "identityDocumentId": str(identity_document["id"]),
        "redirectUrl": str(fetch.get("redirect_url") or ""),
    }


async def fetch_identity_document(document_id: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.resolved_kyc_provider_live:
        return await stub_fetch_identity_document(document_id)
    return await fp_get(f"/v2/identity_documents/{document_id}")


def _fallback_ifsc_lookup(ifsc_code: str) -> dict[str, str]:
    code = ifsc_code.upper().strip()
    return {
        "ifsc_code": code,
        "bank_name": code[:4],
        "branch": "",
    }


async def lookup_ifsc(ifsc_code: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.resolved_kyc_provider_live:
        return stub_ifsc_lookup(ifsc_code)

    code = ifsc_code.upper().strip()
    try:
        payload = await fp_get(f"/api/onb/ifsc_codes/{code}")
    except FpClientError as exc:
        if exc.status_code in {404, 403, 501} or "url not available" in exc.message.lower():
            return _fallback_ifsc_lookup(code)
        raise

    return {
        "ifsc_code": str(payload.get("ifsc_code") or code),
        "bank_name": str(payload.get("bank_name") or payload.get("bank") or ""),
        "branch": str(payload.get("branch_name") or payload.get("branch") or ""),
    }


async def lookup_pincode(pincode: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.resolved_kyc_provider_live:
        return stub_pincode_lookup(pincode)
    return await fp_get(f"/api/onb/pincodes/{pincode}")


async def list_states() -> list[dict[str, str]]:
    settings = get_settings()
    if not settings.resolved_kyc_provider_live:
        return stub_states()
    payload = await fp_get("/api/onb/states")
    rows: list[dict[str, str]] = []
    for item in payload.get("states", []):
        if not isinstance(item, dict):
            continue
        normalized = _normalize_state_row(item)
        if normalized:
            rows.append(normalized)
    return rows


async def list_countries() -> list[dict[str, str]]:
    settings = get_settings()
    if not settings.resolved_kyc_provider_live:
        return stub_countries()
    payload = await fp_get("/api/onb/countries")
    rows: list[dict[str, str]] = []
    for item in payload.get("countries", []):
        if not isinstance(item, dict):
            continue
        normalized = _normalize_country_row(item)
        if normalized:
            rows.append(normalized)
    return rows
