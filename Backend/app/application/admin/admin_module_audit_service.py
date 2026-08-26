"""Shared audit helpers for admin console modules."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.audit_service import write_audit
from app.infrastructure.persistence.models import AuditEventType, User


async def write_admin_module_audit(
    db: AsyncSession,
    *,
    actor: User | None,
    module: str,
    kind: str,
    ip: str | None = None,
    **metadata: Any,
) -> None:
    if actor is None:
        return
    await write_audit(
        db,
        event_type=AuditEventType.admin_action_requested,
        user_id=actor.id,
        ip=ip,
        metadata={"module": module, "kind": kind, **metadata},
    )


def audit_metadata_value(value: Any) -> Any:
    if isinstance(value, UUID):
        return str(value)
    return value
