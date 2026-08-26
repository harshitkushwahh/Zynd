from __future__ import annotations

import json
import secrets
from typing import Any

from app.core.config import get_settings
from app.core.redis import get_redis

PARTNER_ONBOARDING_TTL_SECONDS = 3600


def _draft_key(token: str) -> str:
    return f"partner_onboarding:{token}"


async def create_partner_onboarding_draft(
    *,
    email: str,
    manager_user_id: str,
) -> str:
    settings = get_settings()
    token = secrets.token_urlsafe(32)
    redis = await get_redis(settings.redis_cache_db)
    draft: dict[str, Any] = {
        "email": email.lower().strip(),
        "email_verified": False,
        "mobile": None,
        "mobile_verified": False,
        "pan": None,
        "pan_verified_name": None,
        "first_name": None,
        "middle_name": None,
        "last_name": None,
        "bank": None,
        "address": None,
        "documents": None,
        "manager_user_id": manager_user_id,
    }
    await redis.setex(_draft_key(token), PARTNER_ONBOARDING_TTL_SECONDS, json.dumps(draft))
    return token


async def get_partner_onboarding_draft(token: str) -> dict[str, Any] | None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    raw = await redis.get(_draft_key(token))
    if not raw:
        return None
    return json.loads(raw)


async def update_partner_onboarding_draft(
    token: str,
    updates: dict[str, Any],
) -> dict[str, Any] | None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    key = _draft_key(token)
    raw = await redis.get(key)
    if not raw:
        return None
    draft = json.loads(raw)
    draft.update(updates)
    ttl = await redis.ttl(key)
    if ttl <= 0:
        ttl = PARTNER_ONBOARDING_TTL_SECONDS
    await redis.setex(key, ttl, json.dumps(draft))
    return draft


async def delete_partner_onboarding_draft(token: str) -> None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    await redis.delete(_draft_key(token))
    await redis.delete(_profile_photo_key(token))


def _profile_photo_key(token: str) -> str:
    return f"partner_onboarding_photo:{token}"


async def set_partner_onboarding_profile_photo(
    token: str,
    *,
    content_b64: str,
    mime_type: str,
    file_name: str,
) -> None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    draft_key = _draft_key(token)
    ttl = await redis.ttl(draft_key)
    if ttl <= 0:
        ttl = PARTNER_ONBOARDING_TTL_SECONDS
    payload = json.dumps(
        {
            "content_b64": content_b64,
            "mime_type": mime_type,
            "file_name": file_name,
        }
    )
    await redis.setex(_profile_photo_key(token), ttl, payload)


async def get_partner_onboarding_profile_photo(token: str) -> dict[str, str] | None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    raw = await redis.get(_profile_photo_key(token))
    if not raw:
        return None
    return json.loads(raw)


async def delete_partner_onboarding_profile_photo(token: str) -> None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    await redis.delete(_profile_photo_key(token))


def _document_key(token: str, doc_type: str) -> str:
    return f"partner_onboarding_doc:{token}:{doc_type}"


async def set_partner_onboarding_document(
    token: str,
    *,
    doc_type: str,
    content_b64: str,
    mime_type: str,
    file_name: str,
) -> None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    draft_key = _draft_key(token)
    ttl = await redis.ttl(draft_key)
    if ttl <= 0:
        ttl = PARTNER_ONBOARDING_TTL_SECONDS
    payload = json.dumps(
        {
            "content_b64": content_b64,
            "mime_type": mime_type,
            "file_name": file_name,
        }
    )
    await redis.setex(_document_key(token, doc_type), ttl, payload)


async def get_partner_onboarding_document(token: str, doc_type: str) -> dict[str, str] | None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    raw = await redis.get(_document_key(token, doc_type))
    if not raw:
        return None
    return json.loads(raw)


async def delete_partner_onboarding_document(token: str, doc_type: str) -> None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    await redis.delete(_document_key(token, doc_type))
