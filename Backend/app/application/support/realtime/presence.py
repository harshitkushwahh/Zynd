from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from app.core.config import get_settings
from app.core.redis import get_redis

PRESENCE_KEY_PREFIX = "support:presence:agent:"
PRESENCE_TTL_SECONDS = 45
RECENT_AGENT_MESSAGE_MINUTES = 2


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _presence_key(agent_id: UUID) -> str:
    return f"{PRESENCE_KEY_PREFIX}{agent_id}"


async def set_agent_presence(agent_id: UUID, *, status: str = "online") -> None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    await redis.setex(_presence_key(agent_id), PRESENCE_TTL_SECONDS, status)


async def clear_agent_presence(agent_id: UUID) -> None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    await redis.delete(_presence_key(agent_id))


async def read_agent_presence(agent_id: UUID) -> str | None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    value = await redis.get(_presence_key(agent_id))
    return str(value) if value else None


def _recent_agent_message(messages: list[dict[str, Any]], *, now: datetime | None = None) -> bool:
    moment = now or datetime.now(timezone.utc)
    cutoff = moment - timedelta(minutes=RECENT_AGENT_MESSAGE_MINUTES)
    for message in reversed(messages):
        if message.get("role") != "agent":
            continue
        created_raw = message.get("created_at")
        if not created_raw:
            continue
        if isinstance(created_raw, datetime):
            created = _aware(created_raw)
        else:
            try:
                created = _aware(datetime.fromisoformat(str(created_raw).replace("Z", "+00:00")))
            except ValueError:
                continue
        return created >= cutoff
    return False


async def resolve_agent_presence_for_customer(
    *,
    assignee_id: UUID | None,
    messages: list[dict[str, Any]],
) -> str | None:
    if assignee_id is None:
        if _recent_agent_message(messages):
            return "online"
        return "away"
    redis_status = await read_agent_presence(assignee_id)
    if redis_status == "online":
        return "online"
    if _recent_agent_message(messages):
        return "online"
    return "away"
