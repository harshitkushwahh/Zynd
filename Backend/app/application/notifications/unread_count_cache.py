from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.notifications.notification_service import count_unread_from_db
from app.core.config import Settings, get_settings
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

CACHE_KEY_PREFIX = "notifications:unread:"


def _cache_key(user_id: UUID) -> str:
    return f"{CACHE_KEY_PREFIX}{user_id}"


def _cache_enabled(settings: Settings | None = None) -> bool:
    settings = settings or get_settings()
    return settings.notifications_unread_cache_enabled


async def get_cached_unread_count(user_id: UUID, *, settings: Settings | None = None) -> int | None:
    if not _cache_enabled(settings):
        return None

    client = await get_redis((settings or get_settings()).redis_cache_db, settings)
    value = await client.get(_cache_key(user_id))
    if value is None:
        return None
    try:
        return int(value)
    except ValueError:
        await client.delete(_cache_key(user_id))
        return None


async def set_cached_unread_count(
    user_id: UUID,
    count: int,
    *,
    settings: Settings | None = None,
) -> None:
    if not _cache_enabled(settings):
        return

    settings = settings or get_settings()
    client = await get_redis(settings.redis_cache_db, settings)
    await client.set(_cache_key(user_id), max(0, count), ex=settings.notifications_unread_cache_ttl_seconds)


async def invalidate_unread_count(user_id: UUID, *, settings: Settings | None = None) -> None:
    if not _cache_enabled(settings):
        return

    client = await get_redis((settings or get_settings()).redis_cache_db, settings)
    await client.delete(_cache_key(user_id))


async def decrement_unread_count(user_id: UUID, *, settings: Settings | None = None) -> int | None:
    if not _cache_enabled(settings):
        return None

    settings = settings or get_settings()
    client = await get_redis(settings.redis_cache_db, settings)
    key = _cache_key(user_id)
    if not await client.exists(key):
        return None

    value = await client.decr(key)
    if value < 0:
        await client.set(key, 0, ex=settings.notifications_unread_cache_ttl_seconds)
        return 0
    return value


async def resolve_unread_count(
    db: AsyncSession,
    user_id: UUID,
    *,
    settings: Settings | None = None,
) -> int:
    cached = await get_cached_unread_count(user_id, settings=settings)
    if cached is not None:
        return cached

    count = await count_unread_from_db(db, user_id)
    await set_cached_unread_count(user_id, count, settings=settings)
    return count


__all__ = [
    "decrement_unread_count",
    "get_cached_unread_count",
    "invalidate_unread_count",
    "resolve_unread_count",
    "set_cached_unread_count",
]
