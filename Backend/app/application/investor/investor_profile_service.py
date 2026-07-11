"""Investor profile provisioning — Cybrilla v2 sync (future MF/payment entry point)."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.investor_models import (
    InvestorProfile,
    InvestorProfileStatus,
    InvestorProvisionTrigger,
)
from app.infrastructure.persistence.repositories.investor_profile_repository import (
    get_investor_profile,
    get_or_create_pending_investor_profile,
)


async def ensure_investor_profile_on_kyc_complete(
    db: AsyncSession,
    *,
    user_id: UUID,
) -> InvestorProfile:
    """Ensure pending investor profile exists after KYC completion (draft rows seeded separately)."""
    return await get_or_create_pending_investor_profile(
        db,
        user_id=user_id,
        provision_trigger=InvestorProvisionTrigger.manual,
    )


async def ensure_pending_investor_profile_for_payment(
    db: AsyncSession,
    *,
    user_id: UUID,
) -> InvestorProfile:
    """Called when user initiates first payment/MF flow (integration point for later).

    Creates a local pending profile row. Cybrilla `invp_*` creation happens in a
    future `provision_investor_profile` job once payment/MF modules call this.
    """
    return await get_or_create_pending_investor_profile(
        db,
        user_id=user_id,
        provision_trigger=InvestorProvisionTrigger.payment,
    )


async def mark_investor_profile_provisioning(
    db: AsyncSession,
    profile: InvestorProfile,
) -> InvestorProfile:
    profile.status = InvestorProfileStatus.provisioning
    await db.flush()
    return profile


async def mark_investor_profile_active(
    db: AsyncSession,
    profile: InvestorProfile,
    *,
    external_profile_id: str,
    external_old_id: int | None = None,
) -> InvestorProfile:
    profile.external_profile_id = external_profile_id
    profile.external_old_id = external_old_id
    profile.status = InvestorProfileStatus.active
    profile.failure_code = None
    profile.failure_reason = None
    from app.application.shared.datetime_utils import utcnow

    profile.provisioned_at = utcnow()
    await db.flush()
    return profile


async def mark_investor_profile_failed(
    db: AsyncSession,
    profile: InvestorProfile,
    *,
    failure_code: str,
    failure_reason: str,
) -> InvestorProfile:
    profile.status = InvestorProfileStatus.failed
    profile.failure_code = failure_code
    profile.failure_reason = failure_reason
    await db.flush()
    return profile


__all__ = [
    "ensure_investor_profile_on_kyc_complete",
    "ensure_pending_investor_profile_for_payment",
    "get_investor_profile",
    "mark_investor_profile_active",
    "mark_investor_profile_failed",
    "mark_investor_profile_provisioning",
]
