"""Redis cache helpers for unified admin search."""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any

from app.core.config import Settings, get_settings
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

CACHE_GEN_KEY = "admin:search:gen"
CACHE_HITS_KEY = "admin:search:hits"
CACHE_MISSES_KEY = "admin:search:misses"
CACHE_VERSION = "v1"


def _cache_enabled(settings: Settings | None = None) -> bool:
    settings = settings or get_settings()
    return settings.admin_search_cache_enabled


async def _get_generation(settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    client = await get_redis(settings.redis_cache_db, settings)
    value = await client.get(CACHE_GEN_KEY)
    if value is None:
        await client.set(CACHE_GEN_KEY, "1")
        return "1"
    return str(value)


def _normalize_query(query: str) -> str:
    return query.strip().lower()


def _query_hash(query: str) -> str:
    return hashlib.sha256(_normalize_query(query).encode("utf-8")).hexdigest()[:16]


async def build_admin_search_cache_key(
    *,
    scope: str,
    query: str,
    limit: int,
    offset: int,
    filters_key: str = "",
    settings: Settings | None = None,
) -> str:
    generation = await _get_generation(settings)
    filter_suffix = filters_key or "none"
    return (
        f"admin:search:{CACHE_VERSION}:g{generation}:{scope}:"
        f"{_query_hash(query)}:{limit}:{offset}:{filter_suffix}"
    )


async def get_cached_admin_search(key: str, *, settings: Settings | None = None) -> Any | None:
    if not _cache_enabled(settings):
        return None
    settings = settings or get_settings()
    client = await get_redis(settings.redis_cache_db, settings)
    raw = await client.get(key)
    if raw is None:
        await client.incr(CACHE_MISSES_KEY)
        return None
    await client.incr(CACHE_HITS_KEY)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        await client.delete(key)
        return None


async def set_cached_admin_search(
    key: str,
    payload: Any,
    *,
    settings: Settings | None = None,
) -> None:
    if not _cache_enabled(settings):
        return
    settings = settings or get_settings()
    client = await get_redis(settings.redis_cache_db, settings)
    ttl = max(settings.admin_search_cache_ttl_seconds, 1)
    await client.set(key, json.dumps(payload, default=str), ex=ttl)


async def invalidate_admin_search_cache(*, settings: Settings | None = None) -> str:
    if not _cache_enabled(settings):
        return "0"
    settings = settings or get_settings()
    client = await get_redis(settings.redis_cache_db, settings)
    generation = await client.incr(CACHE_GEN_KEY)
    logger.info("Admin search cache invalidated (generation=%s)", generation)
    return str(generation)
