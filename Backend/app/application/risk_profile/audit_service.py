"""Risk profile audit event helpers."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.audit_admin_service import list_audit_logs
from app.infrastructure.persistence.models import AuditEventType

RISK_PROFILE_AUDIT_EVENTS: tuple[AuditEventType, ...] = (
    AuditEventType.risk_category_created,
    AuditEventType.risk_category_updated,
    AuditEventType.risk_question_created,
    AuditEventType.risk_question_updated,
    AuditEventType.risk_question_deleted,
    AuditEventType.risk_question_bulk_imported,
    AuditEventType.risk_template_created,
    AuditEventType.risk_template_updated,
    AuditEventType.risk_tier_config_updated,
    AuditEventType.risk_profile_completed,
    AuditEventType.risk_profile_message_sent,
)


async def list_risk_profile_audit_logs(
    db: AsyncSession,
    *,
    user_id: UUID | None = None,
    event_type: AuditEventType | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    if event_type:
        allowed = {event_type}
    else:
        allowed = set(RISK_PROFILE_AUDIT_EVENTS)

    merged: list[dict[str, Any]] = []
    for candidate in allowed:
        rows = await list_audit_logs(
            db,
            user_id=user_id,
            event_type=candidate,
            limit=limit,
            offset=0,
        )
        merged.extend(rows)

    merged.sort(key=lambda item: item["created_at"], reverse=True)
    start = max(offset, 0)
    end = start + min(limit, 200)
    return merged[start:end]
