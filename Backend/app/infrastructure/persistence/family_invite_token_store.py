from __future__ import annotations

import logging
import secrets

from app.core.config import get_settings
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

FAMILY_INVITE_TOKEN_TTL_SECONDS = 7 * 24 * 3600


async def create_family_invite_token(invite_id: str) -> str:
    settings = get_settings()
    token = secrets.token_urlsafe(32)
    redis = await get_redis(settings.redis_cache_db)
    await redis.setex(f"family_invite:{token}", FAMILY_INVITE_TOKEN_TTL_SECONDS, invite_id)
    if settings.debug:
        logger.info("[DEV FAMILY INVITE] invite_id=%s token=%s", invite_id, token)
    return token


async def get_family_invite_token(token: str) -> str | None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    invite_id = await redis.get(f"family_invite:{token}")
    if invite_id is None:
        return None
    return invite_id.decode() if isinstance(invite_id, bytes) else invite_id


async def delete_family_invite_token(token: str) -> None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    await redis.delete(f"family_invite:{token}")
