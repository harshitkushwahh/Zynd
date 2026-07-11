from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.audit_service import write_audit
from app.infrastructure.persistence.models import AuditEventType

logger = logging.getLogger(__name__)


async def record_notification_delivery(
    db: AsyncSession,
    *,
    user_id: UUID,
    notification_id: UUID,
    notification_type: str,
    channels: dict[str, Any],
    latency_ms: int | None = None,
) -> None:
    metadata: dict[str, Any] = {
        "notification_id": str(notification_id),
        "notification_type": notification_type,
        "channels": channels,
    }
    if latency_ms is not None:
        metadata["latency_ms"] = latency_ms

    await write_audit(
        db,
        event_type=AuditEventType.notification_dispatched,
        user_id=user_id,
        metadata=metadata,
    )

    logger.info(
        "notification.delivery user_id=%s notification_id=%s channels=%s latency_ms=%s",
        user_id,
        notification_id,
        channels,
        latency_ms,
    )


async def record_notification_push_failed(
    db: AsyncSession,
    *,
    user_id: UUID,
    notification_id: UUID,
    device_id: UUID,
    reason: str,
    attempt: int,
) -> None:
    await write_audit(
        db,
        event_type=AuditEventType.notification_push_failed,
        user_id=user_id,
        metadata={
            "notification_id": str(notification_id),
            "device_id": str(device_id),
            "reason": reason,
            "attempt": attempt,
        },
    )

    logger.warning(
        "notification.push_failed user_id=%s notification_id=%s device_id=%s attempt=%s reason=%s",
        user_id,
        notification_id,
        device_id,
        attempt,
        reason,
    )
