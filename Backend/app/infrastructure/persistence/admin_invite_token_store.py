from __future__ import annotations

import logging
import secrets

from app.core.config import get_settings
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

ADMIN_INVITE_TOKEN_TTL_SECONDS = 72 * 3600


async def create_admin_invite_token(invitation_id: str) -> str:
    settings = get_settings()
    token = secrets.token_urlsafe(32)
    redis = await get_redis(settings.redis_cache_db)
    await redis.setex(f"admin_invite:{token}", ADMIN_INVITE_TOKEN_TTL_SECONDS, invitation_id)
    if settings.debug:
        logger.info("[DEV ADMIN INVITE] invitation_id=%s token=%s", invitation_id, token)
    return token


async def get_admin_invite_token(token: str) -> str | None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    invitation_id = await redis.get(f"admin_invite:{token}")
    if invitation_id is None:
        return None
    return invitation_id.decode() if isinstance(invitation_id, bytes) else invitation_id


async def delete_admin_invite_token(token: str) -> None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    await redis.delete(f"admin_invite:{token}")
