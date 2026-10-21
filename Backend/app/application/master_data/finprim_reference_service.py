"""Single entry for Finprim master/reference HTTP with Redis caching."""

from __future__ import annotations

from typing import Any

from app.application.shared.redis_json_cache import get_or_load_json
from app.core.config import get_settings
from app.infrastructure.core.kyc.fp_clients import (
    list_countries as _list_countries,
    list_states as _list_states,
    lookup_ifsc as _lookup_ifsc,
    lookup_pincode as _lookup_pincode,
)

_STATES_KEY = "finprim:ref:states"
_COUNTRIES_KEY = "finprim:ref:countries"
_PINCODE_KEY_PREFIX = "finprim:ref:pincode:"
_IFSC_KEY_PREFIX = "finprim:ref:ifsc:"

_STATES_TTL = 86400
_COUNTRIES_TTL = 86400
_PINCODE_TTL = 604800
_IFSC_TTL = 86400


async def list_states() -> list[dict[str, str]]:
    settings = get_settings()
    return await get_or_load_json(
        _STATES_KEY,
        _list_states,
        ttl_seconds=_STATES_TTL,
        jitter_seconds=300,
        settings=settings,
    )


async def list_countries() -> list[dict[str, str]]:
    settings = get_settings()
    return await get_or_load_json(
        _COUNTRIES_KEY,
        _list_countries,
        ttl_seconds=_COUNTRIES_TTL,
        jitter_seconds=300,
        settings=settings,
    )


async def lookup_pincode(pincode: str) -> dict[str, Any]:
    clean = pincode.strip()
    settings = get_settings()

    async def _load() -> dict[str, Any]:
        return await _lookup_pincode(clean)

    return await get_or_load_json(
        f"{_PINCODE_KEY_PREFIX}{clean}",
        _load,
        ttl_seconds=_PINCODE_TTL,
        jitter_seconds=600,
        settings=settings,
    )


async def lookup_ifsc(ifsc_code: str) -> dict[str, Any]:
    clean = ifsc_code.strip().upper()
    settings = get_settings()

    async def _load() -> dict[str, Any]:
        return await _lookup_ifsc(clean)

    return await get_or_load_json(
        f"{_IFSC_KEY_PREFIX}{clean}",
        _load,
        ttl_seconds=_IFSC_TTL,
        jitter_seconds=300,
        settings=settings,
    )


async def resolve_state_code_for_name(state_name: str) -> str:
    normalized = state_name.strip().casefold()
    if not normalized:
        return ""
    for item in await list_states():
        name = str(item.get("name") or "").strip()
        if name.casefold() == normalized:
            return str(item.get("state_code") or "").strip().upper()
    return ""


async def lookup_pincode_admin(pincode: str) -> dict[str, str]:
    payload = await lookup_pincode(pincode)
    state_name = str(payload.get("state_name") or "").strip()
    state_code = await resolve_state_code_for_name(state_name)
    return {
        "code": str(payload.get("code") or pincode),
        "city": str(payload.get("city") or "").strip(),
        "district": str(payload.get("district") or "").strip(),
        "state_name": state_name,
        "state_code": state_code,
        "country_ansi_code": str(payload.get("country_ansi_code") or "IN"),
    }


async def list_admin_states() -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    for item in await list_states():
        name = str(item.get("name") or "").strip()
        code = str(item.get("state_code") or "").strip().upper()
        if len(name) < 2 or len(code) < 2:
            continue
        items.append({"state_name": name, "state_code": code})
    items.sort(key=lambda row: row["state_name"].casefold())
    return items
