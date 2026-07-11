"""Referral engagement milestones — Stage 5 post-qualification activity."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.referral.referral_attribution_service import (
    get_attribution_for_referee,
    referral_stage_at_or_beyond,
)
from app.application.referral.referral_notification_service import notify_referrer_engaged
from app.application.shared.datetime_utils import utcnow
from app.core.config import get_settings
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.referral_models import (
    ReferralAttribution,
    ReferralEngagementEvent,
    ReferralEngagementMilestone,
    ReferralInvestmentProduct,
    ReferralStage,
)


@dataclass(frozen=True)
class ReferralEngagementResult:
    attribution: ReferralAttribution | None
    events: tuple[ReferralEngagementEvent, ...]


async def _get_existing_milestone(
    db: AsyncSession,
    *,
    attribution_id: UUID,
    milestone_type: ReferralEngagementMilestone,
) -> ReferralEngagementEvent | None:
    result = await db.execute(
        select(ReferralEngagementEvent).where(
            ReferralEngagementEvent.attribution_id == attribution_id,
            ReferralEngagementEvent.milestone_type == milestone_type,
        )
    )
    return result.scalar_one_or_none()


async def _record_milestone(
    db: AsyncSession,
    *,
    attribution: ReferralAttribution,
    milestone_type: ReferralEngagementMilestone,
    product: ReferralInvestmentProduct | None = None,
    amount_inr: int | None = None,
    total_aum_inr: int | None = None,
) -> tuple[ReferralEngagementEvent | None, bool]:
    existing = await _get_existing_milestone(
        db,
        attribution_id=attribution.id,
        milestone_type=milestone_type,
    )
    if existing is not None:
        return existing, False

    event = ReferralEngagementEvent(
        attribution_id=attribution.id,
        referrer_user_id=attribution.referrer_user_id,
        referee_user_id=attribution.referee_user_id,
        milestone_type=milestone_type,
        product=product,
        amount_inr=amount_inr,
        total_aum_inr=total_aum_inr,
    )
    db.add(event)
    await db.flush()
    return event, True


async def advance_referral_engaged(
    db: AsyncSession,
    *,
    attribution: ReferralAttribution,
) -> ReferralAttribution:
    if referral_stage_at_or_beyond(attribution.current_stage, ReferralStage.engaged):
        return attribution
    if not referral_stage_at_or_beyond(attribution.current_stage, ReferralStage.qualified):
        return attribution

    attribution.current_stage = ReferralStage.engaged
    attribution.engaged_at = utcnow()
    await db.flush()

    referee = await db.get(User, attribution.referee_user_id)
    referrer = await db.get(User, attribution.referrer_user_id)
    if referee and referrer:
        await notify_referrer_engaged(
            db,
            referrer=referrer,
            referee=referee,
            attribution=attribution,
        )
    return attribution


async def record_referral_engagement_investment(
    db: AsyncSession,
    *,
    user: User,
    product: ReferralInvestmentProduct,
    amount_inr: int,
) -> ReferralEngagementResult:
    settings = get_settings()
    if amount_inr < settings.referral_min_engagement_investment_inr:
        return ReferralEngagementResult(attribution=None, events=())

    attribution = await get_attribution_for_referee(db, referee_user_id=user.id)
    if attribution is None:
        return ReferralEngagementResult(attribution=None, events=())
    if not referral_stage_at_or_beyond(attribution.current_stage, ReferralStage.qualified):
        return ReferralEngagementResult(attribution=attribution, events=())

    events: list[ReferralEngagementEvent] = []

    second_event, created_second = await _record_milestone(
        db,
        attribution=attribution,
        milestone_type=ReferralEngagementMilestone.second_investment,
        product=product,
        amount_inr=amount_inr,
    )
    if created_second and second_event is not None:
        events.append(second_event)

    if (
        attribution.first_investment_product is not None
        and product != attribution.first_investment_product
    ):
        additional_event, created_additional = await _record_milestone(
            db,
            attribution=attribution,
            milestone_type=ReferralEngagementMilestone.additional_product,
            product=product,
            amount_inr=amount_inr,
        )
        if created_additional and additional_event is not None:
            events.append(additional_event)

    if events:
        attribution = await advance_referral_engaged(db, attribution=attribution)

    return ReferralEngagementResult(attribution=attribution, events=tuple(events))


async def record_referral_aum_milestone(
    db: AsyncSession,
    *,
    user: User,
    total_aum_inr: int,
) -> ReferralEngagementResult:
    settings = get_settings()
    if total_aum_inr < settings.referral_aum_milestone_inr:
        return ReferralEngagementResult(attribution=None, events=())

    attribution = await get_attribution_for_referee(db, referee_user_id=user.id)
    if attribution is None:
        return ReferralEngagementResult(attribution=None, events=())
    if not referral_stage_at_or_beyond(attribution.current_stage, ReferralStage.qualified):
        return ReferralEngagementResult(attribution=attribution, events=())

    event, created = await _record_milestone(
        db,
        attribution=attribution,
        milestone_type=ReferralEngagementMilestone.aum_milestone,
        total_aum_inr=total_aum_inr,
    )
    events = (event,) if created and event is not None else ()
    if events:
        attribution = await advance_referral_engaged(db, attribution=attribution)

    return ReferralEngagementResult(attribution=attribution, events=events)


__all__ = [
    "ReferralEngagementResult",
    "record_referral_aum_milestone",
    "record_referral_engagement_investment",
]
