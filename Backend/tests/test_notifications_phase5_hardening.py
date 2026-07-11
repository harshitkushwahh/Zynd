from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from app.application.compliance.retention_service import ensure_retention_seed
from app.application.notifications.notification_retention_service import purge_expired_notifications
from app.application.notifications.notification_service import (
    count_unread,
    insert_in_app_notification,
    mark_notification_read,
)
from app.application.notifications.push_dispatch_service import dispatch_push_notification
from app.application.notifications.unread_count_cache import (
    resolve_unread_count,
    set_cached_unread_count,
)
from app.application.notifications.notification_delivery_audit import record_notification_delivery
from app.infrastructure.persistence.models import AuditEventType, AuditLog, User, UserRole, UserStatus
from app.infrastructure.persistence.notification_models import NotificationCategory, UserNotification
from app.infrastructure.queue.push_dispatch_queue import pop_push_dispatch_job
from app.infrastructure.security.passwords import hash_password


@pytest.mark.asyncio
async def test_unread_count_cache_hit(db_session, fake_redis) -> None:
    user = User(
        email=f"unread-cache-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    await set_cached_unread_count(user.id, 7)
    count = await resolve_unread_count(db_session, user.id)
    assert count == 7


@pytest.mark.asyncio
async def test_insert_in_app_notification_invalidates_stale_unread_cache(
    db_session, fake_redis
) -> None:
    user = User(
        email=f"unread-insert-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    await set_cached_unread_count(user.id, 0)
    row = await insert_in_app_notification(
        db_session,
        user_id=user.id,
        category=NotificationCategory.security,
        notification_type="auth.login.succeeded",
        title="Sign-in",
        body="New sign-in",
    )
    await db_session.flush()
    assert row is not None

    count = await count_unread(db_session, user.id)
    assert count == 1


@pytest.mark.asyncio
async def test_mark_read_decrements_unread_cache(db_session, fake_redis) -> None:
    user = User(
        email=f"unread-decr-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    row = await insert_in_app_notification(
        db_session,
        user_id=user.id,
        category=NotificationCategory.security,
        notification_type="auth.login.succeeded",
        title="Sign-in",
        body="New sign-in",
    )
    await db_session.flush()
    assert row is not None

    await set_cached_unread_count(user.id, 1)
    await mark_notification_read(db_session, user_id=user.id, notification_id=row.id)
    count = await count_unread(db_session, user.id)
    assert count == 0


@pytest.mark.asyncio
async def test_dispatch_push_enqueues_transient_failures(
    db_session,
    fake_redis,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.application.notifications.push_device_service import register_push_device
    from app.infrastructure.persistence.notification_models import PushPlatform

    user = User(
        email=f"push-retry-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    await register_push_device(
        db_session,
        user_id=user.id,
        platform=PushPlatform.web,
        fcm_token="retry-token",
    )
    await db_session.commit()

    class FlakyPushService:
        def is_enabled(self) -> bool:
            return True

        async def send_to_token(self, **_kwargs: object) -> tuple[bool, str | None]:
            return False, None

    monkeypatch.setattr(
        "app.application.notifications.push_dispatch_service.get_firebase_push_service",
        lambda: FlakyPushService(),
    )

    class _SessionContext:
        def __init__(self, session) -> None:
            self._session = session

        async def __aenter__(self):
            return self._session

        async def __aexit__(self, *_args: object) -> None:
            return None

    monkeypatch.setattr(
        "app.application.notifications.push_dispatch_service.AsyncSessionLocal",
        lambda: _SessionContext(db_session),
    )

    notification = UserNotification(
        id=uuid4(),
        user_id=user.id,
        category=NotificationCategory.security,
        notification_type="auth.login.succeeded",
        title="Sign-in",
        body="New sign-in",
        metadata_json=None,
        idempotency_key=None,
        read_at=None,
        created_at=datetime.now(UTC),
    )

    stats = await dispatch_push_notification(
        user_id=user.id,
        notification=notification,
        unread_count=1,
    )
    assert stats["queued"] == 1

    job = await pop_push_dispatch_job(block_seconds=0)
    assert job is not None
    _, payload = job
    assert payload["fcm_token"] == "retry-token"
    assert payload["notification_id"] == str(notification.id)


@pytest.mark.asyncio
async def test_record_notification_delivery_writes_audit(db_session) -> None:
    user = User(
        email=f"delivery-audit-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    notification_id = uuid4()
    await record_notification_delivery(
        db_session,
        user_id=user.id,
        notification_id=notification_id,
        notification_type="auth.login.succeeded",
        channels={"in_app": True, "push_sent": 1},
        latency_ms=12,
    )
    await db_session.commit()

    from sqlalchemy import select

    result = await db_session.execute(
        select(AuditLog).where(
            AuditLog.user_id == user.id,
            AuditLog.event_type == AuditEventType.notification_dispatched,
        )
    )
    audit = result.scalar_one()
    assert audit.metadata_["notification_id"] == str(notification_id)
    assert audit.metadata_["channels"]["push_sent"] == 1


@pytest.mark.asyncio
async def test_purge_expired_notifications_removes_old_read_rows(db_session) -> None:
    await ensure_retention_seed(db_session)

    user = User(
        email=f"retention-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    old_read = UserNotification(
        user_id=user.id,
        category=NotificationCategory.account,
        notification_type="account.settings.changed",
        title="Old",
        body="Old notification",
        read_at=datetime.now(UTC) - timedelta(days=400),
        created_at=datetime.now(UTC) - timedelta(days=400),
    )
    recent_unread = UserNotification(
        user_id=user.id,
        category=NotificationCategory.account,
        notification_type="account.settings.changed",
        title="Recent",
        body="Recent notification",
        read_at=None,
        created_at=datetime.now(UTC) - timedelta(days=400),
    )
    db_session.add_all([old_read, recent_unread])
    await db_session.flush()

    result = await purge_expired_notifications(db_session)
    assert result["purged_count"] == 1

    from sqlalchemy import select

    remaining = await db_session.execute(
        select(UserNotification).where(UserNotification.user_id == user.id)
    )
    rows = list(remaining.scalars())
    assert len(rows) == 1
    assert rows[0].title == "Recent"


@pytest.mark.asyncio
async def test_publish_unread_count_updated_event(monkeypatch: pytest.MonkeyPatch) -> None:
    published: list[str] = []

    class FakeRedis:
        async def publish(self, _channel: str, message: str) -> int:
            published.append(message)
            return 1

    async def fake_get_redis(_db: int | None = None):
        return FakeRedis()

    monkeypatch.setattr(
        "app.infrastructure.notifications.notification_realtime_publisher.get_redis",
        fake_get_redis,
    )

    from app.infrastructure.notifications.notification_realtime_publisher import (
        publish_unread_count_updated,
    )

    user_id = uuid4()
    await publish_unread_count_updated(user_id=user_id, unread_count=3)
    payload = json.loads(published[0])
    assert payload["event"] == "unread.updated"
    assert payload["unread_count"] == 3
