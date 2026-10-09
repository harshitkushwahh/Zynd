from __future__ import annotations

import asyncio
import base64
import json
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

import httpx

from app.application.integrations.provider_log_recorder import record_provider_api_log
from app.application.integrations.integration_runtime import (
    digilocker_configuration_message,
    get_cybrilla_poa_kyc_runtime,
    get_cybrilla_runtime,
    get_finprim_digilocker_runtime,
    get_finprim_kyc_tenant_runtime,
    get_finprim_runtime,
    is_cybrilla_poa_live,
    is_finprim_digilocker_live,
    is_kyckart_live,
)
from app.core.config import get_settings
from app.infrastructure.kyc.cybrilla_terminal_log import log_exception_dump, log_fp_http
from app.infrastructure.persistence.provider_log_models import ProviderLogSource


class FpClientError(Exception):
    def __init__(
        self,
        message: str,
        code: str = "fp_client_error",
        status_code: int = 502,
        response_data: Any = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.response_data = response_data


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
        payload = {"raw": (response.text or "")[:4000]}
    message = _parse_fp_error_message(payload, fallback=fallback)
    log_exception_dump(
        "Finprim HTTP error",
        status_code=response.status_code,
        url=str(response.request.url) if response.request else None,
        method=response.request.method if response.request else None,
        message=message,
        response=payload,
    )
    raise FpClientError(message, "fp_client_error", response.status_code, response_data=payload)


_TOKEN_REFRESH_BUFFER_SECONDS = 60


@dataclass(frozen=True)
class _CachedToken:
    value: str
    expires_at: float


def _jwt_expires_at(token: str) -> float | None:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        payload = parts[1]
        payload += "=" * (-len(payload) % 4)
        data = json.loads(base64.urlsafe_b64decode(payload))
        exp = data.get("exp")
        return float(exp) if exp is not None else None
    except (ValueError, TypeError, json.JSONDecodeError):
        return None


def _token_expires_at(access_token: str, expires_in: int | None) -> float:
    jwt_exp = _jwt_expires_at(access_token)
    if jwt_exp is not None:
        return jwt_exp
    return time.time() + float(expires_in if expires_in is not None else 3600)


def _is_token_still_valid(cached: _CachedToken | None) -> bool:
    if cached is None:
        return False
    return time.time() < cached.expires_at - _TOKEN_REFRESH_BUFFER_SECONDS


def _is_auth_token_error(exc: FpClientError) -> bool:
    if exc.status_code not in {401, 403}:
        return False
    message = exc.message.lower()
    return (
        "jwt expired" in message
        or "token expired" in message
        or ("invalid token" in message and "jwt" in message)
        or "not able to authenticate" in message
        or "could not find public key for kid" in message
        or "authentication failed" in message
    )


def _is_finprim_kyc_request_path(path: str) -> bool:
    return path.startswith("/v2/kyc_requests")


def _is_finprim_identity_document_path(path: str) -> bool:
    return path.startswith("/v2/identity_documents")


def _is_finprim_kyc_files_path(path: str) -> bool:
    return path == "/files" or path.startswith("/files/")


def _is_finprim_digilocker_path(path: str) -> bool:
    return (
        _is_finprim_kyc_request_path(path)
        or _is_finprim_identity_document_path(path)
        or path.startswith("/v2/esigns")
        or _is_finprim_kyc_files_path(path)
    )


def _is_finprim_kyc_tenant_path(path: str) -> bool:
    return (
        _is_finprim_kyc_request_path(path)
        or path.startswith("/v2/esigns")
        or _is_finprim_kyc_files_path(path)
    )


def _use_kyc_tenant_runtime(path: str) -> bool:
    from app.application.integrations.integration_runtime import finprim_kyc_tenant_explicitly_configured

    if not _is_finprim_kyc_tenant_path(path):
        return False
    return finprim_kyc_tenant_explicitly_configured()


class FpTokenService:
    def __init__(self) -> None:
        self._kyc_token: _CachedToken | None = None
        self._poa_token: _CachedToken | None = None
        self._poa_kyc_token: _CachedToken | None = None
        self._digilocker_token: _CachedToken | None = None
        self._kyc_tenant_token: _CachedToken | None = None

    async def get_kyc_token(self, *, force_refresh: bool = False) -> str:
        settings = get_settings()
        finprim = get_finprim_runtime()
        finprim_active = settings.fp_enabled and finprim.configured
        if not finprim_active and not is_kyckart_live():
            raise FpClientError(
                "Finprim KYC is not configured.",
                "finprim_not_configured",
                503,
            )
        if not force_refresh and _is_token_still_valid(self._kyc_token):
            assert self._kyc_token is not None
            return self._kyc_token.value
        token, expires_at = await self._fetch_token(
            token_base_url=finprim.base_url,
            auth_tenant=finprim.tenant,
            client_id=finprim.client_id,
            client_secret=finprim.client_secret,
        )
        self._kyc_token = _CachedToken(value=token, expires_at=expires_at)
        return token

    async def get_poa_token(self, *, force_refresh: bool = False) -> str:
        if not is_cybrilla_poa_live():
            raise FpClientError(
                "Cybrilla POA is not configured.",
                "poa_not_configured",
                503,
            )
        if not force_refresh and _is_token_still_valid(self._poa_token):
            assert self._poa_token is not None
            return self._poa_token.value
        runtime = get_cybrilla_runtime()
        token, expires_at = await self._fetch_token(
            token_base_url=runtime.resolved_token_base_url,
            auth_tenant=runtime.auth_tenant,
            client_id=runtime.client_id,
            client_secret=runtime.client_secret,
        )
        self._poa_token = _CachedToken(value=token, expires_at=expires_at)
        return token

    async def get_poa_kyc_token(self, *, force_refresh: bool = False) -> str:
        from app.application.integrations.integration_runtime import is_cybrilla_poa_kyc_live

        if not is_cybrilla_poa_kyc_live():
            raise FpClientError(
                "Cybrilla POA KYC forms are not configured.",
                "poa_kyc_not_configured",
                503,
            )
        if not force_refresh and _is_token_still_valid(self._poa_kyc_token):
            assert self._poa_kyc_token is not None
            return self._poa_kyc_token.value
        runtime = get_cybrilla_poa_kyc_runtime()
        token, expires_at = await self._fetch_token(
            token_base_url=runtime.resolved_token_base_url,
            auth_tenant=runtime.auth_tenant,
            client_id=runtime.client_id,
            client_secret=runtime.client_secret,
        )
        self._poa_kyc_token = _CachedToken(value=token, expires_at=expires_at)
        return token

    async def get_digilocker_token(self, *, force_refresh: bool = False) -> str:
        if not is_finprim_digilocker_live():
            raise FpClientError(
                "Finprim DigiLocker is not configured.",
                "digilocker_not_configured",
                503,
            )
        if not force_refresh and _is_token_still_valid(self._digilocker_token):
            assert self._digilocker_token is not None
            return self._digilocker_token.value
        runtime = get_finprim_digilocker_runtime()
        token, expires_at = await self._fetch_token(
            token_base_url=runtime.token_base_url,
            auth_tenant=runtime.tenant,
            client_id=runtime.client_id,
            client_secret=runtime.client_secret,
        )
        self._digilocker_token = _CachedToken(value=token, expires_at=expires_at)
        return token

    async def get_kyc_tenant_token(self, *, force_refresh: bool = False) -> str:
        if not is_finprim_digilocker_live():
            raise FpClientError(
                "Finprim KYC tenant is not configured.",
                "kyc_tenant_not_configured",
                503,
            )
        if not force_refresh and _is_token_still_valid(self._kyc_tenant_token):
            assert self._kyc_tenant_token is not None
            return self._kyc_tenant_token.value
        runtime = get_finprim_kyc_tenant_runtime()
        token, expires_at = await self._fetch_token(
            token_base_url=runtime.token_base_url,
            auth_tenant=runtime.tenant,
            client_id=runtime.client_id,
            client_secret=runtime.client_secret,
        )
        self._kyc_tenant_token = _CachedToken(value=token, expires_at=expires_at)
        return token

    def invalidate(self) -> None:
        self._kyc_token = None
        self._poa_token = None
        self._poa_kyc_token = None
        self._digilocker_token = None
        self._kyc_tenant_token = None

    def invalidate_kyc_token(self) -> None:
        self._kyc_token = None

    def invalidate_poa_token(self) -> None:
        self._poa_token = None

    def invalidate_poa_kyc_token(self) -> None:
        self._poa_kyc_token = None

    def invalidate_digilocker_token(self) -> None:
        self._digilocker_token = None

    def invalidate_kyc_tenant_token(self) -> None:
        self._kyc_tenant_token = None

    async def _fetch_token(
        self,
        *,
        token_base_url: str,
        auth_tenant: str,
        client_id: str,
        client_secret: str,
    ) -> tuple[str, float]:
        url = f"{token_base_url.rstrip('/')}/v2/auth/{auth_tenant}/token"
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                url,
                data={"client_id": client_id, "client_secret": client_secret, "grant_type": "client_credentials"},
            )
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                detail = response.text[:500] if response.text else str(exc)
                raise FpClientError(
                    f"Partner auth failed ({response.status_code}): {detail}",
                    "partner_auth_failed",
                    response.status_code,
                ) from exc
            payload = response.json()
        token = str(payload["access_token"])
        expires_in_raw = payload.get("expires_in")
        expires_in = int(expires_in_raw) if expires_in_raw is not None else None
        return token, _token_expires_at(token, expires_in)


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
        if response_body is None and exc.response_data is not None:
            response_body = exc.response_data
        raise
    except Exception:
        error_code = "fp_transport_error"
        raise
    finally:
        duration_ms = int((time.perf_counter() - started) * 1000)
        log_fp_http(
            use_poa=use_poa,
            method=method,
            path=path,
            status_code=status_code,
            success=success,
            duration_ms=duration_ms,
            error_code=error_code,
            request_body=request_body,
            response_body=response_body,
        )
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


