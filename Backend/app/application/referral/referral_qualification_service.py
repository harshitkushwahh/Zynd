"""Referral qualification batch job — advance referrals after the investment hold."""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.referral.referral_attribution_service import advance_referral_qualified
from app.application.shared.datetime_utils import utcnow
from app.core.config import get_settings
from app.infrastructure.persistence.referral_models import ReferralAttribution, ReferralStage


async def list_attributions_pending_qualification(
    db: AsyncSession,
    *,
    limit: int = 100,
) -> list[ReferralAttribution]:
    result = await db.execute(
        select(ReferralAttribution)
        .where(
            ReferralAttribution.current_stage == ReferralStage.first_investment,
            ReferralAttribution.first_investment_at.is_not(None),
            ReferralAttribution.first_investment_reversed_at.is_(None),
        )
        .order_by(ReferralAttribution.first_investment_at.asc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def run_referral_qualification_batch(
    db: AsyncSession,
    *,
    limit: int = 100,
    now: datetime | None = None,
) -> dict[str, int]:
    settings = get_settings()
    now = now or utcnow()
    rows = await list_attributions_pending_qualification(db, limit=limit)

    qualified = 0
    skipped_hold = 0
    for attribution in rows:
        hold_deadline = attribution.first_investment_at + timedelta(
            days=settings.referral_qualification_hold_days
        )
        if now < hold_deadline:
            skipped_hold += 1
            continue

        updated = await advance_referral_qualified(
            db,
            referee_user_id=attribution.referee_user_id,
            now=now,
        )
        if updated is not None and updated.current_stage == ReferralStage.qualified:
            qualified += 1

    return {
        "processed": len(rows),
        "qualified": qualified,
        "skipped_hold": skipped_hold,
    }


__all__ = ["list_attributions_pending_qualification", "run_referral_qualification_batch"]
