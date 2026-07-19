from __future__ import annotations

import logging
from datetime import timedelta

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.investor.investor_provision_service import provision_investor_profile
from app.application.shared.datetime_utils import utcnow
from app.core.config import get_settings
from app.infrastructure.persistence.investor_models import (
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

    provisioned = skipped = 0
    for profile in profiles:
        changed = await provision_investor_profile(session, user_id=profile.user_id)
        if changed:
            provisioned += 1
        else:
            skipped += 1
    return {"processed": len(profiles), "provisioned": provisioned, "skipped": skipped}
