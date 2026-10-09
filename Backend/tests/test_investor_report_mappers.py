from datetime import date

from app.application.mf.investor_report_mappers import (
    current_indian_fy,
    folios_section,
    holdings_section,
    parse_capital_gains_report,
    parse_statement_transactions,
)
from app.application.mf.investor_report_pdf import CONTENT_INSET, FOOTER_INSET, document_page_metrics
from reportlab.lib.units import mm


def test_parse_capital_gains_report_maps_columns() -> None:
    payload = {
        "data": {
            "columns": [
                "folio_number",
                "isin",
                "scheme_name",
                "type",
                "amount",
                "units",
                "traded_on",
                "source_taxable_gain",
                "grand_fathering",
            ],
            "rows": [
                [
                    "62010247",
                    "INF760K01EL8",
                    "Canara Robeco ELSS",
                    "redemption",
                    1200.0,
                    100.0,
                    "2020-01-02",
                    -5070.0,
                    True,
                ]
            ],
        }
    }

    rows = parse_capital_gains_report(payload)
    assert len(rows) == 1
    assert rows[0]["folio"] == "62010247"
    assert rows[0]["scheme"] == "Canara Robeco ELSS\nINF760K01EL8"
    assert rows[0]["type"] == "redemption"
    assert rows[0]["units"] == "100.000"
    assert rows[0]["traded_on"] == "2020-01-02"
    assert rows[0]["grandfathering"] == "Yes"
    assert rows[0]["taxable_gain"].startswith("-")


def test_parse_statement_transactions_keeps_folio_and_scheme() -> None:
    payload = {
        "data": [
            {
                "folio_number": "12345",
                "isin": "INF109K01Y46",
                "type": "purchase",
                "traded_on": "2026-07-01",
                "units": 10,
                "traded_at": 100,
                "amount": 1000,
                "rta_scheme_name": "Bluechip",
            }
        ]
    }

    rows = parse_statement_transactions(payload)
    assert len(rows) == 1
    assert rows[0]["folio"] == "12345"
    assert rows[0]["scheme"] == "Bluechip\nINF109K01Y46"
    assert rows[0]["isin"] == "INF109K01Y46"
    assert rows[0]["raw_type"] == "purchase"


def test_current_indian_fy_starts_in_april() -> None:
    start, end = current_indian_fy(date(2026, 10, 9))
    assert start == date(2026, 4, 1)
    assert end == date(2026, 10, 9)

    start, end = current_indian_fy(date(2026, 3, 15))
    assert start == date(2025, 4, 1)
    assert end == date(2026, 3, 15)


def test_document_page_metrics_are_even_18mm() -> None:
    metrics = document_page_metrics()
    assert metrics["left_margin"] == 18 * mm
    assert metrics["right_margin"] == 18 * mm
    assert metrics["left_margin"] == metrics["right_margin"]
    assert metrics["top_margin"] == CONTENT_INSET
    assert metrics["bottom_margin"] == FOOTER_INSET
    assert metrics["edge_margin"] == 18 * mm


def test_holdings_section_includes_pnl_and_isin() -> None:
    section = holdings_section(
        {
            "folios": [
                {
                    "folio_number": "12345",
                    "schemes": [
                        {
                            "isin": "INF109K01Y46",
                            "name": "Bluechip",
                            "holdings": {"units": 10},
                            "market_value": {"amount": 1100, "as_on": "2026-10-08"},
                            "invested_value": {"amount": 1000},
                            "nav": {"value": 110, "as_on": "2026-10-08"},
                        }
                    ],
                }
            ]
        }
    )
    assert section.rows[0]["scheme"] == "Bluechip\nINF109K01Y46"
    assert "100.00" in section.rows[0]["pnl"]
    assert "as on 2026-10-08" in section.rows[0]["pnl"]


def test_folios_section_maps_nominee_and_bank() -> None:
    section = folios_section(
        {
            "data": [
                {
                    "number": "12345",
                    "nominee1": {"name": "Priya"},
                    "payout_details": [{"bank_name": "HDFC Bank", "account_number": "00001111"}],
                }
            ]
        }
    )
    assert section.rows[0]["folio"] == "12345"
    assert section.rows[0]["nominee"] == "Priya"
    assert "1111" in section.rows[0]["bank"]
