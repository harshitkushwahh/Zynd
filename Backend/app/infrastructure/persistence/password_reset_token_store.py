from __future__ import annotations

import logging
import secrets

from app.core.config import get_settings
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

RESET_TOKEN_TTL_SECONDS = 3600
USER_RESET_INDEX_PREFIX = "user_reset:"


async def get_active_password_reset_ttl(user_id: str) -> int | None:
    """Return remaining TTL seconds when this user already has an active reset link."""
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    ttl = await redis.ttl(f"{USER_RESET_INDEX_PREFIX}{user_id}")
    if ttl is None or ttl < 0:
        return None
    return int(ttl)


async def get_active_password_reset_token(user_id: str) -> str | None:
    """Return the active reset token for this user, if any."""
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    token = await redis.get(f"{USER_RESET_INDEX_PREFIX}{user_id}")
    if not token:
        return None
    return token


async def create_reset_token(user_id: str) -> str:
    settings = get_settings()
    token = secrets.token_urlsafe(32)
    redis = await get_redis(settings.redis_cache_db)
    await redis.setex(f"reset:{token}", RESET_TOKEN_TTL_SECONDS, user_id)
    await redis.setex(f"{USER_RESET_INDEX_PREFIX}{user_id}", RESET_TOKEN_TTL_SECONDS, token)
    if settings.debug:
        logger.info("[DEV RESET] user_id=%s token=%s", user_id, token)
    return token


async def consume_reset_token(token: str) -> str | None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    key = f"reset:{token}"
    user_id = await redis.get(key)
    if not user_id:
        return None
    await redis.delete(key)
    await redis.delete(f"{USER_RESET_INDEX_PREFIX}{user_id}")
    return user_id