def _is_poa_kyc_forms_path(path: str) -> bool:
    return path.startswith("/poa/kyc_forms")


def _fp_runtime(*, use_poa: bool, path: str = "") -> tuple[str, str]:
    if use_poa:
        runtime = get_cybrilla_poa_kyc_runtime() if _is_poa_kyc_forms_path(path) else get_cybrilla_runtime()
        return runtime.base_url, runtime.resolved_api_tenant
    if _use_kyc_tenant_runtime(path):
        runtime = get_finprim_kyc_tenant_runtime()
        return runtime.base_url, runtime.tenant
    if _is_finprim_digilocker_path(path):
        runtime = get_finprim_digilocker_runtime()
        return runtime.base_url, runtime.tenant
    runtime = get_finprim_runtime()
    return runtime.base_url, runtime.tenant


async def _get_fp_token(*, use_poa: bool, path: str, force_refresh: bool) -> str:
    if use_poa:
        if _is_poa_kyc_forms_path(path):
            return await _fp_tokens.get_poa_kyc_token(force_refresh=force_refresh)
        return await _fp_tokens.get_poa_token(force_refresh=force_refresh)
    if _use_kyc_tenant_runtime(path):
        return await _fp_tokens.get_kyc_tenant_token(force_refresh=force_refresh)
    if _is_finprim_digilocker_path(path):
        return await _fp_tokens.get_digilocker_token(force_refresh=force_refresh)
    return await _fp_tokens.get_kyc_token(force_refresh=force_refresh)


