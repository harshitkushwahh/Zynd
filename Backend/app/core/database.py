from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()

_engine_connect_args: dict[str, object] = {}
if settings.app_env == "development":
    # Avoid asyncpg stale prepared plans after local schema resets without a full process restart.
    _engine_connect_args["prepared_statement_cache_size"] = 0

engine = create_async_engine(
    settings.database_url,
    echo=settings.database_echo,
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args=_engine_connect_args,
)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def commit_session_with_events(session: AsyncSession) -> None:
    from app.application.messaging.post_commit import flush_scheduled_events, persist_scheduled_events
    from app.application.messaging.scheduled_events import discard_scheduled_events

    await persist_scheduled_events(session)
    await session.commit()
    from app.application.support.realtime.publisher import flush_support_realtime_events
    from app.application.support.webhook_dispatcher import flush_support_webhooks

    await flush_support_realtime_events()
    await flush_support_webhooks()
    await flush_scheduled_events()
    discard_scheduled_events()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    from app.application.messaging.scheduled_events import begin_event_batch, discard_scheduled_events

    from app.application.support.realtime.queue import begin_support_realtime_batch, discard_support_realtime_batch
    from app.application.support.webhook_dispatcher import begin_support_webhook_batch, discard_support_webhook_batch

    begin_event_batch()
    begin_support_realtime_batch()
    begin_support_webhook_batch()
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await commit_session_with_events(session)
        except Exception:
            discard_support_realtime_batch()
            discard_support_webhook_batch()
            await session.rollback()
            discard_scheduled_events()
            raise
