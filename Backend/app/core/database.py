from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
engine = create_async_engine(
    settings.database_url,
    echo=settings.database_echo,
    pool_pre_ping=True,
    pool_recycle=300,
)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def commit_session_with_events(session: AsyncSession) -> None:
    from app.application.messaging.post_commit import flush_scheduled_events, persist_scheduled_events
    from app.application.messaging.scheduled_events import discard_scheduled_events

    await persist_scheduled_events(session)
    await session.commit()
    await flush_scheduled_events()
    discard_scheduled_events()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    from app.application.messaging.scheduled_events import begin_event_batch, discard_scheduled_events

    begin_event_batch()
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await commit_session_with_events(session)
        except Exception:
            await session.rollback()
            discard_scheduled_events()
            raise
