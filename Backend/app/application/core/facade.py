"""Application-layer entry points for Cybrilla/Finprim data used by API routers."""

from __future__ import annotations

from typing import Any

from app.application.integrations.integration_runtime import is_finprim_enabled
from app.core.config import get_settings
from app.infrastructure.core.errors import CybrillaClientError, FpClientError
from app.application.master_data.finprim_reference_service import (
    list_countries,
    list_states,
    lookup_ifsc,
    lookup_pincode,
)
from app.infrastructure.core.kyc.fp_clients import ensure_kyc_tokens

__all__ = [
    "CybrillaClientError",
    "FpClientError",
    "ensure_kyc_tokens",
    "is_finprim_enabled_for_api",
    "list_countries",
    "list_states",
    "lookup_ifsc",
    "lookup_pincode",
]


def is_finprim_enabled_for_api() -> bool:
    settings = get_settings()
    return bool(settings.fp_enabled and is_finprim_enabled())


async def lookup_pincode_for_api(pincode: str) -> dict[str, Any]:
    return await lookup_pincode(pincode)


async def list_states_for_api() -> list[dict[str, str]]:
    return await list_states()


async def list_countries_for_api() -> list[dict[str, str]]:
    return await list_countries()


async def lookup_ifsc_for_api(ifsc_code: str) -> dict[str, Any]:
    return await lookup_ifsc(ifsc_code)
