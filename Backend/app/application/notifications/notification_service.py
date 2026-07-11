from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.messaging.outbox_service import resolve_event_dispatch_mode
from app.application.messaging.scheduled_events import schedule_domain_event
from app.application.notifications.types import (
    DEFAULT_PREFERENCE_CATEGORIES,
    NOTIFICATION_DEFINITIONS,
    NotificationDefinition,
    NotificationType,
)
from app.application.shared.datetime_utils import utcnow
from app.core.database import AsyncSessionLocal
from app.domain.notifications.events import NotificationCreatedPayload, notification_created_event
from app.infrastructure.persistence.models import OutboxEvent, OutboxEventStatus
from app.infrastructure.persistence.notification_models import (
    NotificationCategory,
    UserNotification,
    UserNotificationPreference,
)

logger = logging.getLogger(__name__)

STREAM_NOTIFICATIONS_DISPATCH = "notifications.dispatch"


def _get_definition(notification_type: NotificationType | str) -> NotificationDefinition:
    if isinstance(notification_type, str):
        notification_type = NotificationType(notification_type)
    return NOTIFICATION_DEFINITIONS[notification_type]


def schedule_user_notification(
    *,
    user_id: UUID,
    user_email: str,
    notification_type: NotificationType | str,
    title: str,
    body: str,
    metadata: dict[str, Any] | None = None,
    idempotency_key: str | None = None,
    email_subject: str | None = None,
) -> None:
    """Schedule a notification for post-commit dispatch (request path)."""
    definition = _get_definition(notification_type)
    schedule_domain_event(
        STREAM_NOTIFICATIONS_DISPATCH,
        notification_created_event(
            NotificationCreatedPayload(
                user_id=user_id,
                user_email=user_email,
                category=definition.category.value,
                notification_type=definition.notification_type.value,
                title=title,
                body=body,
                metadata=metadata,
                idempotency_key=idempotency_key,
                email_subject=email_subject or title,
            )
        ),
    )


async def enqueue_user_notification(
    *,
    user_id: UUID,
    user_email: str,
    notification_type: NotificationType | str,
    title: str,
    body: str,
    metadata: dict[str, Any] | None = None,
    idempotency_key: str | None = None,
    email_subject: str | None = None,
) -> None:
    """Persist notification event to outbox immediately (worker / background path)."""
    definition = _get_definition(notification_type)
    event = notification_created_event(
        NotificationCreatedPayload(
            user_id=user_id,
            user_email=user_email,
            category=definition.category.value,
            notification_type=definition.notification_type.value,
            title=title,
            body=body,
            metadata=metadata,
            idempotency_key=idempotency_key,
            email_subject=email_subject or title,
        )
    )
    async with AsyncSessionLocal() as session:
        session.add(
            OutboxEvent(
                event_id=event.event_id,
                stream=STREAM_NOTIFICATIONS_DISPATCH,
                event_type=event.event_type,
                payload=event.model_dump(mode="json"),
                status=OutboxEventStatus.pending,
            )
        )
        await session.commit()

    if resolve_event_dispatch_mode() == "sync":
        from app.workers.event_dispatcher import dispatch_event

        await dispatch_event(event)


async def ensure_default_preferences(
    db: AsyncSession,
    user_id: UUID,
) -> list[UserNotificationPreference]:
    existing = await db.execute(
        select(UserNotificationPreference).where(UserNotificationPreference.user_id == user_id)
    )
    by_category = {row.category: row for row in existing.scalars()}
    created: list[UserNotificationPreference] = []
    for category in DEFAULT_PREFERENCE_CATEGORIES:
        if category in by_category:
            continue
        pref = UserNotificationPreference(
            user_id=user_id,
            category=category,
            email_enabled=True,
            in_app_enabled=True,
        )
        db.add(pref)
        created.append(pref)
    if created:
        await db.flush()
    return list(by_category.values()) + created


async def get_preferences(db: AsyncSession, user_id: UUID) -> list[UserNotificationPreference]:
    return await ensure_default_preferences(db, user_id)


