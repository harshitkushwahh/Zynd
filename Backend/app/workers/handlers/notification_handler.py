from __future__ import annotations

import logging
import time
from uuid import UUID

from sqlalchemy import select

from app.application.notifications.notification_delivery_audit import record_notification_delivery
from app.application.notifications.notification_service import (
    count_unread,
    get_preference_for_category,
    insert_in_app_notification,
)
from app.application.notifications.push_dispatch_service import dispatch_push_notification
from app.application.notifications.types import NOTIFICATION_DEFINITIONS, NotificationType
from app.core.database import AsyncSessionLocal
from app.domain.notifications.events import NotificationCreatedPayload
from app.domain.shared.event_factory import parse_event_payload
from app.domain.shared.events import DomainEvent
from app.infrastructure.notifications.notification_realtime_publisher import publish_notification_created
from app.infrastructure.persistence.notification_models import NotificationCategory, UserNotification
from app.infrastructure.persistence.repositories.user_repository import SqlAlchemyUserRepository
from app.workers.handlers.email_handler import deliver_security_email

logger = logging.getLogger(__name__)


async def _is_duplicate_notification(db, *, user_id, idempotency_key: str | None) -> bool:
    if not idempotency_key:
        return False
    result = await db.execute(
        select(UserNotification.id).where(
            UserNotification.user_id == user_id,
            UserNotification.idempotency_key == idempotency_key,
        )
    )
    return result.scalar_one_or_none() is not None


async def handle_notification_created(event: DomainEvent) -> None:
    started = time.perf_counter()
    payload = parse_event_payload(event, NotificationCreatedPayload)
    category = NotificationCategory(payload.category)
    definition = NOTIFICATION_DEFINITIONS.get(NotificationType(payload.notification_type))

    to_email = payload.user_email
    send_email = False
    send_in_app = False
    notification_row = None
    unread_count = 0
    email_delivered = False
    push_stats = {"sent": 0, "queued": 0, "invalid": 0, "failed": 0}

    async with AsyncSessionLocal() as db:
        user = await SqlAlchemyUserRepository(db).get_by_id(payload.user_id)
        if not user:
            return

        if await _is_duplicate_notification(
            db, user_id=payload.user_id, idempotency_key=payload.idempotency_key
        ):
            return

        to_email = to_email or user.email
        pref = await get_preference_for_category(db, payload.user_id, category)
        send_in_app = pref.in_app_enabled
        send_email = pref.email_enabled or (
            definition.email_required if definition else category == NotificationCategory.security
        )

        if send_in_app:
            notification_row = await insert_in_app_notification(
                db,
                user_id=payload.user_id,
                category=category,
                notification_type=payload.notification_type,
                title=payload.title,
                body=payload.body,
                metadata=payload.metadata,
                idempotency_key=payload.idempotency_key,
            )
            if notification_row is not None:
                unread_count = await count_unread(db, payload.user_id)
        await db.commit()

    if send_in_app and notification_row is not None:
        await publish_notification_created(
            user_id=payload.user_id,
            notification=notification_row,
            unread_count=unread_count,
        )
        push_stats = await dispatch_push_notification(
            user_id=payload.user_id,
            notification=notification_row,
            unread_count=unread_count,
        )

    if send_email and to_email and not to_email.startswith("deleted+"):
        email_delivered = await deliver_security_email(
            to_email=to_email,
            subject=payload.email_subject or payload.title,
            body=payload.body,
        )

    if notification_row is not None:
        latency_ms = int((time.perf_counter() - started) * 1000)
        try:
            async with AsyncSessionLocal() as db:
                await record_notification_delivery(
                    db,
                    user_id=payload.user_id,
                    notification_id=notification_row.id,
                    notification_type=payload.notification_type,
                    channels={
                        "in_app": True,
                        "email": bool(send_email and email_delivered),
                        "push_sent": push_stats["sent"],
                        "push_queued": push_stats["queued"],
                        "push_invalid_tokens": push_stats["invalid"],
                    },
                    latency_ms=latency_ms,
                )
                await db.commit()
        except Exception:
            logger.exception(
                "notification.delivery_audit_failed notification_id=%s user_id=%s",
                notification_row.id,
                payload.user_id,
            )
