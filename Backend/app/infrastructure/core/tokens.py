from __future__ import annotations

import asyncio
import base64
import json
import logging
import time
from dataclasses import dataclass

import httpx

from app.application.integrations.integration_runtime import (
    get_cybrilla_poa_kyc_runtime,
    get_cybrilla_runtime,
    get_finprim_digilocker_runtime,
    get_finprim_kyc_tenant_runtime,
    get_finprim_runtime,
    is_cybrilla_poa_live,
    is_finprim_digilocker_live,
    is_finprim_enabled,
    is_kyckart_live,
)
from app.core.config import get_settings
from app.infrastructure.core.channels import CybrillaChannel
from app.infrastructure.core.errors import CybrillaClientError

logger = logging.getLogger(__name__)

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


class CybrillaTokenService:
    def __init__(self) -> None:
        self._by_channel: dict[CybrillaChannel, _CachedToken | None] = {}
        self._mf_token: str | None = None
        self._mf_lock = asyncio.Lock()

    def invalidate_all(self) -> None:
        self._by_channel.clear()
        self._mf_token = None

    def invalidate_channel(self, channel: CybrillaChannel) -> None:
        self._by_channel[channel] = None
        if channel == CybrillaChannel.finprim_mf:
            self._mf_token = None

    async def get_token(self, channel: CybrillaChannel, *, force_refresh: bool = False) -> str:
        if channel == CybrillaChannel.finprim_mf:
            return await self._get_mf_token(force_refresh=force_refresh)

        if not force_refresh:
            cached = self._by_channel.get(channel)
            if _is_token_still_valid(cached):
                assert cached is not None
                return cached.value

        token, expires_at = await self._fetch_token_for_channel(channel)
        self._by_channel[channel] = _CachedToken(value=token, expires_at=expires_at)
        return token

    async def _get_mf_token(self, *, force_refresh: bool = False) -> str:
        if not is_finprim_enabled():
            return "stub-mf-token"

        runtime = get_finprim_runtime()
        async with self._mf_lock:
            if force_refresh:
                self._mf_token = None
            if self._mf_token:
                return self._mf_token

            url = f"{runtime.base_url.rstrip('/')}/v2/auth/{runtime.tenant}/token"
            try:
                async with httpx.AsyncClient(timeout=20.0) as client:
                    response = await client.post(
                        url,
                        data={
                            "client_id": runtime.client_id,
                            "client_secret": runtime.client_secret,
                            "grant_type": "client_credentials",
                        },
                    )
                    if not response.is_success:
                        logger.error(
                            "Finprim MF OAuth failed env=%s tenant=%s status=%s url=%s body=%s",
                            runtime.environment,
                            runtime.tenant,
                            response.status_code,
                            url,
                            (response.text or "")[:400],
                        )
                    response.raise_for_status()
                    self._mf_token = str(response.json()["access_token"])
                return self._mf_token
            except httpx.TransportError as exc:
                raise CybrillaClientError(
                    (
                        f"Finprim is unreachable (OAuth token). "
                        f"Check network connectivity and FP base URL ({runtime.base_url.rstrip('/')}). "
                        f"{exc}"
                    ),
                    code="fp_mf_transport_error",
                    status_code=503,
                ) from exc

    async def _fetch_token_for_channel(self, channel: CybrillaChannel) -> tuple[str, float]:
        settings = get_settings()

        if channel == CybrillaChannel.finprim_kyc:
            finprim = get_finprim_runtime()
            if not (settings.fp_enabled and finprim.configured) and not is_kyckart_live():
                raise CybrillaClientError(
                    "Finprim KYC is not configured.",
                    "finprim_not_configured",
                    503,
                )
            return await self._fetch_token(
                token_base_url=finprim.base_url,
                auth_tenant=finprim.tenant,
                client_id=finprim.client_id,
                client_secret=finprim.client_secret,
            )

        if channel == CybrillaChannel.cybrilla_poa:
            if not is_cybrilla_poa_live():
                raise CybrillaClientError(
                    "Cybrilla POA is not configured.",
                    "poa_not_configured",
                    503,
                )
            runtime = get_cybrilla_runtime()
            return await self._fetch_token(
                token_base_url=runtime.resolved_token_base_url,
                auth_tenant=runtime.auth_tenant,
                client_id=runtime.client_id,
                client_secret=runtime.client_secret,
            )

        if channel == CybrillaChannel.cybrilla_poa_kyc_forms:
            from app.application.integrations.integration_runtime import is_cybrilla_poa_kyc_live

            if not is_cybrilla_poa_kyc_live():
                raise CybrillaClientError(
                    "Cybrilla POA KYC forms are not configured.",
                    "poa_kyc_not_configured",
                    503,
                )
            runtime = get_cybrilla_poa_kyc_runtime()
            return await self._fetch_token(
                token_base_url=runtime.resolved_token_base_url,
                auth_tenant=runtime.auth_tenant,
                client_id=runtime.client_id,
                client_secret=runtime.client_secret,
            )

        if channel == CybrillaChannel.finprim_digilocker:
            if not is_finprim_digilocker_live():
                raise CybrillaClientError(
                    "Finprim DigiLocker is not configured.",
                    "digilocker_not_configured",
                    503,
                )
            runtime = get_finprim_digilocker_runtime()
            return await self._fetch_token(
                token_base_url=runtime.token_base_url,
                auth_tenant=runtime.tenant,
                client_id=runtime.client_id,
                client_secret=runtime.client_secret,
            )

        if channel == CybrillaChannel.finprim_kyc_tenant:
            if not is_finprim_digilocker_live():
                raise CybrillaClientError(
                    "Finprim KYC tenant is not configured.",
                    "kyc_tenant_not_configured",
                    503,
                )
            runtime = get_finprim_kyc_tenant_runtime()
            return await self._fetch_token(
                token_base_url=runtime.token_base_url,
                auth_tenant=runtime.tenant,
                client_id=runtime.client_id,
                client_secret=runtime.client_secret,
            )

        raise CybrillaClientError(f"Unsupported token channel: {channel}", "invalid_channel", 500)

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
                raise CybrillaClientError(
                    f"Partner auth failed ({response.status_code}): {detail}",
                    "partner_auth_failed",
                    response.status_code,
                ) from exc
            payload = response.json()
        token = str(payload["access_token"])
        expires_in_raw = payload.get("expires_in")
        expires_in = int(expires_in_raw) if expires_in_raw is not None else None
        return token, _token_expires_at(token, expires_in)


_default_tokens = CybrillaTokenService()


def get_cybrilla_token_service() -> CybrillaTokenService:
    return _default_tokens


def invalidate_all_cybrilla_tokens() -> None:
    _default_tokens.invalidate_all()
