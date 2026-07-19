from __future__ import annotations

from app.application.mf.amc_name_parser import parse_amc_from_scheme_name
from app.application.mf.amfi_nav_parser import parse_amfi_nav_file_with_context


def test_parse_amfi_nav_file_with_amc_context() -> None:
    body = "\n".join(
        [
            "Open Ended Schemes (Equity Scheme)",
            "HDFC Mutual Fund",
            "119551;INF109K01Y07;INF109K01Y15;HDFC Flexi Cap Fund - Growth;100.5;08-Apr-2026",
        ]
    )
    rows = parse_amfi_nav_file_with_context(body)
    assert len(rows) == 1
    assert rows[0]["amc_name"] == "HDFC Mutual Fund"
    assert rows[0]["scheme_code"] == "119551"


def test_parse_amc_from_scheme_name_hdfc() -> None:
    assert parse_amc_from_scheme_name("HDFC Silver ETF FoF Direct Growth") == "HDFC Mutual Fund"


def test_parse_amc_from_scheme_name_icici() -> None:
    assert parse_amc_from_scheme_name("ICICI Prudential Technology Fund - Growth") == "ICICI Prudential Mutual Fund"
