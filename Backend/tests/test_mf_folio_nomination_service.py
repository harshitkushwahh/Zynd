from __future__ import annotations

from app.application.mf.mf_folio_nomination_service import (
    count_folio_nominees,
    nominee_count_label,
    primary_nominee_name,
    _serialize_folio_row,
)


def test_count_folio_nominees_ignores_empty_slots() -> None:
    folio = {
        "nominee1": {"name": "Priya"},
        "nominee2": None,
        "nominee3": "relp_abc",
    }
    assert count_folio_nominees(folio) == 2


def test_primary_nominee_name_prefers_first_slot() -> None:
    folio = {
        "nominee1": {"name": "Priya"},
        "nominee2": {"name": "Ravi"},
    }
    assert primary_nominee_name(folio) == "Priya"


def test_nominee_count_label() -> None:
    assert nominee_count_label(0) == "No nominee"
    assert nominee_count_label(1) == "1 nominee"
    assert nominee_count_label(2) == "2 nominees"


def test_serialize_folio_row_without_amc_lookup() -> None:
    row = _serialize_folio_row(
        {"number": "12345", "amc": "103", "nominee1": None},
        amc_by_code={},
    )
    assert row is not None
    assert row["folio_number"] == "12345"
    assert row["amc_name"] == "AMC 103"
    assert row["nominee_count"] == 0
    assert row["nominee_status"] == "No nominee"
