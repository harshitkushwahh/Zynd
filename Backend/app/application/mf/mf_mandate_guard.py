"""Mandate checks that gate payout-bank changes without importing investor services."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.mf_transaction_models import (
    MfMandate,
    MfMandateStatus,
    MfSipPlan,
    MfSipPlanStatus,
)

MANDATE_IN_FLIGHT_STATUSES = frozenset(
    {
        MfMandateStatus.pending,
        MfMandateStatus.auth_pending,
    }
)

SIP_MANDATE_BLOCKING_STATUSES = frozenset(
    {
        MfSipPlanStatus.active,
        MfSipPlanStatus.pending,
        MfSipPlanStatus.review,
        MfSipPlanStatus.consent_pending,
    }
)


async def find_blocking_mandate_for_bank(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    bank_account_old_id: int,
) -> MfMandate | None:
    """Return a mandate that still blocks payout-bank changes on the given account."""
    mandates = list(
        (
            await session.execute(
                select(MfMandate).where(
                    MfMandate.user_id == user_id,
                    MfMandate.bank_account_old_id == bank_account_old_id,
                    MfMandate.status.in_(
                        [
                            *MANDATE_IN_FLIGHT_STATUSES,
                            MfMandateStatus.approved,
                        ]
                    ),
                )
            )
        ).scalars()
    )
    for mandate in mandates:
        if mandate.status in MANDATE_IN_FLIGHT_STATUSES:
            return mandate
        if mandate.status == MfMandateStatus.approved:
            has_blocking_sip = await session.scalar(
                select(MfSipPlan.id)
                .where(
                    MfSipPlan.mf_mandate_id == mandate.id,
                    MfSipPlan.status.in_(SIP_MANDATE_BLOCKING_STATUSES),
                )
                .limit(1)
            )
            if has_blocking_sip:
                return mandate
    return None


async def count_active_sips_for_bank(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    bank_account_old_id: int,
) -> int:
    """Count SIP plans in blocking statuses linked to approved mandates on this bank."""
    count = await session.scalar(
        select(func.count(MfSipPlan.id))
        .select_from(MfSipPlan)
        .join(MfMandate, MfSipPlan.mf_mandate_id == MfMandate.id)
        .where(
            MfMandate.user_id == user_id,
            MfMandate.bank_account_old_id == bank_account_old_id,
            MfMandate.status == MfMandateStatus.approved,
            MfSipPlan.status.in_(SIP_MANDATE_BLOCKING_STATUSES),
        )
    )
    return int(count or 0)


async def has_in_flight_mandate_for_bank(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    bank_account_old_id: int,
) -> bool:
    """Return True when a pending or auth-pending mandate exists on this bank."""
    mandate_id = await session.scalar(
        select(MfMandate.id)
        .where(
            MfMandate.user_id == user_id,
            MfMandate.bank_account_old_id == bank_account_old_id,
            MfMandate.status.in_(MANDATE_IN_FLIGHT_STATUSES),
        )
        .limit(1)
    )
    return mandate_id is not None
