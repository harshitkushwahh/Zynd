from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.redis import get_redis
from app.infrastructure.persistence.models import SecurityConfig, SecurityConfigHistory

CACHE_TTL_SECONDS = 60

DEFAULT_SECURITY_CONFIG: dict[str, Any] = {
    "lockout.captcha_after_attempt": 4,
    "lockout.backoff_base_seconds": 2,
    "lockout.backoff_start_attempt": 5,
    "lockout.max_attempts": 8,
    "lockout.duration_minutes": 15,
    "lockout.ip_block_threshold": 20,
    "risk.medium_score": 40,
    "risk.high_score": 70,
    "risk.medium_action": "step_up_mfa",
    "risk.high_action": "block_login",
}


async def ensure_security_config_seed(db: AsyncSession) -> None:
    for key, value in DEFAULT_SECURITY_CONFIG.items():
        result = await db.execute(select(SecurityConfig).where(SecurityConfig.key == key))
        if result.scalar_one_or_none() is None:
            db.add(SecurityConfig(key=key, value={"value": value}))
    await db.flush()


async def get_security_config_value(
    db: AsyncSession,
    key: str,
    default: Any = None,
) -> Any:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    cache_key = f"security_config:{key}"
    cached = await redis.get(cache_key)
    if cached:
        payload = json.loads(cached)
        return payload.get("value", default)

    result = await db.execute(
        select(SecurityConfig).where(SecurityConfig.key == key, SecurityConfig.is_active.is_(True))
    )
    row = result.scalar_one_or_none()
    if not row:
        fallback = DEFAULT_SECURITY_CONFIG.get(key, default)
        await redis.setex(cache_key, CACHE_TTL_SECONDS, json.dumps({"value": fallback}))
        return fallback

    value = row.value.get("value", row.value)
    await redis.setex(cache_key, CACHE_TTL_SECONDS, json.dumps({"value": value}))
    return value


async def invalidate_security_config_cache(key: str | None = None) -> None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    if key:
        await redis.delete(f"security_config:{key}")
        return
    for config_key in DEFAULT_SECURITY_CONFIG:
        await redis.delete(f"security_config:{config_key}")


async def get_lockout_settings(db: AsyncSession) -> dict[str, int]:
    return {
        "captcha_after_attempt": int(
            await get_security_config_value(db, "lockout.captcha_after_attempt", 4)
        ),
        "backoff_base_seconds": int(
            await get_security_config_value(db, "lockout.backoff_base_seconds", 2)
        ),
        "backoff_start_attempt": int(
            await get_security_config_value(db, "lockout.backoff_start_attempt", 5)
        ),
        "max_attempts": int(await get_security_config_value(db, "lockout.max_attempts", 8)),
        "duration_minutes": int(
            await get_security_config_value(db, "lockout.duration_minutes", 15)
        ),
        "ip_block_threshold": int(
            await get_security_config_value(db, "lockout.ip_block_threshold", 20)
        ),
    }


async def get_risk_settings(db: AsyncSession) -> dict[str, Any]:
    return {
        "medium_score": int(await get_security_config_value(db, "risk.medium_score", 40)),
        "high_score": int(await get_security_config_value(db, "risk.high_score", 70)),
        "medium_action": str(
            await get_security_config_value(db, "risk.medium_action", "step_up_mfa")
        ),
        "high_action": str(await get_security_config_value(db, "risk.high_action", "block_login")),
    }


async def list_security_config(db: AsyncSession) -> list[dict[str, Any]]:
    result = await db.execute(
        select(SecurityConfig)
        .where(SecurityConfig.is_active.is_(True))
        .order_by(SecurityConfig.key.asc())
    )
    items: list[dict[str, Any]] = []
    for row in result.scalars():
        value = row.value.get("value", row.value) if isinstance(row.value, dict) else row.value
        items.append(
            {
                "key": row.key,
                "value": value,
                "scope": row.scope,
                "version": row.version,
                "updated_at": row.updated_at,
            }
        )
    return items


async def apply_security_config_update(
    db: AsyncSession,
    *,
    key: str,
    value: Any,
    changed_by: UUID,
    approved_by: UUID | None = None,
    reason: str | None = None,
) -> dict[str, Any]:
    if key not in DEFAULT_SECURITY_CONFIG:
        raise ValueError("Unknown security config key.")

    result = await db.execute(
        select(SecurityConfig).where(SecurityConfig.key == key, SecurityConfig.is_active.is_(True))
    )
    row = result.scalar_one_or_none()
    if not row:
        row = SecurityConfig(key=key, value={"value": value})
        db.add(row)
        await db.flush()

    old_value = row.value.get("value", row.value) if isinstance(row.value, dict) else row.value
    row.value = {"value": value}
    row.version += 1
    row.updated_by = changed_by

    db.add(
        SecurityConfigHistory(
            config_key=key,
            old_value={"value": old_value},
            new_value={"value": value},
            changed_by=changed_by,
            approved_by=approved_by,
            reason=reason,
        )
    )
    await db.flush()
    await invalidate_security_config_cache(key)
    return {"key": key, "value": value, "version": row.version}
