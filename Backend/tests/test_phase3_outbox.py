from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.messaging.scheduled_events import (
    begin_event_batch,
    schedule_domain_event,
    take_scheduled_events,
)
from app.application.messaging.post_commit import persist_scheduled_events
from app.application.messaging.outbox_service import relay_pending_outbox
from app.application.messaging.streams import EVENT_SECURITY_EMAIL_REQUESTED, STREAM_NOTIFICATIONS_EMAIL
from app.core.config import get_settings
from app.domain.shared.events import DomainEvent
from app.infrastructure.persistence.models import OutboxEvent, OutboxEventStatus, ProcessedDomainEvent
from app.workers.event_dispatcher import dispatch_event


@pytest.mark.asyncio
async def test_scheduled_events_persist_to_outbox_in_same_transaction(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("EVENT_DISPATCH_MODE", "outbox")
    get_settings.cache_clear()

    event = DomainEvent(
        event_type=EVENT_SECURITY_EMAIL_REQUESTED,
        aggregate_id="user@example.com",
        aggregate_type="user_email",
        payload={"to_email": "user@example.com", "subject": "Test", "body": "Hello"},
    )
    begin_event_batch()
    schedule_domain_event(STREAM_NOTIFICATIONS_EMAIL, event)
    await persist_scheduled_events(db_session)
    await db_session.commit()
    take_scheduled_events()

    result = await db_session.execute(
        select(OutboxEvent).where(OutboxEvent.event_id == event.event_id)
    )
    row = result.scalar_one_or_none()
    assert row is not None
    assert row.status == OutboxEventStatus.pending
    assert row.stream == STREAM_NOTIFICATIONS_EMAIL


@pytest.mark.asyncio
async def test_outbox_relay_marks_events_published(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("EVENT_DISPATCH_MODE", "outbox")
    get_settings.cache_clear()

    published: list[str] = []

    async def fake_publish(stream: str, event: DomainEvent, *, settings=None) -> str:
        published.append(event.event_id)
        return "1-0"

    monkeypatch.setattr(
        "app.application.messaging.outbox_service.publish_domain_event",
        fake_publish,
    )

    event = DomainEvent(
        event_type=EVENT_SECURITY_EMAIL_REQUESTED,
        aggregate_id="relay@example.com",
        aggregate_type="user_email",
        payload={"to_email": "relay@example.com", "subject": "Relay", "body": "Body"},
    )
    db_session.add(
        OutboxEvent(
            event_id=event.event_id,
            stream=STREAM_NOTIFICATIONS_EMAIL,
            event_type=event.event_type,
            payload=event.model_dump(mode="json"),
            status=OutboxEventStatus.pending,
        )
    )
    await db_session.commit()

    stats = await relay_pending_outbox(db_session)
    await db_session.commit()
    assert stats["published"] >= 1

    result = await db_session.execute(
        select(OutboxEvent).where(OutboxEvent.event_id == event.event_id)
    )
    row = result.scalar_one()
    assert row.status == OutboxEventStatus.published
    assert row.published_at is not None
    assert event.event_id in published


@pytest.mark.asyncio
async def test_dispatch_event_is_idempotent(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = 0

    async def fake_handler(_event: DomainEvent) -> None:
        nonlocal calls
        calls += 1

    monkeypatch.setattr(
        "app.workers.event_dispatcher._HANDLERS",
        {EVENT_SECURITY_EMAIL_REQUESTED: fake_handler},
    )

    event = DomainEvent(
        event_type=EVENT_SECURITY_EMAIL_REQUESTED,
        aggregate_id=f"idempotent-{uuid4()}@example.com",
        aggregate_type="user_email",
        payload={"to_email": "user@example.com", "subject": "Test", "body": "Hello"},
    )

    class _SessionContext:
        def __init__(self, session: AsyncSession) -> None:
            self._session = session

        async def __aenter__(self) -> AsyncSession:
            return self._session

        async def __aexit__(self, *_args: object) -> None:
            return None

    monkeypatch.setattr(
        "app.workers.event_dispatcher.AsyncSessionLocal",
        lambda: _SessionContext(db_session),
    )

    await dispatch_event(event)
    await dispatch_event(event)

    assert calls == 1
    result = await db_session.execute(
        select(ProcessedDomainEvent).where(ProcessedDomainEvent.event_id == event.event_id)
    )
    assert result.scalar_one_or_none() is not None
