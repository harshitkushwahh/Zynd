from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.mf_transaction_models import (
    MfExternalHolding,
    MfOrder,
    MfOrderStatus,
)
from app.infrastructure.persistence.models import KycOverallStatus, UserKycStatus


async def kyc_completed_user_ids(db: AsyncSession, user_ids: list[UUID]) -> set[UUID]:
    if not user_ids:
        return set()

    rows = await db.execute(
        select(UserKycStatus.user_id).where(
            UserKycStatus.user_id.in_(user_ids),
            UserKycStatus.overall_status == KycOverallStatus.completed,
        )
    )
    return set(rows.scalars())


async def invested_user_ids(db: AsyncSession, user_ids: list[UUID]) -> set[UUID]:
    if not user_ids:
        return set()

    order_rows = await db.execute(
        select(MfOrder.user_id)
        .where(
            MfOrder.user_id.in_(user_ids),
            MfOrder.status == MfOrderStatus.succeeded,
        )
        .distinct()
    )
    holding_rows = await db.execute(
        select(MfExternalHolding.user_id)
        .where(MfExternalHolding.user_id.in_(user_ids))
        .distinct()
    )
    return set(order_rows.scalars()) | set(holding_rows.scalars())


async def load_member_insights(
    db: AsyncSession,
    user_ids: list[UUID],
) -> dict[UUID, dict[str, bool]]:
    kyc_completed = await kyc_completed_user_ids(db, user_ids)
    invested = await invested_user_ids(db, user_ids)
    return {
        user_id: {
            "kyc_completed": user_id in kyc_completed,
            "has_invested": user_id in invested,
        }
        for user_id in user_ids
    }
