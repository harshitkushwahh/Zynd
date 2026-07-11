from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.auth_session_context import complete_authenticated_login
from app.application.auth.login_service import login_with_email
from app.application.messaging.scheduled_events import begin_event_batch
from app.application.messaging.post_commit import flush_scheduled_events
from app.application.messaging.streams import EVENT_AUTH_LOGIN_SUCCEEDED
from app.application.security.security_config_service import ensure_security_config_seed
from app.infrastructure.persistence.models import SecurityReviewItem, User, UserRole, UserStatus
from app.infrastructure.security.passwords import hash_password


@pytest.mark.asyncio
async def test_login_schedules_login_succeeded_event(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = fake_redis
    await ensure_security_config_seed(db_session)
    dispatched: list[str] = []

    async def capture_dispatch(event) -> None:
        dispatched.append(event.event_type)

    monkeypatch.setattr("app.workers.event_dispatcher.dispatch_event", capture_dispatch)

    async def allow_turnstile(*_args, **_kwargs) -> bool:
        return True

    monkeypatch.setattr("app.application.auth.login_service.verify_turnstile", allow_turnstile)

    password = "Password1!"
    user = User(
        email=f"event-login-{uuid4()}@example.com",
        password_hash=hash_password(password),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    begin_event_batch()
    await login_with_email(
        db_session,
        email=user.email,
        password=password,
        turnstile_token="token",
        device_fingerprint="device-fingerprint-12345678",
        user_agent="Mozilla/5.0",
        ip="127.0.0.1",
    )
    await flush_scheduled_events()
    assert EVENT_AUTH_LOGIN_SUCCEEDED in dispatched


@pytest.mark.asyncio
async def test_new_device_login_creates_review_via_sync_handler(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = fake_redis

    class _SessionContext:
        def __init__(self, session: AsyncSession) -> None:
            self._session = session

        async def __aenter__(self) -> AsyncSession:
            return self._session

        async def __aexit__(self, *_args: object) -> None:
            return None

    monkeypatch.setattr(
        "app.workers.handlers.security_login_handler.AsyncSessionLocal",
        lambda: _SessionContext(db_session),
    )
    monkeypatch.setattr(
        "app.workers.event_dispatcher.AsyncSessionLocal",
        lambda: _SessionContext(db_session),
    )

    password = "Password1!"
    user = User(
        email=f"new-device-{uuid4()}@example.com",
        password_hash=hash_password(password),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    begin_event_batch()
    await complete_authenticated_login(
        db_session,
        user=user,
        device_fingerprint="brand-new-device-fingerprint-99",
        user_agent="Mozilla/5.0 (Macintosh)",
        ip="127.0.0.1",
    )
    await flush_scheduled_events()

    result = await db_session.execute(
        select(SecurityReviewItem).where(SecurityReviewItem.user_id == user.id)
    )
    assert result.scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_send_security_email_schedules_event(monkeypatch: pytest.MonkeyPatch) -> None:
    scheduled: list[str] = []

    def fake_schedule(_stream: str, event) -> None:
        scheduled.append(event.event_type)

    monkeypatch.setattr(
        "app.infrastructure.notifications.email_service.schedule_domain_event",
        fake_schedule,
    )

    from app.infrastructure.notifications.email_service import send_security_email

    await send_security_email(
        to_email="user@example.com",
        subject="Test",
        body="Hello",
    )
    assert scheduled == ["security.email.requested"]
