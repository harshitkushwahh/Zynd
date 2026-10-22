from __future__ import annotations

import uuid
from enum import Enum

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.infrastructure.persistence.zto_models import ZtoUserFlow


class ZtoPhase(str, Enum):
    DISABLED = "DISABLED"  # feature off
    NOT_STARTED = "NOT_STARTED"  # user never opted in (no consents / flow row)
    LOOKUP_PENDING = "LOOKUP_PENDING"  # consents recorded; lookups not run yet
    LOOKUPS_RUNNING = "LOOKUPS_RUNNING"
    REVIEW_PENDING = "REVIEW_PENDING"
    LOOKUPS_FAILED = "LOOKUPS_FAILED"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"


def resolve_phase_from_flow(flow: ZtoUserFlow | None, *, enabled: bool) -> ZtoPhase:
    if not enabled:
        return ZtoPhase.DISABLED
    if flow is None:
        return ZtoPhase.NOT_STARTED
    try:
        return ZtoPhase(flow.phase)
    except ValueError:
        return ZtoPhase.NOT_STARTED


async def get_flow(db: AsyncSession, user_id: uuid.UUID) -> ZtoUserFlow | None:
    result = await db.execute(select(ZtoUserFlow).where(ZtoUserFlow.user_id == user_id))
    return result.scalar_one_or_none()


async def resolve_zto_phase(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    settings: Settings | None = None,
) -> ZtoPhase:
    settings = settings or get_settings()
    if not settings.zto_enabled:
        return ZtoPhase.DISABLED
    return resolve_phase_from_flow(await get_flow(db, user_id), enabled=True)


def is_review_required(phase: ZtoPhase) -> bool:
    return phase == ZtoPhase.REVIEW_PENDING
