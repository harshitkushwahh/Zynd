from __future__ import annotations

from pathlib import Path

from app.application.mf.amc_name_parser import parse_amc_from_scheme_name
from app.application.mf.amfi_nav_parser import parse_amfi_nav_file_with_context
from app.application.mf.invest_amc_display import resolve_invest_amc_display
from app.application.mf.public_asset_service import (
    amc_logo_storage_key,
    build_public_asset_url,
    enrich_fund_summary_logo,
)
from app.core.config import Settings


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


def test_parse_amc_from_scheme_name_kotak_index_nfo() -> None:
    assert (
        parse_amc_from_scheme_name("KOTAK NIFTY 500 INDEX FUND - REGULAR PLAN - GROWTH")
        == "Kotak Mahindra Mutual Fund"
    )


def test_parse_amc_from_scheme_name_quant_index_nfo() -> None:
    assert (
        parse_amc_from_scheme_name("QUANT NIFTY MIDCAP 150 INDEX FUND - REGULAR PLAN - GROWTH")
        == "Quant Mutual Fund"
    )
    assert (
        parse_amc_from_scheme_name("QUANTUM VALUE FUND - REGULAR PLAN GROWTH OPTION")
        == "Quantum Mutual Fund"
    )


def test_resolve_invest_amc_display_from_unknown_amc_quant_scheme(tmp_path: Path) -> None:
    settings = Settings(
        document_storage_provider="local",
        documents_root=str(tmp_path),
        public_assets_bucket="zynd-public-assets",
        api_public_url="http://localhost:8000",
    )
    storage_key = amc_logo_storage_key("quant-mutual-fund")
    logo_path = tmp_path / settings.public_assets_bucket / storage_key
    logo_path.parent.mkdir(parents=True, exist_ok=True)
    logo_path.write_bytes(b"\x89PNG\r\n\x1a\n")

    name, slug, logo = resolve_invest_amc_display(
        amc_name="Unknown AMC",
        amc_slug="unknown-amc",
        amc_logo_url=None,
        scheme_name="QUANT NIFTY 50 INDEX FUND - REGULAR PLAN - GROWTH",
        settings=settings,
    )

    assert name == "Quant Mutual Fund"
    assert slug == "quant-mutual-fund"
    assert logo == build_public_asset_url(storage_key, settings)


def test_resolve_invest_amc_display_from_unknown_amc_kotak_scheme(tmp_path: Path) -> None:
    settings = Settings(
        document_storage_provider="local",
        documents_root=str(tmp_path),
        public_assets_bucket="zynd-public-assets",
        api_public_url="http://localhost:8000",
    )
    storage_key = amc_logo_storage_key("kotak-mahindra-mutual-fund")
    logo_path = tmp_path / settings.public_assets_bucket / storage_key
    logo_path.parent.mkdir(parents=True, exist_ok=True)
    logo_path.write_bytes(b"\x89PNG\r\n\x1a\n")

    name, slug, logo = resolve_invest_amc_display(
        amc_name="Unknown AMC",
        amc_slug="unknown-amc",
        amc_logo_url=None,
        scheme_name="KOTAK NIFTY SDL JUL 2028 INDEX FUND -REGULAR PLAN-GROWTH",
        settings=settings,
    )

    assert name == "Kotak Mahindra Mutual Fund"
    assert slug == "kotak-mahindra-mutual-fund"
    assert logo == build_public_asset_url(storage_key, settings)


def test_enrich_fund_summary_logo_repairs_stale_unknown_amc(tmp_path: Path) -> None:
    settings = Settings(
        document_storage_provider="local",
        documents_root=str(tmp_path),
        public_assets_bucket="zynd-public-assets",
        api_public_url="http://localhost:8000",
    )
    storage_key = amc_logo_storage_key("kotak-mahindra-mutual-fund")
    logo_path = tmp_path / settings.public_assets_bucket / storage_key
    logo_path.parent.mkdir(parents=True, exist_ok=True)
    logo_path.write_bytes(b"\x89PNG\r\n\x1a\n")

    enriched = enrich_fund_summary_logo(
        {
            "name": "KOTAK NIFTY SDL JUL 2028 INDEX FUND -REGULAR PLAN-GROWTH",
            "amc_name": "Unknown AMC",
            "amc_slug": "unknown-amc",
            "amc_logo_url": None,
        },
        settings,
    )

    assert enriched["amc_name"] == "Kotak Mahindra Mutual Fund"
    assert enriched["amc_slug"] == "kotak-mahindra-mutual-fund"
    assert enriched["amc_logo_url"] == build_public_asset_url(storage_key, settings)
