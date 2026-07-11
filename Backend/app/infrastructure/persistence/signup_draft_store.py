from __future__ import annotations

import json
import secrets
from typing import Any

from app.core.config import get_settings
from app.core.redis import get_redis

SIGNUP_TTL_SECONDS = 1800


def _signup_key(token: str) -> str:
    return f"signup:{token}"


async def create_signup_draft(email: str, *, referral_code: str | None = None) -> str:
    settings = get_settings()
    token = secrets.token_urlsafe(32)
    redis = await get_redis(settings.redis_cache_db)
    draft: dict[str, Any] = {
        "email": email.lower().strip(),
        "email_verified": False,
        "password_hash": None,
        "mobile": None,
        "mobile_verified": False,
        "country_code": "IN",
    }
    if referral_code:
        draft["referral_code"] = referral_code
    await redis.setex(_signup_key(token), SIGNUP_TTL_SECONDS, json.dumps(draft))
    return token


async def get_signup_draft(token: str) -> dict[str, Any] | None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    raw = await redis.get(_signup_key(token))
    if not raw:
        return None
    return json.loads(raw)


async def update_signup_draft(token: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    key = _signup_key(token)
    raw = await redis.get(key)
    if not raw:
        return None
    draft = json.loads(raw)
    draft.update(updates)
    ttl = await redis.ttl(key)
    if ttl <= 0:
        ttl = SIGNUP_TTL_SECONDS
    await redis.setex(key, ttl, json.dumps(draft))
    return draft


async def delete_signup_draft(token: str) -> None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    await redis.delete(_signup_key(token))
