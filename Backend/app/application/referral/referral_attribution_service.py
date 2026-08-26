from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.referral.referral_code_service import resolve_active_referral_code
from app.application.referral.referral_notification_service import (
    notify_referrer_first_investment,
    notify_referrer_kyc_verified,
    notify_referrer_qualified,
    notify_referrer_signup,
)
from app.application.shared.datetime_utils import utcnow
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.referral_models import (
    REFERRAL_STAGE_ORDER,
    ReferralAttribution,
    ReferralInvestmentMode,
    ReferralInvestmentProduct,
    ReferralSignupChannel,
    ReferralStage,
)


def referral_stage_at_or_beyond(stage: ReferralStage, minimum: ReferralStage) -> bool:
    return REFERRAL_STAGE_ORDER.index(stage) >= REFERRAL_STAGE_ORDER.index(minimum)


def _stages_at_or_beyond(minimum: ReferralStage) -> tuple[ReferralStage, ...]:
    index = REFERRAL_STAGE_ORDER.index(minimum)
    return REFERRAL_STAGE_ORDER[index:]


def mask_referee_email(email: str) -> str:
    local, separator, domain = email.partition("@")
    if not separator or not domain:
        return "***"
    if len(local) <= 1:
        masked_local = f"{local}***" if local else "*"
    else:
        masked_local = f"{local[0]}***"
    return f"{masked_local}@{domain}"


async def get_attribution_for_referee(
    db: AsyncSession,
    *,
    referee_user_id: UUID,
) -> ReferralAttribution | None:
    result = await db.execute(
        select(ReferralAttribution).where(ReferralAttribution.referee_user_id == referee_user_id)
    )
    return result.scalar_one_or_none()


async def count_signups_for_referrer(
    db: AsyncSession,
    *,
    referrer_user_id: UUID,
) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(ReferralAttribution)
        .where(ReferralAttribution.referrer_user_id == referrer_user_id)
    )
    return int(result.scalar_one())


async def count_kyc_verified_for_referrer(
    db: AsyncSession,
    *,
    referrer_user_id: UUID,
) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(ReferralAttribution)
        .where(
            ReferralAttribution.referrer_user_id == referrer_user_id,
            ReferralAttribution.current_stage.in_(_stages_at_or_beyond(ReferralStage.kyc_verified)),
        )
    )
    return int(result.scalar_one())


async def count_first_investment_for_referrer(
    db: AsyncSession,
    *,
    referrer_user_id: UUID,
) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(ReferralAttribution)
        .where(
            ReferralAttribution.referrer_user_id == referrer_user_id,
            ReferralAttribution.current_stage.in_(
                _stages_at_or_beyond(ReferralStage.first_investment)
            ),
        )
    )
    return int(result.scalar_one())


async def count_qualified_for_referrer(
    db: AsyncSession,
    *,
    referrer_user_id: UUID,
) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(ReferralAttribution)
        .where(
            ReferralAttribution.referrer_user_id == referrer_user_id,
            ReferralAttribution.current_stage.in_(_stages_at_or_beyond(ReferralStage.qualified)),
        )
    )
    return int(result.scalar_one())


async def count_engaged_for_referrer(
    db: AsyncSession,
    *,
    referrer_user_id: UUID,
) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(ReferralAttribution)
        .where(
            ReferralAttribution.referrer_user_id == referrer_user_id,
            ReferralAttribution.current_stage.in_(_stages_at_or_beyond(ReferralStage.engaged)),
        )
    )
    return int(result.scalar_one())


async def list_referrals_for_referrer(
    db: AsyncSession,
    *,
    referrer_user_id: UUID,
    limit: int = 50,
) -> list[tuple[ReferralAttribution, User]]:
    result = await db.execute(
        select(ReferralAttribution, User)
        .join(User, User.id == ReferralAttribution.referee_user_id)
        .where(ReferralAttribution.referrer_user_id == referrer_user_id)
        .order_by(ReferralAttribution.signed_up_at.desc())
        .limit(limit)
    )
    return list(result.all())


async def attribute_referral_signup(
    db: AsyncSession,
    *,
    referee: User,
    referral_code: str | None,
    channel: ReferralSignupChannel,
) -> ReferralAttribution | None:
    if not referral_code:
        return None

    code_row = await resolve_active_referral_code(db, code=referral_code)
    if code_row is None:
        return None

    if code_row.user_id == referee.id:
        return None

    existing = await get_attribution_for_referee(db, referee_user_id=referee.id)
    if existing is not None:
        return None

    attribution = ReferralAttribution(
        referrer_user_id=code_row.user_id,
        referee_user_id=referee.id,
        referral_code=code_row.code,
        signup_channel=channel,
        current_stage=ReferralStage.signed_up,
    )
    db.add(attribution)
    await db.flush()

    referrer = await db.get(User, code_row.user_id)
    if referrer:
        await notify_referrer_signup(
            db,
            referrer=referrer,
            referee=referee,
            attribution=attribution,
        )
    return attribution


