from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.investor_models import (
    InvestorProfile,
    InvestorProfileStatus,
    InvestorProvisionTrigger,
)


async def get_investor_profile(db: AsyncSession, user_id: UUID) -> InvestorProfile | None:
    result = await db.execute(select(InvestorProfile).where(InvestorProfile.user_id == user_id))
    return result.scalar_one_or_none()


async def get_or_create_pending_investor_profile(
    db: AsyncSession,
    *,
    user_id: UUID,
    provision_trigger: InvestorProvisionTrigger | None = None,
) -> InvestorProfile:
    profile = await get_investor_profile(db, user_id)
    if profile:
        if provision_trigger and profile.provision_trigger is None:
            profile.provision_trigger = provision_trigger
        return profile

    profile = InvestorProfile(
        user_id=user_id,
        status=InvestorProfileStatus.pending,
        provision_trigger=provision_trigger,
    )
    db.add(profile)
    await db.flush()
    return profile
