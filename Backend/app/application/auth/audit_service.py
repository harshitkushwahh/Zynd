from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models import AuditEventType
from app.infrastructure.persistence.repositories.audit_repository import SqlAlchemyAuditRepository


def _audit_repo(db: AsyncSession) -> SqlAlchemyAuditRepository:
    return SqlAlchemyAuditRepository(db)


async def write_audit(
    db: AsyncSession,
    *,
    event_type: AuditEventType,
    user_id: UUID | None = None,
    ip: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    await _audit_repo(db).append(
        event_type=event_type,
        user_id=user_id,
        ip=ip,
        metadata=metadata,
    )


async def write_session_revoked(
    db: AsyncSession,
    *,
    user_id: UUID,
    session_id: UUID,
    reason: str,
    ip: str | None,
) -> None:
    await write_audit(
        db,
        event_type=AuditEventType.session_revoked,
        user_id=user_id,
        ip=ip,
        metadata={"session_id": str(session_id), "reason": reason},
    )


async def write_sessions_revoked_all(
    db: AsyncSession,
    *,
    user_id: UUID,
    count: int,
    reason: str,
    ip: str | None,
) -> None:
    await write_audit(
        db,
        event_type=AuditEventType.sessions_revoked_all,
        user_id=user_id,
        ip=ip,
        metadata={"count": count, "reason": reason},
    )
