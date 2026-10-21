"""Shared Redis JSON cache helpers with jittered TTL to reduce DB thundering herds."""

from __future__ import annotations

import json
import logging
from typing import Any, Callable, Coroutine, TypeVar

from app.core.config import Settings, get_settings
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

T = TypeVar("T")


def effective_ttl_seconds(key: str, ttl_seconds: int, jitter_seconds: int) -> int:
    if ttl_seconds <= 0:
        return 1
    if jitter_seconds <= 0:
        return ttl_seconds
    spread = abs(hash(key)) % (jitter_seconds + 1)
    return max(1, ttl_seconds + spread)


async def get_json(key: str, *, settings: Settings | None = None) -> Any | None:
    settings = settings or get_settings()
    try:
        client = await get_redis(settings.redis_cache_db, settings)
        raw = await client.get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception:
        logger.debug("redis_json_cache_get_failed key=%s", key, exc_info=True)
        return None


async def set_json(
    key: str,
    payload: Any,
    *,
    ttl_seconds: int,
    jitter_seconds: int = 0,
    settings: Settings | None = None,
) -> None:
    settings = settings or get_settings()
    ex = effective_ttl_seconds(key, ttl_seconds, jitter_seconds)
    try:
        client = await get_redis(settings.redis_cache_db, settings)
        await client.set(key, json.dumps(payload, default=str), ex=ex)
    except Exception:
        logger.debug("redis_json_cache_set_failed key=%s", key, exc_info=True)


async def delete_keys(*keys: str, settings: Settings | None = None) -> None:
    if not keys:
        return
    settings = settings or get_settings()
    try:
        client = await get_redis(settings.redis_cache_db, settings)
        for key in keys:
            await client.delete(key)
    except Exception:
        logger.debug("redis_json_cache_delete_failed keys=%s", keys, exc_info=True)


async def get_or_load_json(
    key: str,
    loader: Callable[[], Coroutine[Any, Any, T]],
    *,
    ttl_seconds: int,
    jitter_seconds: int = 0,
    settings: Settings | None = None,
) -> T:
    cached = await get_json(key, settings=settings)
    if cached is not None:
        return cached  # type: ignore[return-value]
    value = await loader()
    await set_json(
        key,
        value,
        ttl_seconds=ttl_seconds,
        jitter_seconds=jitter_seconds,
        settings=settings,
    )
    return value
