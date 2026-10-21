from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.auth_cache_invalidation import PROFILE_IMAGE_PREFIX
from app.application.documents.profile_image_url_service import (
    resolve_profile_image_urls_by_user_id as _resolve_urls,
)
from app.application.shared.redis_json_cache import get_json, set_json
from app.core.config import Settings, get_settings


async def resolve_profile_image_url_cached(
    db: AsyncSession,
    user_id: UUID,
    *,
    settings: Settings | None = None,
) -> str | None:
    settings = settings or get_settings()
    key = f"{PROFILE_IMAGE_PREFIX}{user_id}"
    if settings.auth_profile_image_url_cache_enabled:
        cached = await get_json(key, settings=settings)
        if cached is not None:
            if cached == "":
                return None
            return str(cached)

    urls = await _resolve_urls(db, [user_id], settings=settings)
    url = urls.get(user_id)
    if settings.auth_profile_image_url_cache_enabled:
        await set_json(
            key,
            url or "",
            ttl_seconds=settings.auth_profile_image_url_cache_ttl_seconds,
            jitter_seconds=settings.auth_profile_image_url_cache_jitter_seconds,
            settings=settings,
        )
    return url
