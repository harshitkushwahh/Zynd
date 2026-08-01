from __future__ import annotations

from calendar import monthrange
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.family_groups.display import require_group_member
from app.application.goals.constants import FAMILY_GOAL_METADATA_KEY
from app.application.goals.family_goal_service import count_active_family_goals
from app.infrastructure.persistence.family_group_models import (
    FamilyGroupMember,
    FamilyGroupMemberStatus,
)
from app.infrastructure.persistence.goal_models import Goal, GoalContribution, GoalContributionSourceType, GoalStatus
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


async def load_member_invested_totals(
    db: AsyncSession,
    *,
    user_ids: list[UUID],
) -> dict[UUID, Decimal]:
    if not user_ids:
        return {}

    holdings_rows = await db.execute(
        select(MfExternalHolding.user_id, func.coalesce(func.sum(MfExternalHolding.market_value_inr), 0))
        .where(
            MfExternalHolding.user_id.in_(user_ids),
            MfExternalHolding.market_value_inr.is_not(None),
        )
        .group_by(MfExternalHolding.user_id)
    )
    totals = {user_id: Decimal(str(total)) for user_id, total in holdings_rows.all()}

    missing_ids = [user_id for user_id in user_ids if totals.get(user_id, Decimal("0")) <= 0]
    if missing_ids:
        order_rows = await db.execute(
            select(MfOrder.user_id, func.coalesce(func.sum(MfOrder.amount_inr), 0))
            .where(
                MfOrder.user_id.in_(missing_ids),
                MfOrder.status == MfOrderStatus.succeeded,
            )
            .group_by(MfOrder.user_id)
        )
        for user_id, total in order_rows.all():
            amount = Decimal(str(total))
            if amount > 0:
                totals[user_id] = amount

    return totals


async def _build_family_group_portfolio_payload(
    db: AsyncSession,
    *,
    group_id: UUID,
) -> dict[str, Any]:
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

    goal_statuses = [GoalStatus.draft, GoalStatus.active, GoalStatus.paused, GoalStatus.achieved]
    goal_scope = (
        Goal.family_group_id == group_id,
        Goal.status.in_(goal_statuses),
    )

    goal_funded_result = await db.execute(
        select(func.coalesce(func.sum(Goal.current_amount_inr), 0)).where(*goal_scope)
    )
    goal_funded_inr = Decimal(str(goal_funded_result.scalar_one()))

    declared_result = await db.execute(
        select(func.coalesce(func.sum(Goal.existing_savings_inr), 0)).where(*goal_scope)
    )
    goal_declared_savings_inr = Decimal(str(declared_result.scalar_one()))

    contributions_result = await db.execute(
        select(func.coalesce(func.sum(GoalContribution.amount_inr), 0))
        .join(Goal, Goal.id == GoalContribution.goal_id)
        .where(*goal_scope)
    )
    goal_contributions_inr = Decimal(str(contributions_result.scalar_one()))

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
        "total_returns_inr": float(max(total_current_value - total_invested_inr, Decimal("0"))),
        "active_sips_count": active_sips_count,
        "active_goals_count": active_goals_count,
        "goal_funded_inr": float(goal_funded_inr),
        "goal_declared_savings_inr": float(goal_declared_savings_inr),
        "goal_contributions_inr": float(goal_contributions_inr),
        "has_holdings_data": has_holdings_data,
        "slices": slices,
    }


def _month_end(year: int, month: int) -> datetime:
    last_day = monthrange(year, month)[1]
    return datetime(year, month, last_day, 23, 59, 59, tzinfo=UTC)


def _month_key(year: int, month: int) -> str:
    return f"{year:04d}-{month:02d}"


