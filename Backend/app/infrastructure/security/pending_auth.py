from __future__ import annotations

import json
import secrets
import string
from typing import Any

from app.core.config import get_settings
from app.core.redis import get_redis


async def _redis():
    settings = get_settings()
    return await get_redis(settings.redis_cache_db)


def _hash_token(token: str) -> str:
    import hashlib

    return hashlib.sha256(token.encode()).hexdigest()


async def store_pending_auth(kind: str, token: str, payload: dict[str, Any], ttl_seconds: int) -> None:
    redis = await _redis()
    await redis.setex(f"pending:{kind}:{_hash_token(token)}", ttl_seconds, json.dumps(payload))


async def peek_pending_auth(kind: str, token: str) -> dict[str, Any] | None:
    redis = await _redis()
    key = f"pending:{kind}:{_hash_token(token)}"
    raw = await redis.get(key)
    if not raw:
        return None
    return json.loads(raw)


async def consume_pending_auth(kind: str, token: str) -> dict[str, Any] | None:
    redis = await _redis()
    key = f"pending:{kind}:{_hash_token(token)}"
    raw = await redis.get(key)
    if not raw:
        return None
    await redis.delete(key)
    return json.loads(raw)


async def store_step_up(user_id: str, session_id: str, ttl_seconds: int | None = None) -> None:
    settings = get_settings()
    redis = await _redis()
    ttl = ttl_seconds or settings.step_up_ttl_seconds
    await redis.setex(f"stepup:{user_id}:{session_id}", ttl, "1")


async def has_step_up(user_id: str, session_id: str) -> bool:
    redis = await _redis()
    return bool(await redis.get(f"stepup:{user_id}:{session_id}"))


def generate_pending_token() -> str:
    return secrets.token_urlsafe(32)


def generate_backup_codes(count: int = 10) -> list[str]:
    alphabet = string.ascii_uppercase + string.digits
    return ["".join(secrets.choice(alphabet) for _ in range(8)) for _ in range(count)]
