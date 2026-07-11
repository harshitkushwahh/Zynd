from __future__ import annotations

import json
from uuid import uuid4

import pytest

from app.application.notifications.notification_stream_service import format_sse_event
from app.infrastructure.notifications.notification_realtime_publisher import notification_channel


def test_notification_channel_name() -> None:
    user_id = uuid4()
    assert notification_channel(user_id) == f"notifications:user:{user_id}"


def test_format_sse_event() -> None:
    rendered = format_sse_event("notification.created", {"id": "abc", "title": "Hello"})
    assert rendered.startswith("event: notification.created\n")
    assert 'data: {"id": "abc", "title": "Hello"}' in rendered
    assert rendered.endswith("\n\n")


@pytest.mark.asyncio
async def test_publish_notification_created_uses_redis_publish(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    published: list[tuple[str, str]] = []

    class FakeRedis:
        async def publish(self, channel: str, message: str) -> int:
            published.append((channel, message))
            return 1

    async def fake_get_redis(_db: int | None = None):
        return FakeRedis()

    monkeypatch.setattr(
        "app.infrastructure.notifications.notification_realtime_publisher.get_redis",
        fake_get_redis,
    )

    from datetime import UTC, datetime

    from app.infrastructure.notifications.notification_realtime_publisher import (
        publish_notification_created,
    )
    from app.infrastructure.persistence.notification_models import NotificationCategory, UserNotification

    user_id = uuid4()
    notification = UserNotification(
        id=uuid4(),
        user_id=user_id,
        category=NotificationCategory.security,
        notification_type="auth.login.success",
        title="New sign-in",
        body="You signed in.",
        metadata_json=None,
        idempotency_key=None,
        read_at=None,
        created_at=datetime.now(UTC),
    )

    await publish_notification_created(
        user_id=user_id,
        notification=notification,
        unread_count=2,
    )

    assert len(published) == 1
    channel, raw = published[0]
    assert channel == notification_channel(user_id)
    payload = json.loads(raw)
    assert payload["id"] == str(notification.id)
    assert payload["unread_count"] == 2
    assert payload["title"] == "New sign-in"
