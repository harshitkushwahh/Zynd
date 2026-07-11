from __future__ import annotations

import logging
import secrets

from app.core.config import get_settings
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

RESET_TOKEN_TTL_SECONDS = 3600


async def create_reset_token(user_id: str) -> str:
    settings = get_settings()
    token = secrets.token_urlsafe(32)
    redis = await get_redis(settings.redis_cache_db)
    await redis.setex(f"reset:{token}", RESET_TOKEN_TTL_SECONDS, user_id)
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
    return user_id
