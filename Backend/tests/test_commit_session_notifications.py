from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.messaging.scheduled_events import begin_event_batch
from app.application.messaging.streams import EVENT_NOTIFICATION_CREATED
from app.application.notifications.notification_service import schedule_user_notification
from app.application.notifications.types import NotificationType
from app.core.config import get_settings
from app.core.database import commit_session_with_events
from app.infrastructure.persistence.models import User, UserRole, UserStatus
from app.infrastructure.persistence.notification_models import (
    NotificationCategory,
    UserNotification,
    UserNotificationPreference,
)
from app.infrastructure.security.passwords import hash_password


@pytest.mark.asyncio
async def test_commit_session_with_events_dispatches_sync_notifications(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("EVENT_DISPATCH_MODE", "sync")
    get_settings.cache_clear()

    class _SessionContext:
        def __init__(self, session: AsyncSession) -> None:
            self._session = session

        async def __aenter__(self) -> AsyncSession:
            return self._session

        async def __aexit__(self, *_args: object) -> None:
            return None

    monkeypatch.setattr(
        "app.workers.handlers.notification_handler.AsyncSessionLocal",
        lambda: _SessionContext(db_session),
    )
    monkeypatch.setattr(
        "app.workers.event_dispatcher.AsyncSessionLocal",
        lambda: _SessionContext(db_session),
    )

    async def noop_email(**_kwargs: object) -> bool:
        return True

    monkeypatch.setattr(
        "app.workers.handlers.notification_handler.deliver_security_email",
        noop_email,
    )
    async def noop_publish(**_kwargs: object) -> None:
        return None

    monkeypatch.setattr(
        "app.workers.handlers.notification_handler.publish_notification_created",
        noop_publish,
    )
    async def noop_push(**_kwargs: object) -> dict[str, int]:
        return {"sent": 0, "queued": 0, "invalid": 0, "failed": 0}

    monkeypatch.setattr(
        "app.workers.handlers.notification_handler.dispatch_push_notification",
        noop_push,
    )

    dispatched: list[str] = []

    async def capture_dispatch(event) -> None:
        dispatched.append(event.event_type)
        from app.workers.event_dispatcher import _HANDLERS

        handler = _HANDLERS.get(event.event_type)
        if handler:
            await handler(event)

    monkeypatch.setattr("app.workers.event_dispatcher.dispatch_event", capture_dispatch)

    user = User(
        email=f"sync-commit-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    db_session.add(
        UserNotificationPreference(
            user_id=user.id,
            category=NotificationCategory.kyc,
            email_enabled=True,
            in_app_enabled=True,
        )
    )
    await db_session.flush()

    begin_event_batch()
    schedule_user_notification(
        user_id=user.id,
        user_email=user.email,
        notification_type=NotificationType.KYC_INITIATED,
        title="KYC verification started",
        body="You started identity verification on ZYND.",
        idempotency_key=f"kyc.initiated:{user.id}",
    )

    await commit_session_with_events(db_session)

    assert EVENT_NOTIFICATION_CREATED in dispatched

    result = await db_session.execute(
        select(UserNotification).where(UserNotification.user_id == user.id)
    )
    notifications = list(result.scalars())
    assert len(notifications) == 1
    assert notifications[0].notification_type == NotificationType.KYC_INITIATED.value
