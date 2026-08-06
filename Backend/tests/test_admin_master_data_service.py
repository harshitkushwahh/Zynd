from __future__ import annotations

import pytest

from app.application.admin.admin_master_data_service import lookup_admin_pincode, resolve_state_code_for_name


@pytest.mark.asyncio
async def test_resolve_state_code_for_name_uses_finprim_states(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_list_states() -> list[dict[str, str]]:
        return [{"name": "Karnataka", "state_code": "KA", "country_ansi_code": "IN"}]

    monkeypatch.setattr(
        "app.application.admin.admin_master_data_service.list_states",
        fake_list_states,
    )

    assert await resolve_state_code_for_name("Karnataka") == "KA"
    assert await resolve_state_code_for_name("karnataka") == "KA"
    assert await resolve_state_code_for_name("Unknown") == ""


@pytest.mark.asyncio
async def test_lookup_admin_pincode_maps_state_code(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_lookup_pincode(pincode: str) -> dict[str, str]:
        assert pincode == "560102"
        return {
            "code": pincode,
            "city": "Bangalore South",
            "district": "Bangalore",
            "state_name": "Karnataka",
            "country_ansi_code": "IN",
        }

    async def fake_list_states() -> list[dict[str, str]]:
        return [{"name": "Karnataka", "state_code": "KA", "country_ansi_code": "IN"}]

    monkeypatch.setattr(
        "app.application.admin.admin_master_data_service.lookup_pincode",
        fake_lookup_pincode,
    )
    monkeypatch.setattr(
        "app.application.admin.admin_master_data_service.list_states",
        fake_list_states,
    )

    result = await lookup_admin_pincode("560102")
    assert result == {
        "code": "560102",
        "city": "Bangalore South",
        "district": "Bangalore",
        "state_name": "Karnataka",
        "state_code": "KA",
        "country_ansi_code": "IN",
    }
