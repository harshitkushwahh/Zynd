from __future__ import annotations

import logging
import time
from uuid import UUID

from sqlalchemy import select

from app.application.notifications.notification_delivery_audit import (
    record_notification_push_failed,
)
from app.application.notifications.push_device_service import revoke_push_devices_by_tokens
from app.core.config import Settings, get_settings
from app.core.database import AsyncSessionLocal
from app.infrastructure.notifications.firebase_push_service import get_firebase_push_service
from app.infrastructure.persistence.notification_models import UserNotification
from app.infrastructure.queue.push_dispatch_queue import (
    enqueue_push_dispatch,
    move_push_dispatch_to_dead_letter,
    requeue_push_dispatch,
)

logger = logging.getLogger(__name__)


async def _send_push_to_device(
    *,
    notification: UserNotification,
    fcm_token: str,
    unread_count: int,
) -> tuple[bool, str | None]:
    push_service = get_firebase_push_service()
    return await push_service.send_to_token(
        token=fcm_token,
        notification=notification,
        unread_count=unread_count,
    )


async def dispatch_push_notification(
    *,
    user_id: UUID,
    notification: UserNotification,
    unread_count: int,
) -> dict[str, int]:
    push_service = get_firebase_push_service()
    if not push_service.is_enabled():
        return {"sent": 0, "queued": 0, "invalid": 0, "failed": 0}

    started = time.perf_counter()
    async with AsyncSessionLocal() as db:
        from app.application.notifications.push_device_service import list_active_push_devices

        devices = await list_active_push_devices(db, user_id)
        if not devices:
            return {"sent": 0, "queued": 0, "invalid": 0, "failed": 0}

        invalid_tokens: list[str] = []
        sent = 0
        queued = 0
        failed = 0

        for device in devices:
            ok, invalid_token = await _send_push_to_device(
                notification=notification,
                fcm_token=device.fcm_token,
                unread_count=unread_count,
            )
            if ok:
                sent += 1
            elif invalid_token:
                invalid_tokens.append(invalid_token)
            else:
                await enqueue_push_dispatch(
                    notification_id=notification.id,
                    user_id=user_id,
                    device_id=device.id,
                    fcm_token=device.fcm_token,
                    unread_count=unread_count,
                )
                queued += 1
                failed += 1

        if invalid_tokens:
            revoked = await revoke_push_devices_by_tokens(db, tokens=invalid_tokens)
            logger.info("Revoked %s invalid FCM device token(s) for user_id=%s", revoked, user_id)

        if invalid_tokens:
            await db.commit()

        latency_ms = int((time.perf_counter() - started) * 1000)
        logger.info(
            "notification.push_dispatch user_id=%s notification_id=%s sent=%s queued=%s invalid=%s latency_ms=%s",
            user_id,
            notification.id,
            sent,
            queued,
            len(invalid_tokens),
            latency_ms,
        )

        return {
            "sent": sent,
            "queued": queued,
            "invalid": len(invalid_tokens),
            "failed": failed,
        }


async def process_push_dispatch_job(
    *,
    raw_payload: str,
    notification_id: UUID,
    user_id: UUID,
    device_id: UUID,
    fcm_token: str,
    unread_count: int,
    attempt: int,
    settings: Settings | None = None,
) -> None:
    settings = settings or get_settings()
    push_service = get_firebase_push_service()
    if not push_service.is_enabled():
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(UserNotification).where(
                UserNotification.id == notification_id,
                UserNotification.user_id == user_id,
            )
        )
        notification = result.scalar_one_or_none()
        if not notification:
            logger.warning(
                "Push retry skipped — notification missing notification_id=%s user_id=%s",
                notification_id,
                user_id,
            )
            return

        ok, invalid_token = await _send_push_to_device(
            notification=notification,
            fcm_token=fcm_token,
            unread_count=unread_count,
        )

        if ok:
            logger.info(
                "notification.push_retry_success notification_id=%s device_id=%s attempt=%s",
                notification_id,
                device_id,
                attempt,
            )
            return

        if invalid_token:
            await revoke_push_devices_by_tokens(db, tokens=[invalid_token])
            await db.commit()
            logger.info(
                "notification.push_retry_invalid_token notification_id=%s device_id=%s attempt=%s",
                notification_id,
                device_id,
                attempt,
            )
            return

        next_attempt = attempt + 1
        if next_attempt <= settings.notifications_push_max_attempts:
            await requeue_push_dispatch(
                notification_id=notification_id,
                user_id=user_id,
                device_id=device_id,
                fcm_token=fcm_token,
                unread_count=unread_count,
                attempt=next_attempt,
                settings=settings,
            )
            logger.warning(
                "notification.push_requeued notification_id=%s device_id=%s attempt=%s",
                notification_id,
                device_id,
                next_attempt,
            )
            return

        await move_push_dispatch_to_dead_letter(
            raw_payload,
            reason="max_attempts_exceeded",
            settings=settings,
        )
        await record_notification_push_failed(
            db,
            user_id=user_id,
            notification_id=notification_id,
            device_id=device_id,
            reason="max_attempts_exceeded",
            attempt=attempt,
        )
        await db.commit()


async def handle_failed_push_dispatch_job(
    *,
    raw_payload: str,
    notification_id: UUID,
    user_id: UUID,
    device_id: UUID,
    fcm_token: str,
    unread_count: int,
    attempt: int,
    reason: str,
    settings: Settings | None = None,
) -> None:
    settings = settings or get_settings()
    next_attempt = attempt + 1
    if next_attempt <= settings.notifications_push_max_attempts:
        await requeue_push_dispatch(
            notification_id=notification_id,
            user_id=user_id,
            device_id=device_id,
            fcm_token=fcm_token,
            unread_count=unread_count,
            attempt=next_attempt,
            settings=settings,
        )
        logger.warning(
            "notification.push_requeued notification_id=%s device_id=%s attempt=%s reason=%s",
            notification_id,
            device_id,
            next_attempt,
            reason,
        )
        return

    await move_push_dispatch_to_dead_letter(raw_payload, reason=reason, settings=settings)
    async with AsyncSessionLocal() as db:
        await record_notification_push_failed(
            db,
            user_id=user_id,
            notification_id=notification_id,
            device_id=device_id,
            reason=reason,
            attempt=attempt,
        )
        await db.commit()
