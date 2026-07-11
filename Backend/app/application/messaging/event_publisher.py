"""Application port for publishing domain events."""

from __future__ import annotations

from app.core.config import Settings, get_settings
from app.domain.shared.events import DomainEvent
from app.infrastructure.messaging.redis_event_bus import RedisEventBus


async def publish_domain_event(
    stream: str,
    event: DomainEvent,
    *,
    settings: Settings | None = None,
) -> str:
    settings = settings or get_settings()
    bus = RedisEventBus(settings)
    try:
        return await bus.publish(stream, event)
    finally:
        await bus.close()
