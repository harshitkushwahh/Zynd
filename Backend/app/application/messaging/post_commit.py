"""Persist scheduled events to outbox and relay after commit."""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.messaging.outbox_service import (
    relay_pending_outbox,
    resolve_event_dispatch_mode,
)
from app.application.messaging.scheduled_events import take_scheduled_events
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


async def persist_scheduled_events(session: AsyncSession) -> int:
    from app.application.messaging import outbox_service as outbox

    return await outbox.persist_scheduled_events(session)


async def flush_scheduled_events() -> None:
    mode = resolve_event_dispatch_mode()
    if mode == "sync":
        from app.workers.event_dispatcher import dispatch_event

        for _stream, event in take_scheduled_events():
            await dispatch_event(event)
        return

    take_scheduled_events()
    async with AsyncSessionLocal() as session:
        try:
            stats = await relay_pending_outbox(session)
            await session.commit()
            if stats["processed"]:
                logger.debug("Outbox relay stats=%s", stats)
        except Exception:
            await session.rollback()
            logger.exception("Outbox relay batch failed")
