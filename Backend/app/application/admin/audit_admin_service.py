from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models import AuditEventType
from app.infrastructure.persistence.repositories.audit_repository import SqlAlchemyAuditRepository


async def list_audit_logs(
    db: AsyncSession,
    *,
    user_id: UUID | None = None,
    event_type: AuditEventType | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    return await SqlAlchemyAuditRepository(db).list_logs(
        user_id=user_id,
        event_type=event_type,
        limit=limit,
        offset=offset,
    )
