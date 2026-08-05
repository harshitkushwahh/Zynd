from __future__ import annotations

import logging
import secrets

from app.core.config import get_settings
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

FAMILY_INVITE_TOKEN_TTL_SECONDS = 7 * 24 * 3600


async def create_family_invite_token(invite_id: str) -> str:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    existing = await redis.get(f"family_invite_id:{invite_id}")
    if existing is not None:
        return existing.decode() if isinstance(existing, bytes) else existing

    token = secrets.token_urlsafe(32)
    await redis.setex(f"family_invite:{token}", FAMILY_INVITE_TOKEN_TTL_SECONDS, invite_id)
    await redis.setex(f"family_invite_id:{invite_id}", FAMILY_INVITE_TOKEN_TTL_SECONDS, token)
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
    invite_id = await redis.get(f"family_invite:{token}")
    await redis.delete(f"family_invite:{token}")
    if invite_id is not None:
        invite_id_value = invite_id.decode() if isinstance(invite_id, bytes) else invite_id
        await redis.delete(f"family_invite_id:{invite_id_value}")


async def delete_family_invite_tokens_for_invite(invite_id: str) -> None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    token = await redis.get(f"family_invite_id:{invite_id}")
    if token is not None:
        token_value = token.decode() if isinstance(token, bytes) else token
        await redis.delete(f"family_invite:{token_value}")
    await redis.delete(f"family_invite_id:{invite_id}")
