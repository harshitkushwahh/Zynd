from __future__ import annotations

from app.core.config import Settings, get_settings


def amc_logo_storage_key(slug: str, *, extension: str = "png") -> str:
    return f"public/amcs/{slug}.{extension.lstrip('.')}"


def build_public_asset_url(storage_key: str, settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    key = storage_key.lstrip("/")
    cdn_base = settings.resolved_documents_cdn_base_url
    if cdn_base:
        return f"{cdn_base}/{key}"
    return f"{settings.resolved_api_public_url}/invest/assets/{key}"


def resolve_amc_logo_url(stored_url: str | None, slug: str, settings: Settings | None = None) -> str | None:
    if not stored_url:
        return None
    if stored_url.startswith("http://") or stored_url.startswith("https://"):
        return stored_url
    if stored_url.startswith("storage:"):
        return build_public_asset_url(stored_url.removeprefix("storage:"), settings)
    return build_public_asset_url(stored_url, settings)
