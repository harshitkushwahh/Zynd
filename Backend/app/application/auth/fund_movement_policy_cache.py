from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.auth_cache_invalidation import FUND_POLICY_KEY
from app.application.security.security_config_service import get_fund_movement_policy as _load_fund_policy
from app.application.shared.redis_json_cache import get_or_load_json
from app.core.config import Settings, get_settings


async def get_cached_fund_movement_policy(
    db: AsyncSession,
    *,
    settings: Settings | None = None,
) -> dict[str, bool]:
    settings = settings or get_settings()
    if not settings.auth_fund_policy_cache_enabled:
        return await _load_fund_policy(db)

    async def loader() -> dict[str, bool]:
        return await _load_fund_policy(db)

    return await get_or_load_json(
        FUND_POLICY_KEY,
        loader,
        ttl_seconds=settings.auth_fund_policy_cache_ttl_seconds,
        jitter_seconds=settings.auth_fund_policy_cache_jitter_seconds,
        settings=settings,
    )
