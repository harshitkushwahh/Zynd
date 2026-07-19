"""Hooks run when KYC reaches completed status."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.investor.investor_bank_account_service import (
    sync_bank_account_from_kyc_journey,
)
from app.application.investor.investor_profile_seed_service import seed_investor_drafts_from_kyc
from app.application.kyc.kyc_notification_service import notify_kyc_completed
from app.application.kyc.user_name_sync_service import sync_user_name_from_verified_kyc
from app.application.referral.referral_attribution_service import advance_referral_kyc_verified
from app.infrastructure.persistence.models import KycJourneyState, User


async def on_kyc_completed(
    db: AsyncSession,
    *,
    user: User,
    journey: KycJourneyState,
) -> dict[str, bool]:
    name_updated = await sync_user_name_from_verified_kyc(db, user=user, journey=journey)
    await seed_investor_drafts_from_kyc(db, user=user, journey=journey)
    await sync_bank_account_from_kyc_journey(db, user_id=user.id, journey=journey)
    referral = await advance_referral_kyc_verified(db, referee=user)
    notify_kyc_completed(user=user)
    return {
        "nameUpdated": name_updated,
        "referralKycVerified": referral is not None and referral.kyc_verified_at is not None,
    }


__all__ = ["on_kyc_completed"]
