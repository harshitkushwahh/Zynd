from __future__ import annotations

import pytest

from app.application.kyc.digilocker_prefill import (
    digilocker_prefill_missing_fields,
    match_state_name,
)


def test_match_state_name_exact_and_partial() -> None:
    states = [{"name": "Karnataka", "state_code": "KA", "country_ansi_code": "IN"}]
    assert match_state_name("Karnataka", states) == "Karnataka"
    assert match_state_name("karnataka", states) == "Karnataka"
    assert match_state_name("Unknown", states) == "Unknown"


def test_digilocker_prefill_missing_fields_detects_gaps() -> None:
    missing = digilocker_prefill_missing_fields(
        {
            "permanent": {
                "line1": "",
                "line2": "",
                "city": "Bengaluru",
                "state": "",
                "pincode": "560041",
                "country": "India",
            }
        },
        {"fathersName": ""},
    )
    assert "line1" in missing
    assert "state" in missing
    assert "fathersName" in missing


def test_digilocker_prefill_missing_fields_complete() -> None:
    missing = digilocker_prefill_missing_fields(
        {
            "permanent": {
                "line1": "36TH CROSS",
                "line2": "",
                "city": "Bengaluru",
                "state": "Karnataka",
                "pincode": "560041",
                "country": "India",
            }
        },
        {"fathersName": "Rajesh Gupta"},
    )
    assert missing == []


@pytest.mark.asyncio
async def test_enrich_digilocker_address_prefill_uses_pincode(monkeypatch) -> None:
    from app.application.kyc.digilocker_prefill import enrich_digilocker_address_prefill

    async def fake_lookup_pincode(pincode: str) -> dict[str, str]:
        assert pincode == "560041"
        return {
            "code": pincode,
            "city": "Bengaluru",
            "district": "Bengaluru Urban",
            "state_name": "Karnataka",
            "country_ansi_code": "IN",
        }

    async def fake_list_states() -> list[dict[str, str]]:
        return [{"name": "Karnataka", "state_code": "KA", "country_ansi_code": "IN"}]

    monkeypatch.setattr(
        "app.application.kyc.digilocker_prefill.lookup_pincode",
        fake_lookup_pincode,
    )
    monkeypatch.setattr(
        "app.application.kyc.digilocker_prefill.list_states",
        fake_list_states,
    )

    enriched = await enrich_digilocker_address_prefill(
        {
            "permanent": {
                "line1": "36TH CROSS",
                "line2": "",
                "city": "",
                "state": "",
                "pincode": "560041",
                "country": "India",
            },
            "sameAsPermanent": True,
        }
    )

    assert enriched["permanent"]["city"] == "Bengaluru"
    assert enriched["permanent"]["state"] == "Karnataka"
