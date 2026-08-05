from __future__ import annotations

from app.core.config import Settings, get_settings

AMC_LOGO_EXTENSIONS = ("png", "svg", "jpg", "jpeg")
_slug_logo_key_cache: dict[str, str | None] = {}


def amc_logo_storage_key(slug: str, *, extension: str = "png") -> str:
    return f"public/amcs/{slug}.{extension.lstrip('.')}"


def build_public_asset_url(storage_key: str, settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    key = storage_key.lstrip("/")
    cdn_base = settings.resolved_documents_cdn_base_url
    if cdn_base:
        return f"{cdn_base}/{key}"
    return f"{settings.resolved_api_public_url}/invest/assets/{key}"


def _parse_stored_logo_storage_key(stored_url: str) -> str | None:
    if stored_url.startswith("storage:"):
        return stored_url.removeprefix("storage:")
    if "/invest/assets/" in stored_url:
        return stored_url.split("/invest/assets/", 1)[1].lstrip("/")
    if stored_url.startswith("http://") or stored_url.startswith("https://"):
        return None
    return stored_url.lstrip("/") or None


def _discover_amc_logo_storage_key(slug: str, settings: Settings) -> str | None:
    if not slug:
        return None

    cached = _slug_logo_key_cache.get(slug)
    if slug in _slug_logo_key_cache:
        return cached

    bucket = settings.public_assets_bucket
    discovered: str | None = None

    if settings.document_storage_provider == "local":
        base = settings.resolved_documents_root / bucket
        for extension in AMC_LOGO_EXTENSIONS:
            storage_key = amc_logo_storage_key(slug, extension=extension)
            if (base / storage_key).is_file():
                discovered = storage_key
                break
    else:
        from app.infrastructure.storage.documents.factory import get_document_storage

        storage = get_document_storage(settings)
        for extension in AMC_LOGO_EXTENSIONS:
            storage_key = amc_logo_storage_key(slug, extension=extension)
            if storage.exists(bucket=bucket, storage_key=storage_key):
                discovered = storage_key
                break

    _slug_logo_key_cache[slug] = discovered
    return discovered


def resolve_amc_logo_url(stored_url: str | None, slug: str, settings: Settings | None = None) -> str | None:
    settings = settings or get_settings()
    storage_key: str | None = None

    if stored_url:
        if stored_url.startswith("http://") or stored_url.startswith("https://"):
            return stored_url
        storage_key = _parse_stored_logo_storage_key(stored_url)
    elif slug:
        storage_key = _discover_amc_logo_storage_key(slug, settings)

    if storage_key:
        return build_public_asset_url(storage_key, settings)
    return None


def enrich_fund_summary_logo(item: dict, settings: Settings | None = None) -> dict:
    settings = settings or get_settings()
    slug = str(item.get("amc_slug") or "")
    if not slug:
        return item
    resolved = resolve_amc_logo_url(item.get("amc_logo_url"), slug, settings)
    if item.get("amc_logo_url") == resolved:
        return item
    return {**item, "amc_logo_url": resolved}


def enrich_fund_list_payload(payload: dict, settings: Settings | None = None) -> dict:
    settings = settings or get_settings()
    items = payload.get("items")
    if not isinstance(items, list):
        return payload
    enriched_items = [enrich_fund_summary_logo(item, settings) for item in items]
    if enriched_items == items:
        return payload
    return {**payload, "items": enriched_items}


def enrich_invest_home_payload(payload: dict, settings: Settings | None = None) -> dict:
    settings = settings or get_settings()
    enriched = payload
    for key in ("popular_funds", "featured_funds"):
        funds = payload.get(key)
        if not isinstance(funds, list):
            continue
        enriched_funds = [enrich_fund_summary_logo(item, settings) for item in funds]
        if enriched_funds != funds:
            enriched = {**enriched, key: enriched_funds}
    return enriched
