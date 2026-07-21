"""Family groups audit event helpers."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.audit_admin_service import list_audit_logs
from app.infrastructure.persistence.models import AuditEventType

FAMILY_GROUP_AUDIT_EVENTS: tuple[AuditEventType, ...] = (
    AuditEventType.family_group_created,
    AuditEventType.family_group_updated,
    AuditEventType.family_group_archived,
    AuditEventType.family_group_invite_sent,
    AuditEventType.family_group_invite_accepted,
    AuditEventType.family_group_invite_declined,
    AuditEventType.family_group_invite_revoked,
    AuditEventType.family_group_member_role_changed,
    AuditEventType.family_group_member_removed,
    AuditEventType.family_group_member_left,
    AuditEventType.family_group_head_transferred,
    AuditEventType.family_group_nominee_kyc_invited,
    AuditEventType.family_group_nominee_kyc_skipped,
)


async def list_family_group_audit_logs(
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
        allowed = set(FAMILY_GROUP_AUDIT_EVENTS)

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
