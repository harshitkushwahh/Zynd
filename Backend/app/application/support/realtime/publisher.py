from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from app.application.support.realtime.connection_manager import support_connection_manager
from app.application.support.realtime.queue import enqueue_support_realtime_event, take_support_realtime_events
from app.core.config import get_settings
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

SUPPORT_REDIS_CHANNEL = "support:realtime"


async def _redis_publish(event: dict[str, Any]) -> None:
    settings = get_settings()
    if not settings.support_realtime_enabled:
        await support_connection_manager.broadcast_json(event)
        return
    try:
        redis = await get_redis(settings.redis_event_stream_db)
        await redis.publish(SUPPORT_REDIS_CHANNEL, json.dumps(event))
    except Exception:
        logger.exception("support_realtime_redis_publish_failed")
        await support_connection_manager.broadcast_json(event)


async def publish_support_realtime_event(event: dict[str, Any]) -> None:
    settings = get_settings()
    if not settings.support_realtime_enabled:
        return
    await _redis_publish(event)


def schedule_support_realtime_event(event: dict[str, Any]) -> None:
    settings = get_settings()
    if not settings.support_realtime_enabled:
        return
    enqueue_support_realtime_event(event)


async def flush_support_realtime_events() -> None:
    for event in take_support_realtime_events():
        await publish_support_realtime_event(event)


async def run_support_realtime_subscriber() -> None:
    settings = get_settings()
    if not settings.support_realtime_enabled:
        return
    redis = await get_redis(settings.redis_event_stream_db)
    pubsub = redis.pubsub()
    await pubsub.subscribe(SUPPORT_REDIS_CHANNEL)
    logger.info("support_realtime_subscriber_started channel=%s", SUPPORT_REDIS_CHANNEL)
    try:
        async for message in pubsub.listen():
            if message.get("type") != "message":
                continue
            raw = message.get("data")
            if not raw:
                continue
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                continue
            await support_connection_manager.broadcast_json(payload)
    except asyncio.CancelledError:
        raise
    finally:
        await pubsub.unsubscribe(SUPPORT_REDIS_CHANNEL)
        await pubsub.aclose()
