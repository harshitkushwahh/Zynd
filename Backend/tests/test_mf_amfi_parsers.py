from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.application.mf.amfi_parsers import (
    crores_to_inr,
    normalize_scheme_name,
    parse_aaum_json_blocks,
    parse_ter_rows,
    quarter_end_from_period_label,
)


def test_parse_ter_rows_regular_only() -> None:
    rows = [
        {
            "Scheme_Name": "Test Fund - Growth",
            "R_TER": "1.94",
            "D_TER": "0.45",
            "TER_Date": "2026-03-01T00:00:00.000Z",
        }
    ]
    parsed = parse_ter_rows(rows)
    assert len(parsed) == 1
    assert parsed[0]["plan_type"] == "REGULAR"
    assert parsed[0]["ter_percent"] == Decimal("1.94")


def test_parse_aaum_json_blocks() -> None:
    blocks = [
        {
            "schemes": [
                {
                    "SchemeNAVName": "Sample Fund",
                    "AMFI_Code": 123456,
                    "AverageAumForTheMonth": {
                        "ExcludingFundOfFundsDomesticButIncludingFundOfFundsOverseas": 100.5
                    },
                }
            ]
        }
    ]
    parsed = parse_aaum_json_blocks(blocks)
    assert len(parsed) == 1
    assert parsed[0]["scheme_code"] == "123456"
    assert parsed[0]["aum_crores"] == Decimal("100.5")


def test_quarter_end_from_period_label() -> None:
    assert quarter_end_from_period_label("January - March 2026") == date(2026, 3, 31)


def test_normalize_scheme_name() -> None:
    assert normalize_scheme_name("ABC Fund - Regular Plan - Growth") == "abc fund growth"


def test_crores_to_inr() -> None:
    assert crores_to_inr(Decimal("1.25")) == Decimal("12500000.00")
