from __future__ import annotations

import json
from uuid import UUID

from app.core.config import Settings, get_settings
from app.core.redis import get_redis


def _queue_payload(
    *,
    notification_id: UUID,
    user_id: UUID,
    device_id: UUID,
    fcm_token: str,
    unread_count: int,
    attempt: int = 1,
) -> str:
    return json.dumps(
        {
            "notification_id": str(notification_id),
            "user_id": str(user_id),
            "device_id": str(device_id),
            "fcm_token": fcm_token,
            "unread_count": unread_count,
            "attempt": attempt,
        }
    )


async def enqueue_push_dispatch(
    *,
    notification_id: UUID,
    user_id: UUID,
    device_id: UUID,
    fcm_token: str,
    unread_count: int,
    attempt: int = 1,
    settings: Settings | None = None,
) -> None:
    settings = settings or get_settings()
    client = await get_redis(settings.redis_document_worker_db, settings)
    await client.lpush(
        settings.notifications_push_queue_key,
        _queue_payload(
            notification_id=notification_id,
            user_id=user_id,
            device_id=device_id,
            fcm_token=fcm_token,
            unread_count=unread_count,
            attempt=attempt,
        ),
    )


async def requeue_push_dispatch(
    *,
    notification_id: UUID,
    user_id: UUID,
    device_id: UUID,
    fcm_token: str,
    unread_count: int,
    attempt: int,
    settings: Settings | None = None,
) -> None:
    await enqueue_push_dispatch(
        notification_id=notification_id,
        user_id=user_id,
        device_id=device_id,
        fcm_token=fcm_token,
        unread_count=unread_count,
        attempt=attempt,
        settings=settings,
    )


async def move_push_dispatch_to_dead_letter(
    payload: str,
    *,
    reason: str,
    settings: Settings | None = None,
) -> None:
    settings = settings or get_settings()
    client = await get_redis(settings.redis_document_worker_db, settings)
    dead_letter = json.dumps({"payload": payload, "reason": reason})
    await client.lpush(settings.notifications_push_dead_letter_key, dead_letter)


async def pop_push_dispatch_job(
    *,
    block_seconds: int,
    settings: Settings | None = None,
) -> tuple[str, dict] | None:
    settings = settings or get_settings()
    client = await get_redis(settings.redis_document_worker_db, settings)
    result = await client.brpop(settings.notifications_push_queue_key, timeout=block_seconds)
    if not result:
        return None
    _, raw_payload = result
    data = json.loads(raw_payload)
    return raw_payload, data
