from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.compliance.retention_service import get_retention_policy
from app.application.shared.datetime_utils import utcnow
from app.core.config import get_settings
from app.infrastructure.persistence.notification_models import UserNotification

logger = logging.getLogger(__name__)

USER_NOTIFICATIONS_DATA_CLASS = "user_notifications"
DEFAULT_RETENTION_DAYS = 365


async def purge_expired_notifications(
    db: AsyncSession,
    *,
    limit: int | None = None,
) -> dict[str, Any]:
    policy = await get_retention_policy(db, USER_NOTIFICATIONS_DATA_CLASS)
    retention_days = policy.min_retention_days if policy else DEFAULT_RETENTION_DAYS
    cutoff = utcnow() - timedelta(days=retention_days)

    batch_size = limit or get_settings().notifications_retention_purge_batch_size
    result = await db.execute(
        select(UserNotification.id)
        .where(
            UserNotification.read_at.is_not(None),
            UserNotification.created_at < cutoff,
        )
        .order_by(UserNotification.created_at.asc())
        .limit(batch_size)
    )
    notification_ids = [row[0] for row in result.all()]
    if not notification_ids:
        return {
            "purged_count": 0,
            "retention_days": retention_days,
            "cutoff": cutoff.isoformat(),
            "failed": 0,
        }

    delete_result = await db.execute(
        delete(UserNotification).where(UserNotification.id.in_(notification_ids))
    )
    purged_count = int(delete_result.rowcount or 0)

    logger.info(
        "notification.retention_purge purged_count=%s retention_days=%s cutoff=%s",
        purged_count,
        retention_days,
        cutoff.isoformat(),
    )

    return {
        "purged_count": purged_count,
        "retention_days": retention_days,
        "cutoff": cutoff.isoformat(),
        "failed": 0,
    }
