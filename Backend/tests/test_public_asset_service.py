from pathlib import Path

import pytest

from app.application.mf import public_asset_service
from app.application.mf.public_asset_service import (
    amc_logo_storage_key,
    build_public_asset_url,
    resolve_amc_logo_url,
)
from app.core.config import Settings


@pytest.fixture(autouse=True)
def clear_logo_cache():
    public_asset_service._slug_logo_key_cache.clear()
    yield
    public_asset_service._slug_logo_key_cache.clear()


def test_resolve_amc_logo_url_from_storage_prefix(tmp_path: Path):
    settings = Settings(
        document_storage_provider="local",
        documents_root=str(tmp_path),
        public_assets_bucket="zynd-public-assets",
        api_public_url="http://localhost:8000",
    )
    storage_key = amc_logo_storage_key("uti-mutual-fund")
    logo_path = tmp_path / settings.public_assets_bucket / storage_key
    logo_path.parent.mkdir(parents=True, exist_ok=True)
    logo_path.write_bytes(b"\x89PNG\r\n\x1a\n")

    url = resolve_amc_logo_url(None, "uti-mutual-fund", settings)

    assert url == build_public_asset_url(storage_key, settings)


def test_resolve_amc_logo_url_prefers_stored_url(tmp_path: Path):
    settings = Settings(
        document_storage_provider="local",
        documents_root=str(tmp_path),
        public_assets_bucket="zynd-public-assets",
        api_public_url="http://localhost:8000",
    )
    storage_key = amc_logo_storage_key("axis-mutual-fund", extension="svg")
    stored = f"storage:{storage_key}"

    url = resolve_amc_logo_url(stored, "axis-mutual-fund", settings)

    assert url == build_public_asset_url(storage_key, settings)


def test_resolve_amc_logo_url_discovers_svg_when_png_missing(tmp_path: Path):
    settings = Settings(
        document_storage_provider="local",
        documents_root=str(tmp_path),
        public_assets_bucket="zynd-public-assets",
        api_public_url="http://localhost:8000",
    )
    storage_key = amc_logo_storage_key("icici-mutual-fund", extension="svg")
    logo_path = tmp_path / settings.public_assets_bucket / storage_key
    logo_path.parent.mkdir(parents=True, exist_ok=True)
    logo_path.write_text("<svg></svg>", encoding="utf-8")

    url = resolve_amc_logo_url(None, "icici-mutual-fund", settings)

    assert url == build_public_asset_url(storage_key, settings)


def test_enrich_fund_summary_logo_fills_missing_url(tmp_path: Path):
    settings = Settings(
        document_storage_provider="local",
        documents_root=str(tmp_path),
        public_assets_bucket="zynd-public-assets",
        api_public_url="http://localhost:8000",
    )
    storage_key = amc_logo_storage_key("uti-mutual-fund")
    logo_path = tmp_path / settings.public_assets_bucket / storage_key
    logo_path.parent.mkdir(parents=True, exist_ok=True)
    logo_path.write_bytes(b"\x89PNG\r\n\x1a\n")

    enriched = public_asset_service.enrich_fund_summary_logo(
        {"amc_slug": "uti-mutual-fund", "amc_logo_url": None},
        settings,
    )

    assert enriched["amc_logo_url"] == build_public_asset_url(storage_key, settings)


def test_resolve_amc_logo_url_returns_none_when_missing(tmp_path: Path):
    settings = Settings(
        document_storage_provider="local",
        documents_root=str(tmp_path),
        public_assets_bucket="zynd-public-assets",
        api_public_url="http://localhost:8000",
    )

    assert resolve_amc_logo_url(None, "missing-amc", settings) is None
