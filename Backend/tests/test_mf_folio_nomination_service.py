from __future__ import annotations

from app.application.mf.mf_folio_nomination_service import (
    _amc_code_from_folio,
    count_folio_nominees,
    nominee_count_label,
    primary_nominee_name,
    _serialize_folio_row,
)
from app.infrastructure.persistence.mf_models import FundAmc


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


def test_amc_code_from_folio_reads_nested_object() -> None:
    assert _amc_code_from_folio({"amc": {"id": "H", "name": "DSP"}}) == "H"


def test_serialize_folio_row_resolves_amc_from_holdings_isin() -> None:
    amc = FundAmc(name="DSP Mutual Fund", slug="dsp", amc_code="DSP")
    row = _serialize_folio_row(
        {"number": "44851151/97", "amc": "H", "nominee1": None},
        amc_by_code={},
        amc_by_isin={"INF179KC1HC7": amc},
        holding_rows=[{"folio_number": "44851151/97", "isin": "INF179KC1HC7", "units": 1.0}],
    )
    assert row is not None
    assert row["amc_name"] == "DSP Mutual Fund"
    assert row["amc_slug"] == "dsp"