def _invalidate_fp_token(*, use_poa: bool, path: str) -> None:
    if use_poa:
        if _is_poa_kyc_forms_path(path):
            _fp_tokens.invalidate_poa_kyc_token()
        else:
            _fp_tokens.invalidate_poa_token()
    elif _use_kyc_tenant_runtime(path):
        _fp_tokens.invalidate_kyc_tenant_token()
    elif _is_finprim_digilocker_path(path):
        _fp_tokens.invalidate_digilocker_token()
    else:
        _fp_tokens.invalidate_kyc_token()


async def _fp_request_with_auth_retry(
    method: str,
    path: str,
    *,
    use_poa: bool,
    request_body: Any,
    runner: Callable[[str], Awaitable[httpx.Response]],
) -> dict[str, Any]:
    last_exc: FpClientError | None = None
    for attempt in range(2):
        force_refresh = attempt > 0
        if force_refresh:
            _invalidate_fp_token(use_poa=use_poa, path=path)
        token = await _get_fp_token(use_poa=use_poa, path=path, force_refresh=force_refresh)
        try:
            return await _run_logged_fp_request(
                method=method,
                path=path,
                use_poa=use_poa,
                request_body=request_body,
                runner=lambda current_token=token: runner(current_token),
            )
        except FpClientError as exc:
            last_exc = exc
            if attempt == 0 and _is_auth_token_error(exc):
                continue
            raise
    assert last_exc is not None
    raise last_exc


