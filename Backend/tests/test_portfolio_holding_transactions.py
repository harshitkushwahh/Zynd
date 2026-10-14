from __future__ import annotations

from app.application.mf.portfolio_holdings_service import (
    _dedupe_holding_transactions,
    _merge_holding_transactions,
)


def test_merge_holding_transactions_matches_order_within_date_window() -> None:
    fp = [
        {
            "id": "fp-txn-1",
            "date": "2026-10-07",
            "type": "invested",
            "units": 2.815,
            "nav": 0.0,
            "value_inr": 100.0,
        }
    ]
    orders = [
        {
            "id": "order-uuid",
            "order_id": "order-uuid",
            "status": "SUCCEEDED",
            "order_type": "LUMPSUM",
            "date": "2026-10-08",
            "type": "invested",
            "units": 0.0,
            "nav": 0.0,
            "value_inr": 100.0,
        }
    ]
    merged = _merge_holding_transactions(fp, orders)
    assert len(merged) == 1
    assert merged[0]["order_id"] == "order-uuid"
    assert merged[0]["status"] == "SUCCEEDED"


def test_merge_holding_transactions_links_fp_units_to_order() -> None:
    fp = [
        {
            "id": "fp-txn-1",
            "date": "2026-10-07",
            "type": "invested",
            "units": 2.815,
            "nav": 0.0,
            "value_inr": 100.0,
        }
    ]
    orders = [
        {
            "id": "order-uuid",
            "order_id": "order-uuid",
            "status": "SUCCEEDED",
            "order_type": "LUMPSUM",
            "date": "2026-10-07",
            "type": "invested",
            "units": 0.0,
            "nav": 0.0,
            "value_inr": 100.0,
        }
    ]
    merged = _merge_holding_transactions(fp, orders)
    assert len(merged) == 1
    row = merged[0]
    assert row["order_id"] == "order-uuid"
    assert row["status"] == "SUCCEEDED"
    assert row["units"] == 2.815
    assert row["nav"] == round(100.0 / 2.815, 4)


def test_merge_prefers_succeeded_order_when_fp_has_units() -> None:
    """Folio allotment must not attach to an older in-progress attempt with the same amount."""
    fp = [
        {
            "id": "fp-txn-1",
            "date": "2026-10-07",
            "type": "invested",
            "units": 2.815,
            "nav": 35.52,
            "value_inr": 100.0,
        }
    ]
    orders = [
        {
            "id": "order-pending",
            "order_id": "order-pending",
            "status": "PROCESSING",
            "order_type": "LUMPSUM",
            "date": "2026-10-07",
            "type": "invested",
            "units": 0.0,
            "nav": 0.0,
            "value_inr": 100.0,
        },
        {
            "id": "order-succeeded",
            "order_id": "order-succeeded",
            "status": "SUCCEEDED",
            "order_type": "LUMPSUM",
            "date": "2026-10-09",
            "type": "invested",
            "units": 0.0,
            "nav": 0.0,
            "value_inr": 100.0,
        },
    ]
    merged = _merge_holding_transactions(fp, orders)
    assert len(merged) == 1
    row = merged[0]
    assert row["order_id"] == "order-succeeded"
    assert row["status"] == "SUCCEEDED"
    assert row["units"] == 2.815
    assert row["date"] == "2026-10-09"


def test_dedupe_holding_transactions_collapses_failed_when_settled_exists() -> None:
    merged = _dedupe_holding_transactions(
        [
            {
                "id": "fp-1",
                "date": "2026-10-07",
                "type": "invested",
                "units": 2.815,
                "nav": 35.52,
                "value_inr": 100.0,
            },
            {
                "id": "order-failed-1",
                "order_id": "order-failed-1",
                "status": "FAILED",
                "order_type": "LUMPSUM",
                "date": "2026-10-07",
                "type": "invested",
                "units": 0.0,
                "nav": 0.0,
                "value_inr": 100.0,
            },
            {
                "id": "order-failed-2",
                "order_id": "order-failed-2",
                "status": "FAILED",
                "order_type": "LUMPSUM",
                "date": "2026-10-07",
                "type": "invested",
                "units": 0.0,
                "nav": 0.0,
                "value_inr": 100.0,
            },
        ]
    )
    assert len(merged) == 1
    assert merged[0]["units"] == 2.815


def test_dedupe_holding_transactions_keeps_one_open_failed_switch_per_day() -> None:
    merged = _dedupe_holding_transactions(
        [
            {
                "id": "sw-1",
                "order_id": "sw-1",
                "status": "FAILED",
                "order_type": "SWITCH",
                "date": "2026-10-09",
                "type": "switch",
                "units": 0.0,
                "nav": 0.0,
                "value_inr": 98.57,
            },
            {
                "id": "sw-2",
                "order_id": "sw-2",
                "status": "FAILED",
                "order_type": "SWITCH",
                "date": "2026-10-09",
                "type": "switch",
                "units": 0.0,
                "nav": 0.0,
                "value_inr": 98.57,
            },
        ]
    )
    assert len(merged) == 1
    assert merged[0]["order_id"] == "sw-1"
