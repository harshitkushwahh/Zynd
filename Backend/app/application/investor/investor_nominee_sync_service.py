"""Keep KYC nominee drafts local until KYC is verified."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.investor.investor_nominee_mapper import upsert_nominee_drafts_to_local
from app.infrastructure.persistence.investor_models import InvestorProfile
from app.infrastructure.persistence.models import KycJourneyState, User
from app.infrastructure.persistence.repositories.investor_profile_repository import get_investor_profile


async def sync_nominees_from_kyc_draft(
    db: AsyncSession,
    *,
    user: User,
    journey: KycJourneyState,
) -> InvestorProfile | None:
    """Copy nominee drafts onto a local investor profile if one already exists.

    Finprim related-party create/patch happens only after KYC is verified.
    """
    profile = await get_investor_profile(db, user.id)
    if not profile:
        return None
    await upsert_nominee_drafts_to_local(db, profile=profile, journey=journey)
    await db.flush()
    return profile


__all__ = ["sync_nominees_from_kyc_draft"]
