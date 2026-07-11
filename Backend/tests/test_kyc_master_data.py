from __future__ import annotations

from app.infrastructure.kyc.fp_clients import _normalize_country_row, _normalize_state_row


def test_normalize_state_row_skips_blank_name() -> None:
    assert _normalize_state_row({"name": None, "state_code": None}) is None


def test_normalize_state_row_allows_missing_state_code() -> None:
    assert _normalize_state_row({"name": "LADAKH", "state_code": None}) == {
        "name": "LADAKH",
        "state_code": "",
        "country_ansi_code": "IN",
    }


def test_normalize_state_row_maps_valid_row() -> None:
    assert _normalize_state_row(
        {"name": "Karnataka", "state_code": "KA", "country_ansi_code": "IN"}
    ) == {
        "name": "Karnataka",
        "state_code": "KA",
        "country_ansi_code": "IN",
    }


def test_normalize_country_row_skips_invalid() -> None:
    assert _normalize_country_row({"name": None, "ansi_code": "IN"}) is None