async def fp_get(path: str, *, use_poa: bool = False) -> dict[str, Any]:
    base, tenant = _fp_runtime(use_poa=use_poa, path=path)

    async def runner(token: str) -> httpx.Response:
        full_url = f"{base.rstrip('/')}{path}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            return await client.get(
                full_url,
                headers={"Authorization": f"Bearer {token}", "x-tenant-id": tenant},
            )

    return await _fp_request_with_auth_retry(
        "GET",
        path,
        use_poa=use_poa,
        request_body=None,
        runner=runner,
    )



async def fp_post(path: str, body: dict[str, Any], *, use_poa: bool = False) -> dict[str, Any]:
    base, tenant = _fp_runtime(use_poa=use_poa, path=path)

    async def runner(token: str) -> httpx.Response:
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

    return await _fp_request_with_auth_retry(
        "POST",
        path,
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
    base, tenant = _fp_runtime(use_poa=use_poa, path=path)
    multipart_files = {
        key: (filename, content, mime)
        for key, (filename, content, mime) in files.items()
    }

    async def runner(token: str) -> httpx.Response:
        async with httpx.AsyncClient(timeout=60.0) as client:
            return await client.post(
                f"{base.rstrip('/')}{path}",
                headers={"Authorization": f"Bearer {token}", "x-tenant-id": tenant},
                data=fields,
                files=multipart_files,
            )

    return await _fp_request_with_auth_retry(
        "POST",
        path,
        use_poa=use_poa,
        request_body={"fields": list(fields.keys()), "files": list(files.keys())},
        runner=runner,
    )


async def fp_patch(path: str, body: dict[str, Any], *, use_poa: bool = False) -> dict[str, Any]:
    base, tenant = _fp_runtime(use_poa=use_poa, path=path)

    async def runner(token: str) -> httpx.Response:
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

    return await _fp_request_with_auth_retry(
        "PATCH",
        path,
        use_poa=use_poa,
        request_body=body,
        runner=runner,
    )


async def poll_poa_preverification(preverify_id: str, *, max_attempts: int = 20) -> dict[str, Any]:
    from app.infrastructure.kyc.cybrilla_terminal_log import log_poa_operation

    log_poa_operation("poll_preverification_start", live=True, preverify_id=preverify_id)
    payload: dict[str, Any] = {"id": preverify_id, "status": "pending"}
    for attempt in range(max_attempts):
        payload = await fp_get(f"/poa/pre_verifications/{preverify_id}", use_poa=True)
        if payload.get("status") == "completed":
            log_poa_operation(
                "poll_preverification_done",
                live=True,
                preverify_id=preverify_id,
                attempt=attempt + 1,
                status=payload.get("status"),
            )
            return payload
        await asyncio.sleep(min(0.25 * (attempt + 1), 2.0))
    log_poa_operation(
        "poll_preverification_timeout",
        live=True,
        preverify_id=preverify_id,
        last_status=payload.get("status"),
        attempts=max_attempts,
    )
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
    if not is_finprim_digilocker_live():
        raise FpClientError(
            digilocker_configuration_message(),
            "digilocker_unavailable",
            503,
        )

    from app.infrastructure.kyc.cybrilla_terminal_log import log_kyc_step

    mobile_number = (phone or "").strip()
    if mobile_number.startswith("+91"):
        mobile_number = mobile_number[3:]
    mobile_number = mobile_number.lstrip("+").replace(" ", "")

    runtime = get_finprim_digilocker_runtime()
    client_id = runtime.client_id.strip()
    log_kyc_step(
        "digilocker_finprim_config",
        base_url=runtime.base_url,
        tenant=runtime.tenant,
        environment=runtime.environment,
        fp_enabled=settings.fp_enabled,
        kyc_provider_mode=settings.kyc_provider_mode,
        kyc_digilocker_sandbox=settings.kyc_digilocker_sandbox,
        oauth_client_id_prefix=client_id[:8] if len(client_id) >= 8 else client_id,
        oauth_client_configured=bool(client_id and runtime.client_secret.strip()),
    )

    try:
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
        try:
            identity_document = await fp_post(
                "/v2/identity_documents",
                {
                    "kyc_request": kyc_request_id,
                    "type": "aadhaar",
                    "postback_url": postback_url,
                },
            )
        except FpClientError as exc:
            if exc.status_code == 403:
                raise FpClientError(
                    "FinPrim rejected DigiLocker identity document (403). "
                    f"Ask FinPrim to whitelist this postback URL for tenant multiplus sandbox, "
                    f"or set KYC_DIGILOCKER_CALLBACK_URL to a registered URL (often "
                    f"http://localhost:8000/api/v1/kyc/public/digilocker-callback, not 127.0.0.1). "
                    f"postback_url={postback_url}",
                    "digilocker_postback_forbidden",
                    403,
                    response_data=exc.response_data,
                ) from exc
            raise
    except FpClientError:
        raise

    fetch = identity_document.get("fetch") or {}
    redirect_url = str(fetch.get("redirect_url") or "")
    log_kyc_step(
        "digilocker_start",
        live=True,
        pan=pan,
        identity_document_id=str(identity_document["id"]),
        fetch_status=fetch.get("status"),
        has_redirect=bool(redirect_url),
        expires_at=fetch.get("expires_at"),
    )
    return {
        "kycRequestId": kyc_request_id,
        "identityDocumentId": str(identity_document["id"]),
        "redirectUrl": redirect_url,
        "identityDocument": identity_document,
    }


async def fetch_identity_document(document_id: str, *, postback_complete: bool = False) -> dict[str, Any]:
    from app.infrastructure.kyc.cybrilla_terminal_log import log_kyc_step

    live = is_finprim_digilocker_live()
    log_kyc_step(
        "digilocker_fetch_identity_document",
        live=live,
        document_id=document_id,
        postback_complete=postback_complete,
    )
    if not live:
        raise FpClientError(
            "FinPrim DigiLocker is not configured. Cannot fetch identity document.",
            "digilocker_unavailable",
            503,
        )
    document = await fp_get(f"/v2/identity_documents/{document_id}")
    fetch = document.get("fetch") or {}
    log_kyc_step(
        "digilocker_fetch_identity_document_result",
        live=live,
        document_id=document_id,
        fetch_status=fetch.get("status"),
        has_data=bool(document.get("data")),
    )
    return document


def _is_gateway_ifsc_route_unavailable(exc: FpClientError) -> bool:
    return exc.status_code in {403, 501} or "url not available" in exc.message.lower()


def _fallback_ifsc_lookup(ifsc_code: str) -> dict[str, Any]:
    code = ifsc_code.upper().strip()
    return {
        "ifsc_code": code,
        "bank_name": "",
        "branch": "",
        "lookup_fallback": True,
    }


async def lookup_ifsc(ifsc_code: str) -> dict[str, Any]:
    from app.application.integrations.integration_runtime import is_finprim_enabled
    from app.infrastructure.kyc.cybrilla_terminal_log import log_kyc_step

    settings = get_settings()
    code = ifsc_code.upper().strip()
    use_finprim = settings.resolved_kyc_provider_live or is_finprim_enabled()

    if not use_finprim:
        raise FpClientError(
            "IFSC lookup requires Finprim onboarding API (FP_* or Kyckart live).",
            "ifsc_lookup_unavailable",
            503,
        )

    try:
        payload = await fp_get(f"/api/onb/ifsc_codes/{code}")
    except FpClientError as exc:
        if _is_gateway_ifsc_route_unavailable(exc):
            log_kyc_step(
                "ifsc_lookup_finprim_unavailable",
                ifsc_code=code,
                status_code=exc.status_code,
                error=exc.message,
            )
            return _fallback_ifsc_lookup(code)
        if exc.status_code == 404:
            raise FpClientError(
                "IFSC code not found.",
                "invalid_ifsc",
                404,
            ) from exc
        raise

    from app.application.kyc.bank_ifsc_lookup import normalize_ifsc_lookup_payload

    normalized = normalize_ifsc_lookup_payload(code, payload if isinstance(payload, dict) else {})
    log_kyc_step(
        "ifsc_lookup_finprim",
        ifsc_code=code,
        bank_name=normalized.get("bank_name"),
        branch_name=normalized.get("branch_name"),
        branch=normalized.get("branch"),
    )
    return {
        **normalized,
        "lookup_fallback": False,
    }


async def lookup_pincode(pincode: str) -> dict[str, Any]:
    from app.application.integrations.integration_runtime import is_finprim_enabled

    settings = get_settings()
    if not settings.resolved_kyc_provider_live and not is_finprim_enabled():
        raise FpClientError(
            "Pincode lookup requires Finprim onboarding API.",
            "pincode_lookup_unavailable",
            503,
        )
    try:
        payload = await fp_get(f"/api/onb/pincodes/{pincode}")
    except FpClientError as exc:
        if exc.status_code == 404:
            raise FpClientError(
                "Pincode not found.",
                "invalid_pincode",
                404,
            ) from exc
        raise
    return {
        "code": str(payload.get("code") or pincode),
        "city": str(payload.get("city") or "").strip(),
        "district": str(payload.get("district") or "").strip(),
        "state_name": str(payload.get("state_name") or "").strip(),
        "country_ansi_code": str(payload.get("country_ansi_code") or "IN").strip() or "IN",
    }


async def list_states() -> list[dict[str, str]]:
    from app.application.integrations.integration_runtime import is_finprim_enabled
    from app.application.kyc.indian_states import INDIAN_STATE_CODES, merge_indian_states

    settings = get_settings()
    if not settings.resolved_kyc_provider_live and not is_finprim_enabled():
        static_rows = [
            {"name": name, "state_code": code, "country_ansi_code": "IN"}
            for name, code in INDIAN_STATE_CODES.items()
        ]
        return merge_indian_states(static_rows)
    payload = await fp_get("/api/onb/states")
    rows: list[dict[str, str]] = []
    for item in payload.get("states", []):
        if not isinstance(item, dict):
            continue
        normalized = _normalize_state_row(item)
        if normalized:
            rows.append(normalized)
    return merge_indian_states(rows)


async def list_countries() -> list[dict[str, str]]:
    from app.application.integrations.integration_runtime import is_finprim_enabled
    from app.application.kyc.country_master import static_kyc_countries

    settings = get_settings()
    if settings.resolved_kyc_provider_live or is_finprim_enabled():
        try:
            payload = await fp_get("/api/onb/countries")
            rows: list[dict[str, str]] = []
            for item in payload.get("countries", []):
                if not isinstance(item, dict):
                    continue
                normalized = _normalize_country_row(item)
                if normalized:
                    rows.append(normalized)
            if rows:
                return rows
        except FpClientError:
            pass
    return static_kyc_countries()
