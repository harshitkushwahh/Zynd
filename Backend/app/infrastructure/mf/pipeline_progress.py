from __future__ import annotations

from collections.abc import Awaitable, Callable
from contextlib import asynccontextmanager
from contextvars import ContextVar
from typing import AsyncIterator

ProgressSink = Callable[[str], Awaitable[None]]

_progress_sink: ContextVar[ProgressSink | None] = ContextVar("mf_pipeline_progress_sink", default=None)


async def emit_pipeline_progress(message: str) -> None:
    print(message, flush=True)
    sink = _progress_sink.get()
    if sink is not None:
        await sink(message)


@asynccontextmanager
async def pipeline_progress_sink(sink: ProgressSink) -> AsyncIterator[None]:
    token = _progress_sink.set(sink)
    try:
        yield
    finally:
        _progress_sink.reset(token)
