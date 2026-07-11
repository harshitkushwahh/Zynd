from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.application.notifications.push_dispatch_service import dispatch_push_notification
from app.infrastructure.persistence.notification_models import NotificationCategory, UserNotification


@pytest.mark.asyncio
async def test_dispatch_push_skipped_when_fcm_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []

    class DisabledPushService:
        def is_enabled(self) -> bool:
            return False

        async def send_to_token(self, **_kwargs: object) -> tuple[bool, str | None]:
            calls.append("send")
            return True, None

    monkeypatch.setattr(
        "app.application.notifications.push_dispatch_service.get_firebase_push_service",
        lambda: DisabledPushService(),
    )

    notification = UserNotification(
        id=uuid4(),
        user_id=uuid4(),
        category=NotificationCategory.security,
        notification_type="auth.login.success",
        title="Sign-in",
        body="New sign-in",
        metadata_json=None,
        idempotency_key=None,
        read_at=None,
        created_at=datetime.now(UTC),
    )

    await dispatch_push_notification(
        user_id=notification.user_id,
        notification=notification,
        unread_count=1,
    )
    assert calls == []


@pytest.mark.asyncio
async def test_dispatch_push_revokes_invalid_tokens(
    db_session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.application.notifications.push_device_service import register_push_device
    from app.infrastructure.persistence.models import User, UserRole, UserStatus
    from app.infrastructure.persistence.notification_models import PushPlatform
    from app.infrastructure.security.passwords import hash_password
    from app.application.notifications.push_device_service import list_active_push_devices

    user = User(
        email=f"fcm-dispatch-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    await register_push_device(
        db_session,
        user_id=user.id,
        platform=PushPlatform.android,
        fcm_token="invalid-token",
    )
    await db_session.commit()

    class FakePushService:
        def is_enabled(self) -> bool:
            return True

        async def send_to_token(self, *, token: str, **_kwargs: object) -> tuple[bool, str | None]:
            return False, token

    monkeypatch.setattr(
        "app.application.notifications.push_dispatch_service.get_firebase_push_service",
        lambda: FakePushService(),
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
        notification_type="auth.login.success",
        title="Sign-in",
        body="New sign-in",
        metadata_json=None,
        idempotency_key=None,
        read_at=None,
        created_at=datetime.now(UTC),
    )

    await dispatch_push_notification(
        user_id=user.id,
        notification=notification,
        unread_count=1,
    )

    active = await list_active_push_devices(db_session, user.id)
    assert active == []
