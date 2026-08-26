from __future__ import annotations

import json
import secrets
from typing import Any

from app.core.config import get_settings
from app.core.redis import get_redis
from app.infrastructure.persistence.admin_invite_token_store import ADMIN_INVITE_TOKEN_TTL_SECONDS


def _onboarding_key(token: str) -> str:
    return f"admin_invite_onboarding:{token}"


async def create_admin_invite_onboarding_draft(
    *,
    invitation_id: str,
    invite_token: str,
    email: str,
    first_name: str,
    last_name: str | None,
    password_hash: str,
    role_key: str,
) -> tuple[str, int]:
    settings = get_settings()
    onboarding_token = secrets.token_urlsafe(32)
    redis = await get_redis(settings.redis_cache_db)
    draft: dict[str, Any] = {
        "invitation_id": invitation_id,
        "invite_token": invite_token,
        "email": email,
        "first_name": first_name,
        "last_name": last_name,
        "password_hash": password_hash,
        "role_key": role_key,
        "mfa_secret": None,
        "backup_code_hashes": None,
        "mfa_confirmed_at": None,
    }
    await redis.setex(
        _onboarding_key(onboarding_token),
        ADMIN_INVITE_TOKEN_TTL_SECONDS,
        json.dumps(draft),
    )
    return onboarding_token, ADMIN_INVITE_TOKEN_TTL_SECONDS


async def get_admin_invite_onboarding_draft(token: str) -> dict[str, Any] | None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    raw = await redis.get(_onboarding_key(token))
    if not raw:
        return None
    return json.loads(raw)


async def update_admin_invite_onboarding_draft(
    token: str,
    updates: dict[str, Any],
) -> dict[str, Any] | None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    key = _onboarding_key(token)
    raw = await redis.get(key)
    if not raw:
        return None
    draft = json.loads(raw)
    draft.update(updates)
    ttl = await redis.ttl(key)
    if ttl <= 0:
        ttl = ADMIN_INVITE_TOKEN_TTL_SECONDS
    await redis.setex(key, ttl, json.dumps(draft))
    return draft


async def delete_admin_invite_onboarding_draft(token: str) -> None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    await redis.delete(_onboarding_key(token))
