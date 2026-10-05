from __future__ import annotations

from typing import Any

from app.application.kyc.pincode_address_service import apply_pincode_lookup_to_address
from app.infrastructure.kyc.fp_clients import lookup_pincode


async def enrich_digilocker_address_prefill(contact_draft: dict[str, Any]) -> dict[str, Any]:
    draft = dict(contact_draft)
    permanent = dict(draft.get("permanent") or {})
    pincode = str(permanent.get("pincode") or "").strip()
    if len(pincode) == 6 and pincode.isdigit():
        lookup = await lookup_pincode(pincode)
        if lookup:
            permanent = apply_pincode_lookup_to_address(permanent, lookup)
    draft["permanent"] = permanent
    if draft.get("sameAsPermanent"):
        draft["correspondence"] = dict(permanent)
    return draft


def digilocker_prefill_missing_fields(
    contact_draft: dict[str, Any] | None,
    *,
    require_state: bool = True,
) -> list[str]:
    if not contact_draft:
        return ["permanent"]
    permanent = contact_draft.get("permanent") or {}
    missing: list[str] = []
    for key in ("line1", "city", "pincode", "country"):
        if not str(permanent.get(key) or "").strip():
            missing.append(key)
    if require_state and not str(permanent.get("state") or "").strip():
        missing.append("state")
    return missing
