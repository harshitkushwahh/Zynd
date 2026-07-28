from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.family_groups.display import require_group_member
from app.application.goals.family_goal_service import count_active_family_goals
from app.application.goals.constants import FAMILY_GOAL_METADATA_KEY
from app.infrastructure.persistence.family_group_models import (
    FamilyGroupMember,
    FamilyGroupMemberStatus,
)
from app.infrastructure.persistence.goal_models import Goal, GoalContribution, GoalStatus
from app.infrastructure.persistence.mf_models import MutualFund
from app.infrastructure.persistence.mf_transaction_models import (
    MfExternalHolding,
    MfOrder,
    MfOrderStatus,
    MfSipPlan,
    MfSipPlanStatus,
)

PORTFOLIO_SLICE_LABELS = {
    "equity": "Equity Funds",
    "debt": "Debt Funds",
    "hybrid": "Hybrid Funds",
    "other": "Others",
}


def _portfolio_slice_for_sebi(sebi_category: str | None) -> str:
    if not sebi_category:
        return "other"
    lowered = sebi_category.lower()
    if any(token in lowered for token in ("debt", "liquid", "bond", "gilt", "overnight")):
        return "debt"
    if any(token in lowered for token in ("hybrid", "balanced", "multi asset", "solution oriented")):
        return "hybrid"
    if any(token in lowered for token in ("equity", "elss", "index")):
        return "equity"
    return "other"


async def _active_member_user_ids(db: AsyncSession, *, group_id: UUID) -> list[UUID]:
    rows = await db.execute(
        select(FamilyGroupMember.user_id).where(
            FamilyGroupMember.group_id == group_id,
            FamilyGroupMember.status == FamilyGroupMemberStatus.active,
        )
    )
    return list(rows.scalars())


async def load_member_goal_contribution_totals(
    db: AsyncSession,
    *,
    group_id: UUID,
    user_ids: list[UUID],
) -> dict[UUID, Decimal]:
    if not user_ids:
        return {}
    rows = await db.execute(
        select(GoalContribution.user_id, func.coalesce(func.sum(GoalContribution.amount_inr), 0))
        .join(Goal, Goal.id == GoalContribution.goal_id)
        .where(
            Goal.family_group_id == group_id,
            GoalContribution.user_id.in_(user_ids),
        )
        .group_by(GoalContribution.user_id)
    )
    return {user_id: Decimal(str(total)) for user_id, total in rows.all()}


async def load_member_linked_sip_counts(
    db: AsyncSession,
    *,
    group_id: UUID,
    user_ids: list[UUID],
) -> dict[UUID, int]:
    if not user_ids:
        return {}

    goal_rows = await db.execute(select(Goal.id).where(Goal.family_group_id == group_id))
    goal_ids = {str(goal_id) for goal_id in goal_rows.scalars()}
    if not goal_ids:
        return {user_id: 0 for user_id in user_ids}

    plans = (
        await db.execute(
            select(MfSipPlan).where(
                MfSipPlan.user_id.in_(user_ids),
                MfSipPlan.status == MfSipPlanStatus.active,
            )
        )
    ).scalars()

    counts = {user_id: 0 for user_id in user_ids}
    for plan in plans:
        metadata = plan.metadata_ if isinstance(plan.metadata_, dict) else {}
        raw_goal_id = metadata.get(FAMILY_GOAL_METADATA_KEY)
        if raw_goal_id in goal_ids:
            counts[plan.user_id] = counts.get(plan.user_id, 0) + 1
    return counts


async def get_family_group_portfolio(
    db: AsyncSession,
    *,
    group_id: UUID,
    user_id: UUID,
) -> dict[str, Any]:
    await require_group_member(db, group_id=group_id, user_id=user_id)
    member_ids = await _active_member_user_ids(db, group_id=group_id)

    total_current_value = Decimal("0")
    slice_totals: dict[str, Decimal] = {key: Decimal("0") for key in PORTFOLIO_SLICE_LABELS}
    has_holdings_data = False

    if member_ids:
        holdings_rows = (
            await db.execute(
                select(MfExternalHolding.market_value_inr, MutualFund.sebi_category)
                .outerjoin(MutualFund, MutualFund.id == MfExternalHolding.matched_fund_id)
                .where(
                    MfExternalHolding.user_id.in_(member_ids),
                    MfExternalHolding.market_value_inr.is_not(None),
                )
            )
        ).all()
        for market_value, sebi_category in holdings_rows:
            amount = Decimal(str(market_value))
            has_holdings_data = True
            total_current_value += amount
            slice_key = _portfolio_slice_for_sebi(sebi_category)
            slice_totals[slice_key] = slice_totals.get(slice_key, Decimal("0")) + amount

        if not has_holdings_data:
            invested_rows = await db.execute(
                select(func.coalesce(func.sum(MfOrder.amount_inr), 0)).where(
                    MfOrder.user_id.in_(member_ids),
                    MfOrder.status == MfOrderStatus.succeeded,
                )
            )
            total_invested_fallback = Decimal(str(invested_rows.scalar_one()))
            total_current_value = total_invested_fallback
            if total_invested_fallback > 0:
                slice_totals["equity"] = total_invested_fallback

    invested_result = await db.execute(
        select(func.coalesce(func.sum(MfOrder.amount_inr), 0)).where(
            MfOrder.user_id.in_(member_ids),
            MfOrder.status == MfOrderStatus.succeeded,
        )
    ) if member_ids else None
    total_invested_inr = Decimal(str(invested_result.scalar_one())) if invested_result else Decimal("0")

    sip_result = await db.execute(
        select(func.count())
        .select_from(MfSipPlan)
        .where(
            MfSipPlan.user_id.in_(member_ids),
            MfSipPlan.status == MfSipPlanStatus.active,
        )
    ) if member_ids else None
    active_sips_count = int(sip_result.scalar_one()) if sip_result else 0

    goal_funded_result = await db.execute(
        select(func.coalesce(func.sum(Goal.current_amount_inr), 0)).where(
            Goal.family_group_id == group_id,
            Goal.status.in_([GoalStatus.draft, GoalStatus.active, GoalStatus.paused, GoalStatus.achieved]),
        )
    )
    goal_funded_inr = Decimal(str(goal_funded_result.scalar_one()))
    active_goals_count = await count_active_family_goals(db, group_id=group_id)

    slice_base = total_current_value if total_current_value > 0 else Decimal("0")
    slices: list[dict[str, Any]] = []
    for slice_id, label in PORTFOLIO_SLICE_LABELS.items():
        amount = slice_totals.get(slice_id, Decimal("0"))
        if slice_base <= 0 or amount <= 0:
            continue
        value_pct = float((amount / slice_base * Decimal("100")).quantize(Decimal("0.01")))
        slices.append(
            {
                "id": slice_id,
                "label": label,
                "amount_inr": float(amount),
                "value_pct": value_pct,
            }
        )

    return {
        "total_current_value_inr": float(total_current_value),
        "total_invested_inr": float(total_invested_inr),
        "active_sips_count": active_sips_count,
        "active_goals_count": active_goals_count,
        "goal_funded_inr": float(goal_funded_inr),
        "has_holdings_data": has_holdings_data,
        "slices": slices,
    }
