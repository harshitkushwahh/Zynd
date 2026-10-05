from __future__ import annotations

from typing import Any

from app.application.investor.indian_bank_display import resolve_bank_display_name


def _clean_part(value: object) -> str:
    return str(value or "").strip()


def _dedupe_label_parts(*values: object) -> list[str]:
    seen: set[str] = set()
    parts: list[str] = []
    for value in values:
        part = _clean_part(value)
        if not part:
            continue
        key = part.casefold()
        if key in seen:
            continue
        seen.add(key)
        parts.append(part)
    return parts


def format_ifsc_branch_label(payload: dict[str, Any]) -> str:
    branch_name = _clean_part(payload.get("branch_name") or payload.get("branch"))
    city = _clean_part(payload.get("city"))
    district = _clean_part(payload.get("district"))
    state = _clean_part(payload.get("state"))
    address = _clean_part(payload.get("branch_address"))

    parts = _dedupe_label_parts(branch_name, city, district, state)
    if parts:
        return ", ".join(parts)
    if address:
        return address[:120]
    return ""


def normalize_ifsc_lookup_payload(ifsc_code: str, payload: dict[str, Any]) -> dict[str, str]:
    code = ifsc_code.strip().upper()
    raw_bank_name = _clean_part(payload.get("bank_name") or payload.get("bank"))
    bank_name = resolve_bank_display_name(raw_bank_name, code) or raw_bank_name
    branch = format_ifsc_branch_label(payload)
    branch_name = _clean_part(payload.get("branch_name") or payload.get("branch"))

    return {
        "ifsc_code": code,
        "bank_name": bank_name,
        "branch": branch,
        "branch_name": branch_name,
        "city": _clean_part(payload.get("city")),
        "state": _clean_part(payload.get("state")),
        "district": _clean_part(payload.get("district")),
        "branch_address": _clean_part(payload.get("branch_address")),
    }