def _iter_months(start: datetime, end: datetime) -> list[tuple[int, int]]:
    months: list[tuple[int, int]] = []
    cursor_year, cursor_month = start.year, start.month
    end_year, end_month = end.year, end.month
    while (cursor_year, cursor_month) <= (end_year, end_month):
        months.append((cursor_year, cursor_month))
        cursor_month += 1
        if cursor_month > 12:
            cursor_month = 1
            cursor_year += 1
    return months


async def load_family_group_progress_chart(
    db: AsyncSession,
    *,
    group_id: UUID,
    member_ids: list[UUID],
) -> list[dict[str, Any]]:
    now = datetime.now(tz=UTC)
    goal_rows = (
        await db.execute(
            select(Goal.created_at, Goal.existing_savings_inr).where(
                Goal.family_group_id == group_id,
                Goal.status != GoalStatus.archived,
            )
        )
    ).all()

    contribution_rows = (
        await db.execute(
            select(GoalContribution.contributed_at, GoalContribution.amount_inr)
            .join(Goal, Goal.id == GoalContribution.goal_id)
            .where(Goal.family_group_id == group_id, Goal.status != GoalStatus.archived)
            .order_by(GoalContribution.contributed_at.asc())
        )
    ).all()

    order_rows: list[tuple[datetime, Decimal]] = []
    if member_ids:
        order_rows = list(
            (
                await db.execute(
                    select(MfOrder.created_at, MfOrder.amount_inr).where(
                        MfOrder.user_id.in_(member_ids),
                        MfOrder.status == MfOrderStatus.succeeded,
                    )
                )
            ).all()
        )

    timeline: list[tuple[datetime, Decimal, Decimal]] = []
    for created_at, existing_savings in goal_rows:
        if created_at is None:
            continue
        amount = Decimal(str(existing_savings or 0))
        if amount > 0:
            timeline.append((created_at, amount, Decimal("0")))

    for contributed_at, amount_inr in contribution_rows:
        if contributed_at is None:
            continue
        amount = Decimal(str(amount_inr or 0))
        if amount > 0:
            timeline.append((contributed_at, amount, Decimal("0")))

    for created_at, amount_inr in order_rows:
        if created_at is None:
            continue
        amount = Decimal(str(amount_inr or 0))
        if amount > 0:
            timeline.append((created_at, Decimal("0"), amount))

    if not timeline:
        return []

    timeline.sort(key=lambda item: item[0])
    start = timeline[0][0]
    months = _iter_months(start, now)

    goal_running = Decimal("0")
    invested_running = Decimal("0")
    event_index = 0
    points: list[dict[str, Any]] = []

    for year, month in months:
        month_end = _month_end(year, month)
        while event_index < len(timeline) and timeline[event_index][0] <= month_end:
            _, goal_delta, invested_delta = timeline[event_index]
            goal_running += goal_delta
            invested_running += invested_delta
            event_index += 1

        points.append(
            {
                "period_key": _month_key(year, month),
                "year": year,
                "label": datetime(year, month, 1, tzinfo=UTC).strftime("%b"),
                "goal_progress_inr": float(goal_running),
                "invested_inr": float(invested_running),
            }
        )

    return points


async def load_family_group_sip_addons(
    db: AsyncSession,
    *,
    group_id: UUID,
    member_labels: dict[UUID, str],
) -> list[dict[str, Any]]:
    if not member_labels:
        return []

    goal_rows = await db.execute(
        select(Goal.id, Goal.title).where(
            Goal.family_group_id == group_id,
            Goal.status != GoalStatus.archived,
        )
    )
    goal_titles = {str(goal_id): title for goal_id, title in goal_rows.all()}

    plans = (
        await db.execute(
            select(MfSipPlan).where(
                MfSipPlan.user_id.in_(list(member_labels.keys())),
                MfSipPlan.status == MfSipPlanStatus.active,
            )
        )
    ).scalars()

    addons: list[dict[str, Any]] = []
    for plan in plans:
        metadata = plan.metadata_ if isinstance(plan.metadata_, dict) else {}
        raw_goal_id = metadata.get(FAMILY_GOAL_METADATA_KEY)
        goal_title = goal_titles.get(str(raw_goal_id)) if raw_goal_id else None
        addons.append(
            {
                "plan_id": plan.id,
                "user_id": plan.user_id,
                "member_label": member_labels.get(plan.user_id, "Member"),
                "goal_title": goal_title,
                "amount_inr": float(plan.amount_inr),
                "frequency": plan.frequency,
                "is_goal_linked": bool(goal_title),
            }
        )

    addons.sort(key=lambda item: (-item["amount_inr"], item["member_label"]))
    return addons


