from __future__ import annotations

from app.core.config import get_settings
from app.core.redis import get_redis


async def check_rate_limit(key: str, limit: int, window_seconds: int) -> bool:
    """Return True if request is allowed, False if rate limited."""
    settings = get_settings()
    if settings.app_env == "development" and settings.dev_skip_rate_limits:
        return True

    redis = await get_redis(settings.redis_cache_db)
    full_key = f"rl:{key}"
    current = await redis.incr(full_key)
    if current == 1:
        await redis.expire(full_key, window_seconds)
    return current <= limit
