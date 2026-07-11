from __future__ import annotations

import json
import logging
from typing import Any

import redis.asyncio as redis

from app.core.config import Settings, get_settings
from app.core.redis import get_redis
from app.domain.shared.events import DomainEvent
from app.infrastructure.messaging.event_bus import EventBus

logger = logging.getLogger(__name__)


class RedisEventBus(EventBus):
    """Redis Streams adapter with consumer-group support."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._client: redis.Redis | None = None

    async def _get_client(self) -> redis.Redis:
        if self._client is None:
            self._client = await get_redis(self._settings.redis_event_stream_db)
        return self._client

    def _stream_name(self, stream: str) -> str:
        return f"{self._settings.event_stream_prefix}.{stream}"

    async def publish(self, stream: str, event: DomainEvent) -> str:
        client = await self._get_client()
        message_id = await client.xadd(
            self._stream_name(stream),
            {"data": event.model_dump_json()},
        )
        return message_id

    async def ensure_consumer_group(self, stream: str, *, group: str) -> None:
        client = await self._get_client()
        name = self._stream_name(stream)
        try:
            await client.xgroup_create(name, group, id="0", mkstream=True)
        except redis.ResponseError as exc:
            if "BUSYGROUP" not in str(exc):
                raise

    async def read_group(
        self,
        *,
        group: str,
        consumer: str,
        streams: list[str],
        count: int = 10,
        block_ms: int = 5000,
    ) -> list[tuple[str, str, DomainEvent]]:
        client = await self._get_client()
        stream_names = [self._stream_name(stream) for stream in streams]
        response = await client.xreadgroup(
            groupname=group,
            consumername=consumer,
            streams={name: ">" for name in stream_names},
            count=count,
            block=block_ms,
        )
        messages: list[tuple[str, str, DomainEvent]] = []
        if not response:
            return messages

        for stream_name, entries in response:
            logical_stream = stream_name.removeprefix(f"{self._settings.event_stream_prefix}.")
            for message_id, fields in entries:
                raw = fields.get("data")
                if not raw:
                    continue
                event = DomainEvent.model_validate_json(raw)
                messages.append((logical_stream, message_id, event))
        return messages

    async def ack(self, stream: str, *, group: str, message_id: str) -> None:
        client = await self._get_client()
        await client.xack(self._stream_name(stream), group, message_id)

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None
