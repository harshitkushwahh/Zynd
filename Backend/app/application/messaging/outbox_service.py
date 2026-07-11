from __future__ import annotations

import logging
from typing import Literal

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.messaging.event_publisher import publish_domain_event
from app.application.messaging.scheduled_events import peek_scheduled_events
from app.application.shared.datetime_utils import utcnow
from app.core.config import Settings, get_settings
from app.domain.shared.events import DomainEvent
from app.infrastructure.persistence.models import OutboxEvent, OutboxEventStatus, ProcessedDomainEvent

logger = logging.getLogger(__name__)


def resolve_event_dispatch_mode(settings: Settings | None = None) -> Literal["sync", "outbox"]:
    settings = settings or get_settings()
    mode = settings.event_dispatch_mode
    if mode == "redis":
        return "outbox"
    if mode in ("sync", "outbox"):
        return mode
    return "outbox"


async def persist_scheduled_events(session: AsyncSession) -> int:
    if resolve_event_dispatch_mode() == "sync":
        return 0

    batch = peek_scheduled_events()
    if not batch:
        return 0

    for stream, event in batch:
        session.add(
            OutboxEvent(
                event_id=event.event_id,
                stream=stream,
                event_type=event.event_type,
                payload=event.model_dump(mode="json"),
                status=OutboxEventStatus.pending,
            )
        )
    await session.flush()
    return len(batch)


async def relay_pending_outbox(
    session: AsyncSession,
    *,
    limit: int | None = None,
) -> dict[str, int]:
    settings = get_settings()
    batch_size = limit or settings.outbox_relay_batch_size
    result = await session.execute(
        select(OutboxEvent)
        .where(OutboxEvent.status == OutboxEventStatus.pending)
        .order_by(OutboxEvent.created_at.asc())
        .limit(batch_size)
        .with_for_update(skip_locked=True)
    )
    rows = list(result.scalars())
    published = 0
    failed = 0

    for row in rows:
        event = DomainEvent.model_validate(row.payload)
        row.attempts += 1
        try:
            await publish_domain_event(row.stream, event, settings=settings)
            row.status = OutboxEventStatus.published
            row.published_at = utcnow()
            row.last_error = None
            published += 1
        except Exception as exc:
            row.last_error = str(exc)[:2000]
            if row.attempts >= settings.outbox_relay_max_attempts:
                row.status = OutboxEventStatus.failed
            failed += 1
            logger.exception(
                "Outbox relay failed event_id=%s stream=%s attempt=%s",
                row.event_id,
                row.stream,
                row.attempts,
            )

    if rows:
        await session.flush()
    return {"published": published, "failed": failed, "processed": len(rows)}


async def claim_event_for_processing(session: AsyncSession, event: DomainEvent) -> bool:
    stmt = (
        insert(ProcessedDomainEvent)
        .values(event_id=event.event_id, event_type=event.event_type)
        .on_conflict_do_nothing(index_elements=["event_id"])
        .returning(ProcessedDomainEvent.event_id)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none() is not None


async def is_event_processed(session: AsyncSession, event_id: str) -> bool:
    row = await session.get(ProcessedDomainEvent, event_id)
    return row is not None