async def advance_referral_kyc_verified(
    db: AsyncSession,
    *,
    referee: User,
) -> ReferralAttribution | None:
    attribution = await get_attribution_for_referee(db, referee_user_id=referee.id)
    if attribution is None:
        return None
    if attribution.current_stage == ReferralStage.kyc_verified:
        return attribution
    if attribution.current_stage != ReferralStage.signed_up:
        return attribution

    attribution.current_stage = ReferralStage.kyc_verified
    attribution.kyc_verified_at = utcnow()
    await db.flush()

    referrer = await db.get(User, attribution.referrer_user_id)
    if referrer:
        await notify_referrer_kyc_verified(
            db,
            referrer=referrer,
            referee=referee,
            attribution=attribution,
        )
    return attribution


async def advance_referral_first_investment(
    db: AsyncSession,
    *,
    referee: User,
    product: ReferralInvestmentProduct,
    amount_inr: int,
    investment_mode: ReferralInvestmentMode = ReferralInvestmentMode.other,
) -> ReferralAttribution | None:
    from app.application.referral.referral_program_service import get_referral_program_settings

    program_settings = await get_referral_program_settings(db)
    if amount_inr < program_settings.min_first_investment_inr:
        return None

    attribution = await get_attribution_for_referee(db, referee_user_id=referee.id)
    if attribution is None:
        return None
    if referral_stage_at_or_beyond(attribution.current_stage, ReferralStage.first_investment):
        return attribution
    if attribution.current_stage != ReferralStage.kyc_verified:
        return None

    attribution.current_stage = ReferralStage.first_investment
    attribution.first_investment_at = utcnow()
    attribution.first_investment_product = product
    attribution.first_investment_amount_inr = amount_inr
    attribution.first_investment_mode = investment_mode
    await db.flush()

    referrer = await db.get(User, attribution.referrer_user_id)
    if referrer:
        await notify_referrer_first_investment(
            db,
            referrer=referrer,
            referee=referee,
            attribution=attribution,
            product=product,
            amount_inr=amount_inr,
        )
    return attribution


async def advance_referral_qualified(
    db: AsyncSession,
    *,
    referee_user_id: UUID,
    now: datetime | None = None,
) -> ReferralAttribution | None:
    from app.application.referral.referral_program_service import (
        get_referral_program_settings,
        qualification_due_at_for_attribution,
    )

    now = now or utcnow()

    attribution = await get_attribution_for_referee(db, referee_user_id=referee_user_id)
    if attribution is None:
        return None
    if referral_stage_at_or_beyond(attribution.current_stage, ReferralStage.qualified):
        return attribution
    if attribution.current_stage != ReferralStage.first_investment:
        return None
    if attribution.first_investment_reversed_at is not None:
        return None
    if attribution.first_investment_at is None:
        return None

    program_settings = await get_referral_program_settings(db)
    hold_deadline = qualification_due_at_for_attribution(attribution, program_settings)
    if hold_deadline is None or now < hold_deadline:
        return None

    attribution.current_stage = ReferralStage.qualified
    attribution.qualified_at = now
    await db.flush()

    referee = await db.get(User, referee_user_id)
    referrer = await db.get(User, attribution.referrer_user_id)
    if referee and referrer:
        await notify_referrer_qualified(
            db,
            referrer=referrer,
            referee=referee,
            attribution=attribution,
        )
        from app.application.referral.referral_reward_service import accrue_referral_reward_for_attribution

        await accrue_referral_reward_for_attribution(db, attribution=attribution, earned_at=now)
    return attribution


async def mark_first_investment_reversed(
    db: AsyncSession,
    *,
    referee_user_id: UUID,
    reversed_at: datetime | None = None,
) -> ReferralAttribution | None:
    attribution = await get_attribution_for_referee(db, referee_user_id=referee_user_id)
    if attribution is None:
        return None
    if referral_stage_at_or_beyond(attribution.current_stage, ReferralStage.qualified):
        return attribution
    if attribution.current_stage != ReferralStage.first_investment:
        return None
    if attribution.first_investment_reversed_at is not None:
        return attribution

    attribution.first_investment_reversed_at = reversed_at or utcnow()
    await db.flush()
    return attribution
