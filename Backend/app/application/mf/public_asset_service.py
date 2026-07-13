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

    settings = settings or get_settings()
    storage_key: str | None = None

    if stored_url.startswith("storage:"):
        storage_key = stored_url.removeprefix("storage:")
    elif "/invest/assets/" in stored_url:
        storage_key = stored_url.split("/invest/assets/", 1)[1].lstrip("/")
    elif stored_url.startswith("http://") or stored_url.startswith("https://"):
        return stored_url
    else:
        storage_key = stored_url.lstrip("/")

    if storage_key:
        return build_public_asset_url(storage_key, settings)
    return stored_url
