from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.auth_cache_invalidation import USER_PUBLIC_PREFIX
from app.application.auth.user_service import user_to_public_dict
from app.application.shared.redis_json_cache import get_or_load_json
from app.core.config import Settings, get_settings
from app.infrastructure.persistence.models import User


async def get_user_public_profile(
    db: AsyncSession,
    user: User,
    *,
    settings: Settings | None = None,
) -> dict[str, Any]:
    settings = settings or get_settings()
    if not settings.auth_user_public_cache_enabled:
        return await user_to_public_dict(db, user)

    key = f"{USER_PUBLIC_PREFIX}{user.id}"

    async def loader() -> dict[str, Any]:
        return await user_to_public_dict(db, user)

    return await get_or_load_json(
        key,
        loader,
        ttl_seconds=settings.auth_user_public_cache_ttl_seconds,
        jitter_seconds=settings.auth_user_public_cache_jitter_seconds,
        settings=settings,
    )
