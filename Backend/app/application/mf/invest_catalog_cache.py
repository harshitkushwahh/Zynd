from __future__ import annotations

import json
import logging
from typing import Any

from app.core.config import Settings, get_settings
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

CACHE_GEN_KEY = "invest:catalog:gen"
CACHE_HITS_KEY = "invest:cache:hits"
CACHE_MISSES_KEY = "invest:cache:misses"
CACHE_VERSION = "v1"


def _cache_enabled(settings: Settings | None = None) -> bool:
    settings = settings or get_settings()
    return settings.zynd_mf_invest_cache_enabled


async def _get_generation(settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    client = await get_redis(settings.redis_cache_db, settings)
    value = await client.get(CACHE_GEN_KEY)
    if value is None:
        await client.set(CACHE_GEN_KEY, "1")
        return "1"
    return str(value)


async def build_invest_cache_key(kind: str, *parts: str, settings: Settings | None = None) -> str:
    generation = await _get_generation(settings)
    suffix = "|".join(parts) if parts else "all"
    return f"invest:{kind}:{CACHE_VERSION}:g{generation}:{suffix}"


async def get_cached_json(key: str, *, settings: Settings | None = None) -> Any | None:
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


async def set_cached_json(
    key: str,
    payload: Any,
    *,
    ttl_seconds: int,
    settings: Settings | None = None,
) -> None:
    if not _cache_enabled(settings):
        return
    settings = settings or get_settings()
    client = await get_redis(settings.redis_cache_db, settings)
    await client.set(key, json.dumps(payload, default=str), ex=max(ttl_seconds, 1))


async def invalidate_invest_catalog_cache(*, settings: Settings | None = None) -> str:
    """Bump cache generation so all prior invest cache keys become stale."""
    if not _cache_enabled(settings):
        return "0"
    settings = settings or get_settings()
    client = await get_redis(settings.redis_cache_db, settings)
    generation = await client.incr(CACHE_GEN_KEY)
    logger.info("Invest catalog cache invalidated (generation=%s)", generation)
    return str(generation)


async def get_invest_cache_stats(*, settings: Settings | None = None) -> dict[str, int]:
    settings = settings or get_settings()
    if not _cache_enabled(settings):
        return {"hits": 0, "misses": 0, "generation": 0}
    client = await get_redis(settings.redis_cache_db, settings)
    hits = int(await client.get(CACHE_HITS_KEY) or 0)
    misses = int(await client.get(CACHE_MISSES_KEY) or 0)
    generation = int(await client.get(CACHE_GEN_KEY) or 1)
    return {"hits": hits, "misses": misses, "generation": generation}
