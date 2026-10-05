from __future__ import annotations

import pytest

from app.application.kyc.indian_states import INDIAN_STATE_NAMES, merge_indian_states
from app.application.kyc.pincode_address_service import (
    address_matches_pincode,
    apply_pincode_lookup_to_address,
    normalize_contact_draft_pincodes,
)


def test_merge_indian_states_adds_all_states_when_provider_returns_three() -> None:
    merged = merge_indian_states(
        [
            {"name": "Karnataka", "state_code": "KA", "country_ansi_code": "IN"},
            {"name": "Maharashtra", "state_code": "MH", "country_ansi_code": "IN"},
            {"name": "Delhi", "state_code": "DL", "country_ansi_code": "IN"},
        ]
    )
    names = {item["name"] for item in merged}
    assert names.issuperset(INDIAN_STATE_NAMES)
    assert next(item["state_code"] for item in merged if item["name"] == "Karnataka") == "KA"
    assert next(item["state_code"] for item in merged if item["name"] == "Madhya Pradesh") == "MP"


def test_address_mismatch_is_corrected_from_pincode() -> None:
    lookup = {
        "city": "Indore",
        "district": "Indore",
        "state_name": "Madhya Pradesh",
        "country_ansi_code": "IN",
    }
    entered = {
        "line1": "12 MG Road",
        "city": "Chennai",
        "state": "Delhi",
        "pincode": "452011",
        "country": "India",
    }
    assert address_matches_pincode(entered, lookup) is False
    corrected = apply_pincode_lookup_to_address(entered, lookup)
    assert corrected["city"] == "Indore"
    assert corrected["state"] == "Madhya Pradesh"
    assert corrected["country"] == "India"


@pytest.mark.asyncio
async def test_normalize_contact_draft_overwrites_mismatched_city_state(monkeypatch) -> None:
    async def fake_lookup_pincode(pincode: str) -> dict[str, str]:
        assert pincode == "452011"
        return {
            "code": pincode,
            "city": "Indore",
            "district": "Indore",
            "state_name": "Madhya Pradesh",
            "country_ansi_code": "IN",
        }

    async def fake_list_states() -> list[dict[str, str]]:
        return merge_indian_states([])

    monkeypatch.setattr(
        "app.application.kyc.pincode_address_service.lookup_pincode",
        fake_lookup_pincode,
    )
    monkeypatch.setattr(
        "app.application.kyc.pincode_address_service.list_states",
        fake_list_states,
    )

    draft = await normalize_contact_draft_pincodes(
        {
            "sameAsPermanent": True,
            "permanent": {
                "line1": "House 1",
                "line2": "",
                "city": "Chennai",
                "state": "Delhi",
                "pincode": "452011",
                "country": "India",
            },
        }
    )

    assert draft["permanent"]["city"] == "Indore"
    assert draft["permanent"]["state"] == "Madhya Pradesh"
    assert draft["correspondence"]["city"] == "Indore"