async def load_family_group_mf_holdings(
    db: AsyncSession,
    *,
    member_labels: dict[UUID, str],
) -> list[dict[str, Any]]:
    if not member_labels:
        return []

    rows = (
        await db.execute(
            select(MfExternalHolding, MutualFund.scheme_name)
            .outerjoin(MutualFund, MutualFund.id == MfExternalHolding.matched_fund_id)
            .where(MfExternalHolding.user_id.in_(list(member_labels.keys())))
            .order_by(
                MfExternalHolding.market_value_inr.desc().nullslast(),
                MfExternalHolding.scheme_name.asc(),
            )
        )
    ).all()

    holdings: list[dict[str, Any]] = []
    for holding, matched_name in rows:
        display_name = member_labels.get(holding.user_id, "Member")
        holdings.append(
            {
                "holding_id": holding.id,
                "user_id": holding.user_id,
                "member_label": display_name.split(" ")[0] if display_name else "Member",
                "member_display_name": display_name,
                "scheme_name": holding.scheme_name,
                "matched_scheme_name": matched_name,
                "folio_number": holding.folio_number,
                "isin": holding.isin,
                "units": float(holding.units),
                "nav_value": float(holding.nav_value) if holding.nav_value is not None else None,
                "market_value_inr": float(holding.market_value_inr)
                if holding.market_value_inr is not None
                else None,
                "as_of_date": holding.as_of_date.isoformat() if holding.as_of_date else None,
                "amc_name": holding.amc_name,
                "source": holding.source,
            }
        )

    return holdings


async def load_family_group_one_time_payments(
    db: AsyncSession,
    *,
    group_id: UUID,
    member_labels: dict[UUID, str],
) -> list[dict[str, Any]]:
    if not member_labels:
        return []

    rows = (
        await db.execute(
            select(GoalContribution, Goal.title)
            .join(Goal, Goal.id == GoalContribution.goal_id)
            .where(
                Goal.family_group_id == group_id,
                Goal.status != GoalStatus.archived,
                GoalContribution.source_type != GoalContributionSourceType.sip_plan,
            )
            .order_by(GoalContribution.contributed_at.desc(), GoalContribution.id.desc())
        )
    ).all()

    payments: list[dict[str, Any]] = []
    for contribution, goal_title in rows:
        display_name = member_labels.get(contribution.user_id, "Member")
        payments.append(
            {
                "contribution_id": contribution.id,
                "user_id": contribution.user_id,
                "member_label": display_name.split(" ")[0] if display_name else "Member",
                "member_display_name": display_name,
                "goal_title": goal_title,
                "amount_inr": float(contribution.amount_inr),
                "source_type": contribution.source_type.value,
                "contributed_at": contribution.contributed_at.isoformat()
                if contribution.contributed_at
                else None,
            }
        )

    return payments


async def get_family_group_portfolio(
    db: AsyncSession,
    *,
    group_id: UUID,
    user_id: UUID,
) -> dict[str, Any]:
    await require_group_member(db, group_id=group_id, user_id=user_id)
    return await _build_family_group_portfolio_payload(db, group_id=group_id)


async def get_family_group_portfolio_for_admin(
    db: AsyncSession,
    *,
    group_id: UUID,
) -> dict[str, Any]:
    return await _build_family_group_portfolio_payload(db, group_id=group_id)
