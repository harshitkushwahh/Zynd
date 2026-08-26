from __future__ import annotations

import logging
from datetime import timedelta

from sqlalchemy import and_, exists, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.investor.investor_provision_service import (
    profile_has_unsynced_fp_children,
    provision_investor_profile,
    sync_unsynced_investor_children,
)
from app.application.shared.datetime_utils import utcnow
from app.core.config import get_settings
from app.infrastructure.persistence.investor_models import (
    InvestorEmailAddress,
    InvestorObjectSyncStatus,
    InvestorPhoneNumber,
    InvestorProfile,
    InvestorProfileStatus,
    InvestorProvisionTrigger,
)

logger = logging.getLogger(__name__)

_PROVISION_TRIGGERS = (
    InvestorProvisionTrigger.payment,
    InvestorProvisionTrigger.mf_order,
    InvestorProvisionTrigger.mf_sip,
)


async def process_pending_investor_provisions(session: AsyncSession, *, batch_size: int = 10) -> dict[str, int]:
    settings = get_settings()
    if not settings.zynd_investor_provision_enabled or not settings.resolved_fp_enabled:
        return {"processed": 0, "provisioned": 0, "skipped": 0, "reason": "provision_disabled"}

    stale_cutoff = utcnow() - timedelta(minutes=15)
    profiles = list(
        (
            await session.execute(
                select(InvestorProfile)
                .where(
                    InvestorProfile.provision_trigger.in_(_PROVISION_TRIGGERS),
                    or_(
                        InvestorProfile.status.in_(
                            [InvestorProfileStatus.pending, InvestorProfileStatus.failed]
                        ),
                        and_(
                            InvestorProfile.status == InvestorProfileStatus.provisioning,
                            InvestorProfile.updated_at < stale_cutoff,
                        ),
                    ),
                )
                .order_by(InvestorProfile.updated_at)
                .limit(batch_size)
            )
        ).scalars()
    )

    child_unsynced = exists(
        select(InvestorEmailAddress.id).where(
            InvestorEmailAddress.investor_profile_id == InvestorProfile.user_id,
            InvestorEmailAddress.sync_status != InvestorObjectSyncStatus.active,
        )
    )
    phone_unsynced = exists(
        select(InvestorPhoneNumber.id).where(
            InvestorPhoneNumber.investor_profile_id == InvestorProfile.user_id,
            InvestorPhoneNumber.sync_status != InvestorObjectSyncStatus.active,
        )
    )
    active_with_unsynced_children = list(
        (
            await session.execute(
                select(InvestorProfile)
                .where(
                    InvestorProfile.status == InvestorProfileStatus.active,
                    InvestorProfile.external_profile_id.is_not(None),
                    or_(child_unsynced, phone_unsynced),
                )
                .options(
                    selectinload(InvestorProfile.email_addresses),
                    selectinload(InvestorProfile.phone_numbers),
                    selectinload(InvestorProfile.addresses),
                    selectinload(InvestorProfile.bank_accounts),
                )
                .order_by(InvestorProfile.updated_at)
                .limit(batch_size)
            )
        ).scalars()
    )

    provisioned = skipped = synced = 0
    seen_user_ids = {profile.user_id for profile in profiles}
    for profile in profiles:
        changed = await provision_investor_profile(session, user_id=profile.user_id)
        if changed:
            provisioned += 1
        else:
            skipped += 1

    for profile in active_with_unsynced_children:
        if profile.user_id in seen_user_ids:
            continue
        if not profile_has_unsynced_fp_children(profile):
            continue
        if await sync_unsynced_investor_children(session, user_id=profile.user_id):
            synced += 1
        else:
            skipped += 1

    return {
        "processed": len(profiles) + len(active_with_unsynced_children),
        "provisioned": provisioned,
        "synced": synced,
        "skipped": skipped,
    }
