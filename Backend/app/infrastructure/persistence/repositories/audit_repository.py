from __future__ import annotations

from collections.abc import Collection
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.persistence.models import AuditEventType, AuditLog


class SqlAlchemyAuditRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def append(
        self,
        *,
        event_type: AuditEventType,
        user_id: UUID | None = None,
        ip: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self._session.add(
            AuditLog(
                user_id=user_id,
                event_type=event_type,
                ip_address=ip,
                metadata_=metadata,
            )
        )

    async def list_logs(
        self,
        *,
        user_id: UUID | None = None,
        event_type: AuditEventType | None = None,
        event_types: Collection[AuditEventType] | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        query = (
            select(AuditLog)
            .options(selectinload(AuditLog.user))
            .order_by(AuditLog.created_at.desc())
        )
        if user_id:
            query = query.where(AuditLog.user_id == user_id)
        if event_types:
            query = query.where(AuditLog.event_type.in_(tuple(event_types)))
        elif event_type:
            query = query.where(AuditLog.event_type == event_type)
        query = query.limit(min(limit, 200)).offset(max(offset, 0))
        result = await self._session.execute(query)
        items: list[dict[str, Any]] = []
        for row in result.scalars():
            user = row.user
            items.append(
                {
                    "id": row.id,
                    "user_id": row.user_id,
                    "user_email": user.email if user else None,
                    "client_id": user.client_id if user else None,
                    "event_type": row.event_type.value,
                    "ip_address": row.ip_address,
                    "metadata": row.metadata_ or {},
                    "created_at": row.created_at,
                }
            )
        return items