async def update_preference(
    db: AsyncSession,
    *,
    user_id: UUID,
    user_email: str | None = None,
    category: NotificationCategory,
    email_enabled: bool | None = None,
    in_app_enabled: bool | None = None,
) -> UserNotificationPreference:
    await ensure_default_preferences(db, user_id)
    result = await db.execute(
        select(UserNotificationPreference).where(
            UserNotificationPreference.user_id == user_id,
            UserNotificationPreference.category == category,
        )
    )
    pref = result.scalar_one()
    if category == NotificationCategory.security and email_enabled is False:
        email_enabled = True
    if email_enabled is not None:
        pref.email_enabled = email_enabled
    if in_app_enabled is not None:
        pref.in_app_enabled = in_app_enabled
    pref.updated_at = utcnow()
    await db.flush()

    if user_email is None:
        from app.infrastructure.persistence.models import User

        user = await db.get(User, user_id)
        user_email = user.email if user else None
    if user_email:
        from app.application.notifications.account_notification_service import (
            notify_account_settings_changed,
        )

        notify_account_settings_changed(
            user_id=user_id,
            user_email=user_email,
            category=category,
        )
    return pref


async def list_notifications(
    db: AsyncSession,
    *,
    user_id: UUID,
    limit: int = 20,
    offset: int = 0,
    unread_only: bool = False,
) -> tuple[list[UserNotification], int]:
    filters = [UserNotification.user_id == user_id]
    if unread_only:
        filters.append(UserNotification.read_at.is_(None))

    total_result = await db.execute(select(func.count()).select_from(UserNotification).where(*filters))
    total = int(total_result.scalar_one())

    result = await db.execute(
        select(UserNotification)
        .where(*filters)
        .order_by(UserNotification.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars()), total


async def get_notification(
    db: AsyncSession,
    *,
    user_id: UUID,
    notification_id: UUID,
) -> UserNotification | None:
    result = await db.execute(
        select(UserNotification).where(
            UserNotification.id == notification_id,
            UserNotification.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def count_unread_from_db(db: AsyncSession, user_id: UUID) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(UserNotification)
        .where(UserNotification.user_id == user_id, UserNotification.read_at.is_(None))
    )
    return int(result.scalar_one())


async def count_unread(db: AsyncSession, user_id: UUID) -> int:
    from app.application.notifications.unread_count_cache import resolve_unread_count

    return await resolve_unread_count(db, user_id)


async def mark_notification_read(
    db: AsyncSession,
    *,
    user_id: UUID,
    notification_id: UUID,
) -> UserNotification | None:
    result = await db.execute(
        select(UserNotification).where(
            UserNotification.id == notification_id,
            UserNotification.user_id == user_id,
        )
    )
    row = result.scalar_one_or_none()
    if not row or row.read_at is not None:
        return row
    row.read_at = utcnow()
    await db.flush()

    from app.application.notifications.unread_count_cache import decrement_unread_count

    await decrement_unread_count(user_id)
    return row


async def mark_all_read(db: AsyncSession, *, user_id: UUID) -> int:
    now = utcnow()
    result = await db.execute(
        update(UserNotification)
        .where(UserNotification.user_id == user_id, UserNotification.read_at.is_(None))
        .values(read_at=now)
    )
    updated = int(result.rowcount or 0)

    from app.application.notifications.unread_count_cache import set_cached_unread_count

    await set_cached_unread_count(user_id, 0)
    return updated


async def insert_in_app_notification(
    db: AsyncSession,
    *,
    user_id: UUID,
    category: NotificationCategory,
    notification_type: str,
    title: str,
    body: str,
    metadata: dict[str, Any] | None = None,
    idempotency_key: str | None = None,
) -> UserNotification | None:
    if idempotency_key:
        existing = await db.execute(
            select(UserNotification).where(
                UserNotification.user_id == user_id,
                UserNotification.idempotency_key == idempotency_key,
            )
        )
        if existing.scalar_one_or_none():
            return None

    row = UserNotification(
        user_id=user_id,
        category=category,
        notification_type=notification_type,
        title=title,
        body=body,
        metadata_json=metadata,
        idempotency_key=idempotency_key,
    )
    db.add(row)
    await db.flush()

    from app.application.notifications.unread_count_cache import invalidate_unread_count

    await invalidate_unread_count(user_id)
    return row


async def get_preference_for_category(
    db: AsyncSession,
    user_id: UUID,
    category: NotificationCategory,
) -> UserNotificationPreference:
    prefs = await ensure_default_preferences(db, user_id)
    for pref in prefs:
        if pref.category == category:
            return pref
    raise RuntimeError(f"Missing preference for category={category.value}")


__all__ = [
    "STREAM_NOTIFICATIONS_DISPATCH",
    "count_unread",
    "count_unread_from_db",
    "enqueue_user_notification",
    "ensure_default_preferences",
    "get_notification",
    "get_preference_for_category",
    "get_preferences",
    "insert_in_app_notification",
    "list_notifications",
    "mark_all_read",
    "mark_notification_read",
    "schedule_user_notification",
    "update_preference",
]
