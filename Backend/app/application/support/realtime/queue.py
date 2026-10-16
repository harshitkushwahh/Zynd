from __future__ import annotations

from contextvars import ContextVar
from typing import Any

_pending: ContextVar[list[dict[str, Any]] | None] = ContextVar("_support_realtime_pending", default=None)


def begin_support_realtime_batch() -> None:
    _pending.set([])


def discard_support_realtime_batch() -> None:
    _pending.set(None)


def enqueue_support_realtime_event(event: dict[str, Any]) -> None:
    batch = _pending.get()
    if batch is None:
        batch = []
        _pending.set(batch)
    batch.append(event)


def take_support_realtime_events() -> list[dict[str, Any]]:
    batch = _pending.get()
    _pending.set(None)
    return batch or []
