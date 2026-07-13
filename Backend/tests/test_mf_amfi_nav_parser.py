from __future__ import annotations

from app.application.mf.amfi_nav_parser import parse_amfi_nav_file, parse_amfi_nav_line


def test_parse_amfi_nav_line_valid() -> None:
    line = "119551;INF109K01Y07;INF109K01Y15;ICICI Prudential Technology Fund - Growth;245.1234;08-Apr-2026"
    parsed = parse_amfi_nav_line(line)
    assert parsed is not None
    assert parsed["scheme_code"] == "119551"
    assert parsed["isin_growth"] == "INF109K01Y07"
    assert parsed["nav_value"] == parsed["nav_value"].__class__("245.1234")


def test_parse_amfi_nav_line_skips_header() -> None:
    assert parse_amfi_nav_line("Open Ended Schemes (Equity Scheme)") is None


def test_parse_amfi_nav_history_line_valid() -> None:
    line = (
        "112077;UTI MMF - Regular Plan - Growth Option;INF789F01PX8;;3234.0129;;;08-Apr-2026"
    )
    parsed = parse_amfi_nav_line(line)
    assert parsed is not None
    assert parsed["scheme_code"] == "112077"
    assert parsed["isin_growth"] == "INF789F01PX8"
    assert parsed["nav_value"] == parsed["nav_value"].__class__("3234.0129")
    assert parsed["nav_date_raw"] == "08-Apr-2026"


def test_parse_amfi_nav_file_counts_rows() -> None:
    body = "\n".join(
        [
            "Open Ended Schemes",
            "119551;INF109K01Y07;INF109K01Y15;Fund A - Growth;100.5;08-Apr-2026",
            "119552;INF109K01Y16;INF109K01Y24;Fund B - Growth;200.5;08-Apr-2026",
        ]
    )
    rows = parse_amfi_nav_file(body)
    assert len(rows) == 2
