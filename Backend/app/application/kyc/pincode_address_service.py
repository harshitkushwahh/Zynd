from __future__ import annotations

from typing import Any

from app.application.kyc.indian_states import (
    DEFAULT_KYC_COUNTRY,
    canonicalize_state_name,
    country_from_ansi,
    names_loosely_match,
)
from app.infrastructure.kyc.fp_clients import FpClientError, list_states, lookup_pincode


def _expected_city(lookup: dict[str, Any]) -> str:
    return str(lookup.get("city") or lookup.get("district") or "").strip()


def address_matches_pincode(address: dict[str, Any], lookup: dict[str, Any]) -> bool:
    expected_city = _expected_city(lookup)
    expected_state = canonicalize_state_name(str(lookup.get("state_name") or ""))
    expected_country = country_from_ansi(str(lookup.get("country_ansi_code") or "IN"))

    city = str(address.get("city") or "").strip()
    state = canonicalize_state_name(str(address.get("state") or ""))
    country = str(address.get("country") or "").strip() or DEFAULT_KYC_COUNTRY

    city_ok = (
        not expected_city
        or names_loosely_match(city, expected_city)
        or names_loosely_match(city, str(lookup.get("district") or ""))
    )
    state_ok = not expected_state or names_loosely_match(state, expected_state)
    country_ok = names_loosely_match(country, expected_country)
    return city_ok and state_ok and country_ok


def apply_pincode_lookup_to_address(address: dict[str, Any], lookup: dict[str, Any]) -> dict[str, Any]:
    updated = dict(address)
    expected_city = _expected_city(lookup)
    expected_state = canonicalize_state_name(str(lookup.get("state_name") or ""))
    if expected_city:
        updated["city"] = expected_city
    if expected_state:
        updated["state"] = expected_state
    updated["country"] = country_from_ansi(str(lookup.get("country_ansi_code") or "IN"))
    return updated


async def apply_pincode_to_address_block(address: dict[str, Any]) -> dict[str, Any]:
    pincode = str(address.get("pincode") or "").strip()
    updated = {**address, "country": str(address.get("country") or DEFAULT_KYC_COUNTRY).strip() or DEFAULT_KYC_COUNTRY}
    if not (pincode.isdigit() and len(pincode) == 6):
        if updated.get("state"):
            updated["state"] = canonicalize_state_name(str(updated.get("state") or ""))
        return updated

    try:
        lookup = await lookup_pincode(pincode)
    except FpClientError:
        if updated.get("state"):
            updated["state"] = canonicalize_state_name(str(updated.get("state") or ""))
        return updated
    except Exception:
        if updated.get("state"):
            updated["state"] = canonicalize_state_name(str(updated.get("state") or ""))
        return updated

    if not address_matches_pincode(updated, lookup) or not str(updated.get("city") or "").strip() or not str(updated.get("state") or "").strip():
        updated = apply_pincode_lookup_to_address(updated, lookup)
    else:
        updated["state"] = canonicalize_state_name(str(updated.get("state") or lookup.get("state_name") or ""))
        updated["country"] = country_from_ansi(str(lookup.get("country_ansi_code") or "IN"))
    return updated


async def normalize_contact_draft_pincodes(contact_draft: dict[str, Any]) -> dict[str, Any]:
    draft = dict(contact_draft)
    permanent = await apply_pincode_to_address_block(dict(draft.get("permanent") or {}))
    try:
        states = await list_states()
    except Exception:
        states = []
    if states:
        permanent["state"] = canonicalize_state_name(str(permanent.get("state") or ""), states)

    same_as_permanent = bool(draft.get("sameAsPermanent"))
    if same_as_permanent:
        correspondence = {**permanent}
    else:
        correspondence = await apply_pincode_to_address_block(dict(draft.get("correspondence") or {}))
        if states:
            correspondence["state"] = canonicalize_state_name(str(correspondence.get("state") or ""), states)

    return {
        **draft,
        "permanent": permanent,
        "correspondence": correspondence,
        "sameAsPermanent": same_as_permanent,
    }
