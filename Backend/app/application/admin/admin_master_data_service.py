from __future__ import annotations

from app.infrastructure.kyc.fp_clients import list_states, lookup_pincode


async def resolve_state_code_for_name(state_name: str) -> str:
    normalized = state_name.strip().casefold()
    if not normalized:
        return ""

    for item in await list_states():
        name = str(item.get("name") or "").strip()
        if name.casefold() == normalized:
            return str(item.get("state_code") or "").strip().upper()
    return ""


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


async def lookup_admin_pincode(pincode: str) -> dict[str, str]:
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
