from __future__ import annotations

from typing import Any, Protocol
from uuid import UUID

from app.infrastructure.persistence.models import AuditEventType


class AuditRepository(Protocol):
    async def append(
        self,
        *,
        event_type: AuditEventType,
        user_id: UUID | None = None,
        ip: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        ...

    async def list_logs(
        self,
        *,
        user_id: UUID | None = None,
        event_type: AuditEventType | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        ...
