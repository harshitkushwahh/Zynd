"""Referral first-investment hook — call from MF/FD/payment settlement services."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.referral.referral_attribution_service import advance_referral_first_investment
from app.application.referral.referral_engagement_service import record_referral_engagement_investment
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.referral_models import ReferralAttribution, ReferralInvestmentProduct


async def record_referral_first_investment(
    db: AsyncSession,
    *,
    user: User,
    product: ReferralInvestmentProduct,
    amount_inr: int,
) -> ReferralAttribution | None:
    """Advance a referred user to stage 3 when their first investment clears."""
    return await advance_referral_first_investment(
        db,
        referee=user,
        product=product,
        amount_inr=amount_inr,
    )


async def record_referral_first_investment_reversal(
    db: AsyncSession,
    *,
    user: User,
) -> ReferralAttribution | None:
    """Mark a referred user's first investment as fully reversed before qualification."""
    from app.application.referral.referral_attribution_service import mark_first_investment_reversed

    return await mark_first_investment_reversed(db, referee_user_id=user.id)


async def record_referral_investment_activity(
    db: AsyncSession,
    *,
    user: User,
    product: ReferralInvestmentProduct,
    amount_inr: int,
) -> None:
    """Record first investment and, when eligible, post-qualification engagement."""
    await record_referral_first_investment(
        db,
        user=user,
        product=product,
        amount_inr=amount_inr,
    )
    await record_referral_engagement_investment(
        db,
        user=user,
        product=product,
        amount_inr=amount_inr,
    )


__all__ = [
    "record_referral_first_investment",
    "record_referral_first_investment_reversal",
    "record_referral_investment_activity",
]
