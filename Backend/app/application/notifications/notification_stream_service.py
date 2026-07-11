from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Any
from uuid import UUID

from app.infrastructure.notifications.notification_realtime_publisher import notification_channel

HEARTBEAT_INTERVAL_SEC = 30


def format_sse_event(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def iter_user_notification_stream(user_id: UUID) -> AsyncIterator[str]:
    from app.core.redis import get_redis

    client = await get_redis()
    pubsub = client.pubsub()
    channel = notification_channel(user_id)
    await pubsub.subscribe(channel)

    last_heartbeat = asyncio.get_running_loop().time()

    try:
        yield format_sse_event("connected", {"ok": True})

        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            now = asyncio.get_running_loop().time()

            if message is not None and message.get("type") == "message":
                raw_data = message.get("data")
                if raw_data is None:
                    continue
                if isinstance(raw_data, bytes):
                    raw_data = raw_data.decode()
                payload = json.loads(raw_data)
                event_name = payload.pop("event", "notification.created")
                if event_name == "unread.updated":
                    yield format_sse_event("unread.updated", payload)
                else:
                    yield format_sse_event("notification.created", payload)
                last_heartbeat = now
                continue

            if now - last_heartbeat >= HEARTBEAT_INTERVAL_SEC:
                yield format_sse_event("heartbeat", {})
                last_heartbeat = now
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
