from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

from app.core.config import get_settings
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

TICKET_LIST_VER_PREFIX = "support:ticket_list:ver:"
TICKET_LIST_PAGE_PREFIX = "support:ticket_list:page:"
DEFAULT_TICKET_LIST_CACHE_TTL_SECONDS = 60


def _version_key(user_id: UUID) -> str:
    return f"{TICKET_LIST_VER_PREFIX}{user_id}"


def _page_key(user_id: UUID, version: str, offset: int, limit: int) -> str:
    return f"{TICKET_LIST_PAGE_PREFIX}{user_id}:{version}:{offset}:{limit}"


async def read_customer_ticket_list_version(user_id: UUID) -> str:
    settings = get_settings()
    try:
        redis = await get_redis(settings.redis_cache_db)
        value = await redis.get(_version_key(user_id))
        return value if value else "0"
    except Exception:
        logger.debug("support_ticket_list_version_read_failed user=%s", user_id)
        return "0"


async def bump_customer_ticket_list_cache_version(user_id: UUID) -> None:
    settings = get_settings()
    try:
        redis = await get_redis(settings.redis_cache_db)
        key = _version_key(user_id)
        await redis.incr(key)
        await redis.expire(key, 86_400)
    except Exception:
        logger.debug("support_ticket_list_version_bump_failed user=%s", user_id)


async def read_cached_customer_ticket_page(
    user_id: UUID,
    *,
    offset: int,
    limit: int,
) -> dict[str, Any] | None:
    settings = get_settings()
    version = await read_customer_ticket_list_version(user_id)
    key = _page_key(user_id, version, offset, limit)
    try:
        redis = await get_redis(settings.redis_cache_db)
        raw = await redis.get(key)
        if not raw:
            return None
        return json.loads(raw)
    except Exception:
        logger.debug("support_ticket_list_cache_read_failed user=%s", user_id)
        return None


async def write_cached_customer_ticket_page(
    user_id: UUID,
    *,
    offset: int,
    limit: int,
    payload: dict[str, Any],
    ttl_seconds: int = DEFAULT_TICKET_LIST_CACHE_TTL_SECONDS,
) -> None:
    settings = get_settings()
    version = await read_customer_ticket_list_version(user_id)
    key = _page_key(user_id, version, offset, limit)
    try:
        redis = await get_redis(settings.redis_cache_db)
        await redis.setex(key, ttl_seconds, json.dumps(payload))
    except Exception:
        logger.debug("support_ticket_list_cache_write_failed user=%s", user_id)
