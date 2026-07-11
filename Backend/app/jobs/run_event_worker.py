from __future__ import annotations

import asyncio
import logging
import socket

from app.application.messaging.streams import (
    DEFAULT_CONSUMER_GROUP,
    STREAM_AUTH,
    STREAM_NOTIFICATIONS_DISPATCH,
    STREAM_NOTIFICATIONS_EMAIL,
    STREAM_SECURITY,
)
from app.infrastructure.messaging.redis_event_bus import RedisEventBus
from app.workers.event_dispatcher import dispatch_event

logger = logging.getLogger(__name__)

_WORKER_STREAMS = [
    STREAM_NOTIFICATIONS_EMAIL,
    STREAM_NOTIFICATIONS_DISPATCH,
    STREAM_AUTH,
    STREAM_SECURITY,
]


async def run_event_worker(
    *,
    group: str = DEFAULT_CONSUMER_GROUP,
    consumer_name: str | None = None,
    block_ms: int = 5000,
) -> None:
    consumer = consumer_name or f"worker-{socket.gethostname()}"
    bus = RedisEventBus()
    try:
        for stream in _WORKER_STREAMS:
            await bus.ensure_consumer_group(stream, group=group)

        logger.info("Event worker started group=%s consumer=%s streams=%s", group, consumer, _WORKER_STREAMS)
        while True:
            messages = await bus.read_group(
                group=group,
                consumer=consumer,
                streams=_WORKER_STREAMS,
                block_ms=block_ms,
            )
            for stream, message_id, event in messages:
                try:
                    await dispatch_event(event)
                    await bus.ack(stream, group=group, message_id=message_id)
                except Exception:
                    logger.exception(
                        "Handler failed stream=%s message_id=%s event_type=%s",
                        stream,
                        message_id,
                        event.event_type,
                    )
    finally:
        await bus.close()


async def main() -> int:
    await run_event_worker()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
