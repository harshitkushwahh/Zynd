from __future__ import annotations

from typing import Any

from app.infrastructure.kyc.fp_clients import list_states, lookup_pincode


def match_state_name(candidate: str, states: list[dict[str, str]]) -> str:
    normalized = str(candidate or "").strip()
    if not normalized:
        return ""

    lower = normalized.lower()
    for item in states:
        name = str(item.get("name") or "").strip()
        if name.lower() == lower:
            return name

    for item in states:
        name = str(item.get("name") or "").strip()
        name_lower = name.lower()
        if lower in name_lower or name_lower in lower:
            return name

    return normalized


async def enrich_digilocker_address_prefill(contact_draft: dict[str, Any]) -> dict[str, Any]:
    permanent = dict(contact_draft.get("permanent") or {})
    pincode = str(permanent.get("pincode") or "").strip()

    if pincode.isdigit() and len(pincode) == 6:
        try:
            pincode_data = await lookup_pincode(pincode)
        except Exception:
            pincode_data = {}

        if not str(permanent.get("city") or "").strip():
            permanent["city"] = str(pincode_data.get("city") or "").strip()
        if not str(permanent.get("state") or "").strip():
            permanent["state"] = str(pincode_data.get("state_name") or "").strip()

    try:
        states = await list_states()
    except Exception:
        states = []

    if states:
        permanent["state"] = match_state_name(str(permanent.get("state") or ""), states)

    return {**contact_draft, "permanent": permanent}


def digilocker_prefill_missing_fields(
    contact_draft: dict[str, Any] | None,
    personal_draft: dict[str, Any] | None,
) -> list[str]:
    missing: list[str] = []
    permanent = (contact_draft or {}).get("permanent") or {}

    if not str(permanent.get("line1") or "").strip():
        missing.append("line1")
    if not str(permanent.get("city") or "").strip():
        missing.append("city")

    pincode = str(permanent.get("pincode") or "").strip()
    if not (pincode.isdigit() and len(pincode) == 6):
        missing.append("pincode")

    if not str(permanent.get("state") or "").strip():
        missing.append("state")

    if not str((personal_draft or {}).get("fathersName") or "").strip():
        missing.append("fathersName")

    return missing
