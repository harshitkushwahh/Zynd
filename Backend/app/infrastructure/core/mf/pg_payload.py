"""Shared Finprim payment-gateway response helpers."""

from __future__ import annotations

from typing import Any


def extract_numeric_id(payload: dict[str, Any]) -> int | None:
    value = payload.get("id")
    if value is None:
        data = payload.get("data")
        if isinstance(data, dict):
            value = data.get("id")
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def extract_token_url(payload: dict[str, Any]) -> str | None:
    token_url = payload.get("token_url")
    if token_url:
        return str(token_url)
    upi = payload.get("upi")
    if isinstance(upi, dict) and upi.get("uri"):
        return str(upi["uri"])
    data = payload.get("data")
    if isinstance(data, dict):
        return extract_token_url(data)
    return None


def extract_status(payload: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        value = payload.get(key)
        if value is not None:
            return str(value)
    data = payload.get("data")
    if isinstance(data, dict):
        return extract_status(data, *keys)
    return None
