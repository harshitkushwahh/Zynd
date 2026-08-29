"""Recommendation audit event helpers."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.audit_admin_service import list_audit_logs
from app.infrastructure.persistence.models import AuditEventType

RECOMMENDATION_AUDIT_EVENTS: tuple[AuditEventType, ...] = (
    AuditEventType.recommendation_basket_created,
    AuditEventType.recommendation_basket_updated,
    AuditEventType.recommendation_basket_deleted,
    AuditEventType.recommendation_basket_funds_replaced,
    AuditEventType.recommendation_config_published,
)


async def list_recommendation_audit_logs(
    db: AsyncSession,
    *,
    user_id: UUID | None = None,
    event_type: AuditEventType | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    event_types = (event_type,) if event_type else RECOMMENDATION_AUDIT_EVENTS
    return await list_audit_logs(
        db,
        user_id=user_id,
        event_types=event_types,
        limit=limit,
        offset=offset,
    )
