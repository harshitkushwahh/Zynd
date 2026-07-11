from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.messaging.streams import EVENT_AUTH_LOGIN_FAILED
from app.domain.auth.events import LoginFailedPayload, login_failed_event
from app.infrastructure.persistence.models import User, UserNotification, UserRole, UserStatus
from app.infrastructure.security.passwords import hash_password
from app.workers.handlers.security_login_handler import handle_login_failed


@pytest.mark.asyncio
async def test_login_failed_handler_creates_in_app_notification(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
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

    async def noop_email(**_kwargs: object) -> None:
        return None

    monkeypatch.setattr(
        "app.workers.handlers.notification_handler.deliver_security_email",
        noop_email,
    )

    user = User(
        email=f"login-failed-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    event = login_failed_event(
        LoginFailedPayload(
            email=user.email,
            user_id=user.id,
            ip="203.0.113.10",
            reason="invalid_credentials",
        )
    )
    assert event.event_type == EVENT_AUTH_LOGIN_FAILED

    async def capture_enqueue(**kwargs: object) -> None:
        from app.application.notifications.types import NotificationType
        from app.domain.notifications.events import NotificationCreatedPayload, notification_created_event
        from app.workers.event_dispatcher import dispatch_event

        notification_type = kwargs.get("notification_type")
        notif_event = notification_created_event(
            NotificationCreatedPayload(
                user_id=user.id,
                user_email=user.email,
                category="security",
                notification_type=str(notification_type),
                title=str(kwargs.get("title")),
                body=str(kwargs.get("body")),
                metadata=kwargs.get("metadata"),  # type: ignore[arg-type]
                idempotency_key=str(kwargs.get("idempotency_key")),
                email_subject=str(kwargs.get("email_subject")),
            )
        )
        assert notification_type == NotificationType.AUTH_LOGIN_FAILED
        await dispatch_event(notif_event)

    monkeypatch.setattr(
        "app.workers.handlers.security_login_handler.enqueue_user_notification",
        capture_enqueue,
    )
    monkeypatch.setattr(
        "app.workers.event_dispatcher.AsyncSessionLocal",
        lambda: _SessionContext(db_session),
    )

    await handle_login_failed(event)
    await db_session.commit()

    result = await db_session.execute(
        select(UserNotification).where(UserNotification.user_id == user.id)
    )
    notifications = list(result.scalars())
    assert len(notifications) == 1
    assert notifications[0].notification_type == "auth.login.failed"
