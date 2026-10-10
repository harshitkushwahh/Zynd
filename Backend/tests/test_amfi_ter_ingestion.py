from __future__ import annotations

from datetime import date

from app.application.mf.amfi_ter_ingestion_service import (
    filter_new_ter_rows,
    resolve_ter_fund_id,
    ter_ingestion_refreshes_existing,
)


def test_monthly_scheduler_only_backfills():
    assert ter_ingestion_refreshes_existing("SCHEDULER") is False
    assert ter_ingestion_refreshes_existing("PIPELINE:abc") is True
    assert ter_ingestion_refreshes_existing("ADMIN") is True
    assert ter_ingestion_refreshes_existing("CLI") is True


def test_filter_new_ter_rows_keeps_history_and_skips_existing():
    existing = {(10, date(2000, 1, 3)), (10, date(2026, 9, 1))}
    rows = [
        {"fund_id": 10, "as_of_date": date(2000, 1, 3), "ter_percent": 1.1, "source": "AMFI_API"},
        {"fund_id": 10, "as_of_date": date(2026, 9, 1), "ter_percent": 1.2, "source": "AMFI_API"},
        {"fund_id": 10, "as_of_date": date(2026, 10, 1), "ter_percent": 1.3, "source": "AMFI_API"},
        {"fund_id": 22, "as_of_date": date(2026, 10, 1), "ter_percent": 0.9, "source": "AMFI_API"},
    ]
    fresh, already = filter_new_ter_rows(rows, existing)
    assert already == 2
    assert {(row["fund_id"], row["as_of_date"]) for row in fresh} == {
        (10, date(2026, 10, 1)),
        (22, date(2026, 10, 1)),
    }


def test_resolve_ter_fund_id_prefers_cybrilla_isin():
    indexes = {
        "by_isin": {"INF123A01016": 11, "INF123A01024": 12},
        "by_code": {},
        "by_name_plan": {("test fund growth", "REGULAR"): 99},
        "master_name_isins": {},
        "fund_plan": {11: "REGULAR", 12: "DIRECT", 99: "REGULAR"},
    }
    assert (
        resolve_ter_fund_id(indexes, plan_type="REGULAR", isin="INF123A01016", scheme_name="Test Fund Growth")
        == 11
    )
    assert resolve_ter_fund_id(indexes, plan_type="DIRECT", isin="INF123A01024") == 12


def test_resolve_ter_fund_id_uses_master_isin_when_row_has_no_isin():
    indexes = {
        "by_isin": {"INF999A01016": 33},
        "by_code": {},
        "by_name_plan": {},
        "master_name_isins": {"hdfc flexi cap growth": ["INF999A01016"]},
        "fund_plan": {33: "REGULAR"},
    }
    assert (
        resolve_ter_fund_id(
            indexes,
            plan_type="REGULAR",
            scheme_name="HDFC Flexi Cap - Growth",
        )
        == 33
    )
