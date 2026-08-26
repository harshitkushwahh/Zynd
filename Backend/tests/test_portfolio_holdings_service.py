from __future__ import annotations

from app.application.mf.portfolio_holdings_service import (
    _extract_folio_meta,
    build_portfolio_holding_id,
    parse_holdings_report,
    parse_holding_id,
    parse_investment_account_returns,
    parse_mf_transactions,
    parse_scheme_wise_returns,
    _apply_holding_day_change,
    _compute_allocation_slices,
    _compute_portfolio_day_change,
    _portfolio_slice_for_sebi,
)


def test_portfolio_slice_for_sebi_maps_equity_debt_hybrid_other() -> None:
    assert _portfolio_slice_for_sebi("Equity Large Cap Fund") == "equity"
    assert _portfolio_slice_for_sebi("Liquid Fund") == "debt"
    assert _portfolio_slice_for_sebi("Aggressive Hybrid Fund") == "hybrid"
    assert _portfolio_slice_for_sebi("FoF Overseas") == "other"
    assert _portfolio_slice_for_sebi(None) == "other"


def test_build_portfolio_holding_id() -> None:
    holding_id = build_portfolio_holding_id(folio_number="12345/67", isin="INF109K01Y46")
    assert holding_id == "12345/67::INF109K01Y46"


def test_parse_holdings_report_flattens_folios_and_schemes() -> None:
    payload = {
        "folios": [
            {
                "folio_number": "12345/67",
                "schemes": [
                    {
                        "isin": "inf109k01y46",
                        "name": "ICICI Pru Bluechip Fund",
                        "holdings": {"units": 120.45, "redeemable_units": 120.45},
                        "market_value": {"amount": 15200.5, "redeemable_amount": 15200.5},
                        "invested_value": {"amount": 12000},
                        "nav": {"value": 126.2, "as_on": "2026-08-05"},
                    }
                ],
            }
        ]
    }

    rows = parse_holdings_report(payload)
    assert len(rows) == 1
    row = rows[0]
    assert row["folio_number"] == "12345/67"
    assert row["isin"] == "INF109K01Y46"
    assert row["units"] == 120.45
    assert row["current_value_inr"] == 15200.5
    assert row["invested_inr"] == 12000.0
    assert row["nav"] == 126.2
    assert row["nav_as_on"] == "2026-08-05"


def test_parse_investment_account_returns_maps_first_row() -> None:
    payload = {
        "data": {
            "columns": [
                "mf_investment_account",
                "invested_amount",
                "current_value",
                "unrealized_gain",
                "absolute_return",
                "xirr",
            ],
            "rows": [["mfia_test", 12000, 15200.5, 3200.5, 26.67, 14.2]],
        }
    }

    returns = parse_investment_account_returns(payload)
    assert returns["invested_inr"] == 12000
    assert returns["current_value_inr"] == 15200.5
    assert returns["total_return_inr"] == 3200.5
    assert returns["total_return_pct"] == 26.67
    assert returns["xirr_pct"] == 14.2


def test_compute_allocation_slices_groups_by_sebi_category() -> None:
    rows = [
        {"isin": "INF1", "current_value_inr": 6000},
        {"isin": "INF2", "current_value_inr": 4000},
    ]
    isin_category = {
        "INF1": "Equity Large Cap Fund",
        "INF2": "Liquid Fund",
    }

    slices = _compute_allocation_slices(rows, isin_category=isin_category)
    by_id = {item["id"]: item for item in slices}

    assert by_id["equity"]["value_pct"] == 60.0
    assert by_id["debt"]["value_pct"] == 40.0


def test_parse_holding_id_round_trip() -> None:
    holding_id = build_portfolio_holding_id(folio_number="12345/67", isin="INF109K01Y46")
    parsed = parse_holding_id(holding_id)
    assert parsed == ("12345/67", "INF109K01Y46")


def test_parse_mf_transactions_filters_by_isin_and_maps_types() -> None:
    payload = {
        "data": [
            {
                "id": "txn-1",
                "isin": "INF109K01Y46",
                "type": "purchase",
                "traded_on": "2026-07-01",
                "units": 52.84,
                "price": 138.4,
                "amount": 7500,
            },
            {
                "id": "txn-2",
                "isin": "INF000K01Y46",
                "type": "purchase",
                "traded_on": "2026-06-01",
                "units": 10,
                "price": 100,
                "amount": 1000,
            },
            {
                "id": "txn-3",
                "isin": "INF109K01Y46",
                "type": "redemption",
                "traded_on": "2026-08-01",
                "units": 5,
                "price": 140,
                "amount": 700,
            },
        ]
    }

    rows = parse_mf_transactions(payload, isin="INF109K01Y46")
    assert len(rows) == 2
    assert rows[0]["type"] == "redeemed"
    assert rows[1]["type"] == "invested"


def test_parse_scheme_wise_returns_finds_isin_row() -> None:
    payload = {
        "data": {
            "columns": ["isin", "invested_amount", "current_value", "unrealized_gain", "absolute_return", "xirr"],
            "rows": [
                ["INF000K01Y46", 1000, 1100, 100, 10, 8.5],
                ["INF109K01Y46", 12000, 15200, 3200, 26.67, 14.2],
            ],
        }
    }

    returns = parse_scheme_wise_returns(payload, isin="INF109K01Y46")
    assert returns["xirr_pct"] == 14.2
    assert returns["current_value_inr"] == 15200


def test_compute_portfolio_day_change_weighted_by_value() -> None:
    holdings = [
        {"isin": "INF1", "current_value_inr": 6000},
        {"isin": "INF2", "current_value_inr": 4000},
    ]
    return_1d_by_isin = {"INF1": 2.0, "INF2": -1.0}

    day_change_inr, day_change_pct = _compute_portfolio_day_change(
        holdings,
        return_1d_by_isin=return_1d_by_isin,
    )

    assert day_change_inr == 80.0
    assert day_change_pct == 0.8


def test_apply_holding_day_change_sets_per_holding_fields() -> None:
    holdings = [{"isin": "INF1", "current_value_inr": 10000}]
    _apply_holding_day_change(holdings, return_1d_by_isin={"INF1": 1.5})

    assert holdings[0]["day_change_inr"] == 150.0
    assert holdings[0]["day_change_pct"] == 1.5


def test_compute_portfolio_day_change_returns_none_without_nav_coverage() -> None:
    holdings = [{"isin": "INF1", "current_value_inr": 5000}]

    day_change_inr, day_change_pct = _compute_portfolio_day_change(
        holdings,
        return_1d_by_isin={},
    )

    assert day_change_inr is None
    assert day_change_pct is None


def test_extract_folio_meta_resolves_bank_name_from_ifsc() -> None:
    meta = _extract_folio_meta(
        {
            "data": [
                {
                    "payout_details": [
                        {
                            "bank_account": {
                                "account_number": "1234569725",
                                "ifsc_code": "KKBK0000591",
                            }
                        }
                    ]
                }
            ]
        }
    )

    assert meta["redeem_bank_label"] == "Kotak Mahindra Bank ....9725"
    assert meta["redeem_bank_name"] == "Kotak Mahindra Bank"
    assert meta["redeem_bank_ifsc"] == "KKBK0000591"
