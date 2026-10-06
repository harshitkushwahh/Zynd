from __future__ import annotations

import logging
from typing import Any

from app.application.kyc.digilocker_prefill import enrich_digilocker_address_prefill
from app.application.kyc.kyc_flow_mode import resolve_kyc_flow_mode
from app.application.kyc.path_a_proof import poa_form_proof_complete

logger = logging.getLogger(__name__)


def _address_block(raw: dict[str, Any]) -> dict[str, Any] | None:
    line1 = str(raw.get("line_1") or raw.get("line1") or "").strip()
    line2 = str(raw.get("line_2") or raw.get("line2") or "").strip()
    line3 = str(raw.get("line_3") or raw.get("line3") or "").strip()
    if line3:
        line2 = f"{line2}, {line3}".strip(", ")
    city = str(raw.get("city") or raw.get("district") or "").strip()
    pincode = str(raw.get("pincode") or raw.get("postal_code") or "").strip()
    state = str(raw.get("state_name") or raw.get("state") or "").strip()
    country = str(raw.get("country") or "in").strip()
    if not line1 and not city and not pincode:
        return None
    return {
        "permanent": {
            "line1": line1,
            "line2": line2,
            "city": city,
            "state": state,
            "pincode": pincode,
            "country": "India" if country.lower() in {"in", "india"} else country,
        },
        "sameAsPermanent": True,
    }


def contact_draft_from_kyc_form(form: dict[str, Any]) -> dict[str, Any] | None:
    """Map address returned by Cybrilla proof_details onto the journey contact draft."""
    candidates: list[dict[str, Any]] = []
    address = form.get("address")
    if isinstance(address, dict):
        candidates.append(address)
    proof = form.get("proof_details")
    if isinstance(proof, dict):
        for key in ("address", "data"):
            nested = proof.get(key)
            if isinstance(nested, dict):
                candidates.append(nested)
    for raw in candidates:
        mapped = _address_block(raw)
        if mapped is not None:
            return mapped
    return None


def _contact_line1(journey: Any) -> str:
    contact = journey.contact_draft_json if isinstance(journey.contact_draft_json, dict) else {}
    permanent = contact.get("permanent") if isinstance(contact, dict) else {}
    if not isinstance(permanent, dict):
        return ""
    return str(permanent.get("line1") or "").strip()


async def apply_kra_update_proof_address(journey: Any, form: dict[str, Any]) -> bool:
    """Fill the address step from proof details. Does not replace an address the user already saved."""
    if resolve_kyc_flow_mode(journey) != "kra_update":
        return False
    if not poa_form_proof_complete(form):
        return False
    if _contact_line1(journey):
        return False
    draft = contact_draft_from_kyc_form(form)
    if draft is None:
        return False
    try:
        draft = await enrich_digilocker_address_prefill(draft)
    except Exception:
        logger.exception("proof address pincode enrichment failed")
    journey.contact_draft_json = draft
    father = str(form.get("father_name") or "").strip()
    if father:
        personal = dict(journey.personal_draft_json or {})
        if not str(personal.get("fathersName") or "").strip():
            personal["fathersName"] = father
            journey.personal_draft_json = personal
    return True
