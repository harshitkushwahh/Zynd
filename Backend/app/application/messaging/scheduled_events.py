from __future__ import annotations

from contextvars import ContextVar

from app.domain.shared.events import DomainEvent

_ScheduledEvent = tuple[str, DomainEvent]
_pending_events: ContextVar[list[_ScheduledEvent] | None] = ContextVar("_pending_events", default=None)


def begin_event_batch() -> None:
    _pending_events.set([])


def discard_scheduled_events() -> None:
    _pending_events.set(None)


def schedule_domain_event(stream: str, event: DomainEvent) -> None:
    batch = _pending_events.get()
    if batch is None:
        batch = []
        _pending_events.set(batch)
    batch.append((stream, event))


def peek_scheduled_events() -> list[_ScheduledEvent]:
    return list(_pending_events.get() or [])


def take_scheduled_events() -> list[_ScheduledEvent]:
    batch = _pending_events.get()
    _pending_events.set(None)
    return batch or []
