from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

from app.core.redis import get_redis
from app.infrastructure.persistence.notification_models import UserNotification

logger = logging.getLogger(__name__)

CHANNEL_PREFIX = "notifications:user"


def notification_channel(user_id: UUID) -> str:
    return f"{CHANNEL_PREFIX}:{user_id}"


def _serialize_notification(
    notification: UserNotification,
    *,
    unread_count: int,
) -> dict[str, Any]:
    return {
        "id": str(notification.id),
        "category": notification.category.value,
        "notification_type": notification.notification_type,
        "title": notification.title,
        "body": notification.body,
        "metadata": notification.metadata_json,
        "read_at": notification.read_at.isoformat() if notification.read_at else None,
        "created_at": notification.created_at.isoformat(),
        "unread_count": unread_count,
    }


async def publish_notification_created(
    *,
    user_id: UUID,
    notification: UserNotification,
    unread_count: int,
) -> None:
    payload = _serialize_notification(notification, unread_count=unread_count)
    try:
        client = await get_redis()
        await client.publish(notification_channel(user_id), json.dumps(payload))
    except Exception:
        logger.exception("Failed to publish realtime notification user_id=%s", user_id)


async def publish_unread_count_updated(*, user_id: UUID, unread_count: int) -> None:
    payload = {"unread_count": unread_count}
    try:
        client = await get_redis()
        await client.publish(
            notification_channel(user_id),
            json.dumps({"event": "unread.updated", **payload}),
        )
    except Exception:
        logger.exception("Failed to publish unread count update user_id=%s", user_id)


__all__ = [
    "notification_channel",
    "publish_notification_created",
    "publish_unread_count_updated",
]
