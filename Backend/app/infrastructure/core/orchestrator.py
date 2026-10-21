from __future__ import annotations

import logging
import time
from collections.abc import Awaitable, Callable
from typing import Any

import httpx

from app.application.integrations.integration_runtime import get_finprim_runtime, is_finprim_enabled
from app.application.integrations.provider_log_recorder import record_provider_api_log
from app.core.config import get_settings
from app.infrastructure.core.channels import (
    CybrillaChannel,
    channel_base_and_tenant,
    channel_provider_log_source,
    channel_uses_poa_terminal_log,
    resolve_channel,
)
from app.infrastructure.core.errors import CybrillaClientError, raise_for_fp_response
from app.infrastructure.core.tokens import CybrillaTokenService, get_cybrilla_token_service
from app.infrastructure.kyc.cybrilla_terminal_log import log_fp_http
from app.infrastructure.persistence.provider_log_models import ProviderLogSource

logger = logging.getLogger(__name__)


def is_auth_token_error(exc: CybrillaClientError) -> bool:
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


class CybrillaHttpOrchestrator:
    def __init__(self, tokens: CybrillaTokenService | None = None) -> None:
        self._tokens = tokens or get_cybrilla_token_service()

    async def request_json(
        self,
        method: str,
        path: str,
        *,
        use_poa: bool = False,
        json_body: dict[str, Any] | None = None,
        timeout: float = 30.0,
        multipart: tuple[dict[str, str], dict[str, tuple[str, bytes, str]]] | None = None,
    ) -> dict[str, Any]:
        channel = resolve_channel(use_poa=use_poa, path=path)
        base, tenant = channel_base_and_tenant(channel)
        use_poa_log = channel_uses_poa_terminal_log(channel)
        log_source = channel_provider_log_source(channel)
        request_body: Any = json_body
        if multipart is not None:
            fields, _files = multipart
            request_body = {"fields": list(fields.keys()), "files": list(_files.keys())}

        async def runner(token: str) -> httpx.Response:
            headers = {"Authorization": f"Bearer {token}", "x-tenant-id": tenant}
            url = f"{base.rstrip('/')}{path}"
            async with httpx.AsyncClient(timeout=timeout) as client:
                if multipart is not None:
                    fields, files = multipart
                    multipart_files = {
                        key: (filename, content, mime)
                        for key, (filename, content, mime) in files.items()
                    }
                    return await client.post(
                        url,
                        headers=headers,
                        data=fields,
                        files=multipart_files,
                    )
                if method == "GET":
                    return await client.get(url, headers=headers)
                if method == "POST":
                    headers["Content-Type"] = "application/json"
                    return await client.post(url, headers=headers, json=json_body or {})
                headers["Content-Type"] = "application/json"
                return await client.patch(url, headers=headers, json=json_body or {})

        return await self._request_with_auth_retry(
            method=method,
            path=path,
            channel=channel,
            use_poa_log=use_poa_log,
            log_source=log_source,
            request_body=request_body,
            runner=runner,
        )

    async def request_mf(
        self,
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
        channel = CybrillaChannel.finprim_mf
        started = time.perf_counter()
        status_code: int | None = None
        success = False
        error_code: str | None = None
        response_body: Any = None
        response: httpx.Response | None = None

        try:
            for attempt in range(3):
                token = await self._tokens.get_token(channel, force_refresh=attempt > 0)
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
                    self._tokens.invalidate_channel(channel)
                    continue
                return response

            assert response is not None
            return response
        except httpx.TransportError as exc:
            error_code = "fp_mf_transport_error"
            raise CybrillaClientError(
                (
                    f"Finprim is unreachable ({method} {path}). "
                    f"Check network connectivity and FP base URL ({runtime.base_url.rstrip('/')}). "
                    f"{exc}"
                ),
                code="fp_mf_transport_error",
                status_code=503,
            ) from exc
        except Exception:
            error_code = "fp_mf_transport_error"
            raise
        finally:
            duration_ms = int((time.perf_counter() - started) * 1000)
            if is_finprim_enabled():
                log_fp_http(
                    use_poa=False,
                    method=method,
                    path=path,
                    status_code=status_code,
                    success=success,
                    duration_ms=duration_ms,
                    error_code=error_code,
                    request_body=body or params,
                    response_body=response_body,
                )
            await record_provider_api_log(
                source=ProviderLogSource.fintech_primitive,
                method=method,
                path=path,
                status_code=status_code,
                success=success,
                duration_ms=duration_ms,
                error_code=error_code,
                request_body=body or params,
                response_body=response_body,
            )

    async def _request_with_auth_retry(
        self,
        *,
        method: str,
        path: str,
        channel: CybrillaChannel,
        use_poa_log: bool,
        log_source: ProviderLogSource,
        request_body: Any,
        runner: Callable[[str], Awaitable[httpx.Response]],
    ) -> dict[str, Any]:
        last_exc: CybrillaClientError | None = None
        for attempt in range(2):
            force_refresh = attempt > 0
            if force_refresh:
                self._tokens.invalidate_channel(channel)
            token = await self._tokens.get_token(channel, force_refresh=force_refresh)
            try:
                return await self._run_logged_request(
                    method=method,
                    path=path,
                    use_poa_log=use_poa_log,
                    log_source=log_source,
                    request_body=request_body,
                    runner=lambda current_token=token: runner(current_token),
                )
            except CybrillaClientError as exc:
                last_exc = exc
                if attempt == 0 and is_auth_token_error(exc):
                    continue
                raise
        assert last_exc is not None
        raise last_exc

    async def _run_logged_request(
        self,
        *,
        method: str,
        path: str,
        use_poa_log: bool,
        log_source: ProviderLogSource,
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
            raise_for_fp_response(response)
            success = True
            return response_body if isinstance(response_body, dict) else {"data": response_body}
        except CybrillaClientError as exc:
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
                use_poa=use_poa_log,
                method=method,
                path=path,
                status_code=status_code,
                success=success,
                duration_ms=duration_ms,
                error_code=error_code,
                request_body=request_body,
                response_body=response_body,
            )
            await record_provider_api_log(
                source=log_source,
                method=method,
                path=path,
                status_code=status_code,
                success=success,
                duration_ms=int((time.perf_counter() - started) * 1000),
                error_code=error_code,
                request_body=request_body,
                response_body=response_body,
            )


_orchestrator: CybrillaHttpOrchestrator | None = None


def get_cybrilla_orchestrator() -> CybrillaHttpOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = CybrillaHttpOrchestrator()
    return _orchestrator
