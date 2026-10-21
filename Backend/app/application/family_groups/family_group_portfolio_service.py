from __future__ import annotations

from calendar import monthrange
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.family_groups.display import require_group_member
from app.application.family_groups.family_holding_link_service import (
    active_links_for_group,
    collect_group_linked_holdings,
    family_goal_funding_parts,
)
from app.application.goals.constants import FAMILY_GOAL_METADATA_KEY, FAMILY_GROUP_METADATA_KEY
from app.application.goals.family_goal_service import count_active_family_goals
from app.infrastructure.persistence.family_group_models import (
    FamilyGroupMember,
    FamilyGroupMemberStatus,
)
from app.infrastructure.persistence.goal_models import Goal, GoalContribution, GoalContributionSourceType, GoalStatus
from app.infrastructure.persistence.mf_models import MutualFund
from app.infrastructure.persistence.mf_transaction_models import (
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
    """Manual cash plus live value of holdings assigned to a goal in this group."""
    if not user_ids:
        return {}
    totals = {user_id: Decimal("0") for user_id in user_ids}
    rows = await db.execute(
        select(GoalContribution.user_id, func.coalesce(func.sum(GoalContribution.amount_inr), 0))
        .join(Goal, Goal.id == GoalContribution.goal_id)
        .where(
            Goal.family_group_id == group_id,
            GoalContribution.user_id.in_(user_ids),
            GoalContribution.source_type == GoalContributionSourceType.manual,
        )
        .group_by(GoalContribution.user_id)
    )
    for user_id, total in rows.all():
        totals[user_id] = Decimal(str(total))

    for row in await collect_group_linked_holdings(db, group_id=group_id, member_ids=user_ids):
        if not row.get("goal_id"):
            continue
        owner_id = row["user_id"]
        if owner_id not in totals:
            continue
        totals[owner_id] += Decimal(str(row.get("current_value_inr") or 0))
    return {user_id: amount for user_id, amount in totals.items() if amount > 0}


def _plan_metadata(plan: MfSipPlan) -> dict[str, Any]:
    return plan.metadata_ if isinstance(plan.metadata_, dict) else {}


async def _isins_by_fund_id(db: AsyncSession, fund_ids: set[int]) -> dict[int, set[str]]:
    if not fund_ids:
        return {}
    rows = await db.execute(
        select(MutualFund.id, MutualFund.isin_growth, MutualFund.isin_div_reinvestment).where(
            MutualFund.id.in_(fund_ids)
        )
    )
    mapped: dict[int, set[str]] = {}
    for fund_id, growth, dividend in rows.all():
        isins = {
            text
            for text in (str(growth or "").upper(), str(dividend or "").upper())
            if text.startswith("INF")
        }
        if isins:
            mapped[fund_id] = isins
    return mapped


def _plan_isins(plan: MfSipPlan, isins_by_fund: dict[int, set[str]]) -> set[str]:
    metadata = _plan_metadata(plan)
    isins = set(isins_by_fund.get(plan.fund_id or 0, set()))
    meta_isin = str(metadata.get("isin") or "").strip().upper()
    if meta_isin.startswith("INF"):
        isins.add(meta_isin)
    return isins


def _plan_counts_for_group(
    plan: MfSipPlan,
    *,
    group_id: UUID,
    goal_ids: set[str],
    linked_keys: set[tuple[UUID, str, str]],
    isins_by_fund: dict[int, set[str]],
) -> bool:
    metadata = _plan_metadata(plan)
    folio = str(metadata.get("folio_number") or "").strip()
    isins = _plan_isins(plan, isins_by_fund)
    if folio and isins:
        return any((plan.user_id, folio, isin) in linked_keys for isin in isins)
    group_meta = str(metadata.get(FAMILY_GROUP_METADATA_KEY) or "")
    goal_meta = str(metadata.get(FAMILY_GOAL_METADATA_KEY) or "")
    return group_meta == str(group_id) or bool(goal_meta and goal_meta in goal_ids)


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
    links = await active_links_for_group(db, group_id=group_id, user_ids=user_ids)
    linked_keys = {(link.user_id, link.folio_number, link.isin.upper()) for link in links}

    plans = list(
        (
            await db.execute(
                select(MfSipPlan).where(
                    MfSipPlan.user_id.in_(user_ids),
                    MfSipPlan.status == MfSipPlanStatus.active,
                )
            )
        ).scalars()
    )
    isins_by_fund = await _isins_by_fund_id(db, {plan.fund_id for plan in plans if plan.fund_id})

    counts = {user_id: 0 for user_id in user_ids}
    for plan in plans:
        if _plan_counts_for_group(
            plan,
            group_id=group_id,
            goal_ids=goal_ids,
            linked_keys=linked_keys,
            isins_by_fund=isins_by_fund,
        ):
            counts[plan.user_id] = counts.get(plan.user_id, 0) + 1
    return counts


async def load_member_invested_totals(
    db: AsyncSession,
    *,
    group_id: UUID,
    user_ids: list[UUID],
) -> dict[UUID, Decimal]:
    if not user_ids:
        return {}

    totals: dict[UUID, Decimal] = {user_id: Decimal("0") for user_id in user_ids}
    for row in await collect_group_linked_holdings(db, group_id=group_id, member_ids=user_ids):
        owner_id = row["user_id"]
        if owner_id not in totals:
            continue
        invested = Decimal(str(row.get("invested_inr") or 0))
        current = Decimal(str(row.get("current_value_inr") or 0))
        totals[owner_id] += invested if invested > 0 else current
    return {user_id: amount for user_id, amount in totals.items() if amount > 0}


async def _sebi_category_by_isin(db: AsyncSession, isins: set[str]) -> dict[str, str | None]:
    if not isins:
        return {}
    rows = await db.execute(
        select(MutualFund.isin_growth, MutualFund.isin_div_reinvestment, MutualFund.sebi_category).where(
            (MutualFund.isin_growth.in_(isins)) | (MutualFund.isin_div_reinvestment.in_(isins))
        )
    )
    categories: dict[str, str | None] = {}
    for growth, dividend, category in rows.all():
        if growth:
            categories[str(growth).upper()] = category
        if dividend:
            categories[str(dividend).upper()] = category
    return categories


async def _aggregate_linked_holdings(
    db: AsyncSession,
    *,
    holdings: list[dict[str, Any]],
) -> tuple[Decimal, Decimal, dict[str, Decimal], bool]:
    total_current_value = Decimal("0")
    total_invested = Decimal("0")
    slice_totals: dict[str, Decimal] = {key: Decimal("0") for key in PORTFOLIO_SLICE_LABELS}
    if not holdings:
        return total_current_value, total_invested, slice_totals, False

    categories = await _sebi_category_by_isin(
        db,
        {str(row.get("isin") or "").upper() for row in holdings if row.get("isin")},
    )
    for row in holdings:
        current = Decimal(str(row.get("current_value_inr") or 0))
        invested = Decimal(str(row.get("invested_inr") or 0))
        if current <= 0 and invested <= 0:
            continue
        total_current_value += current
        total_invested += invested
        slice_id = _portfolio_slice_for_sebi(categories.get(str(row.get("isin") or "").upper()))
        slice_totals[slice_id] = slice_totals.get(slice_id, Decimal("0")) + current

    return total_current_value, total_invested, slice_totals, total_current_value > 0


async def _build_family_group_portfolio_payload(
    db: AsyncSession,
    *,
    group_id: UUID,
) -> dict[str, Any]:
    member_ids = await _active_member_user_ids(db, group_id=group_id)
    linked_holdings = await collect_group_linked_holdings(db, group_id=group_id, member_ids=member_ids)
    total_current_value, total_invested_inr, slice_totals, has_holdings_data = await _aggregate_linked_holdings(
        db,
        holdings=linked_holdings,
    )

    sip_counts = await load_member_linked_sip_counts(db, group_id=group_id, user_ids=member_ids)
    active_sips_count = sum(sip_counts.values())

    goal_statuses = [GoalStatus.draft, GoalStatus.active, GoalStatus.paused, GoalStatus.achieved]
    goal_scope = (
        Goal.family_group_id == group_id,
        Goal.status.in_(goal_statuses),
    )
    goals = list((await db.execute(select(Goal).where(*goal_scope))).scalars())
    goal_funded_inr = Decimal("0")
    goal_declared_savings_inr = Decimal("0")
    goal_contributions_inr = Decimal("0")
    for goal in goals:
        parts = await family_goal_funding_parts(db, goal)
        goal_funded_inr += parts["effective_current_inr"]
        goal_declared_savings_inr += parts["existing_savings_inr"]
        goal_contributions_inr += parts["manual_contributions_inr"]

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
        "holdings": [
            {
                "holding_id": str(row.get("holding_id") or ""),
                "user_id": row["user_id"],
                "member_label": row.get("member_label") or "Member",
                "scheme_name": row.get("scheme_name") or "",
                "folio_number": row.get("folio_number") or "",
                "current_value_inr": float(row.get("current_value_inr") or 0),
                "invested_inr": float(row.get("invested_inr") or 0),
                "goal_id": row.get("goal_id"),
                "goal_title": row.get("goal_title"),
            }
            for row in linked_holdings
        ],
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
            .where(
                Goal.family_group_id == group_id,
                Goal.status != GoalStatus.archived,
                GoalContribution.source_type == GoalContributionSourceType.manual,
            )
            .order_by(GoalContribution.contributed_at.asc())
        )
    ).all()

    order_rows: list[tuple[datetime, Decimal]] = []
    if member_ids:
        goal_id_rows = await db.execute(
            select(Goal.id).where(Goal.family_group_id == group_id, Goal.status != GoalStatus.archived)
        )
        goal_ids = {str(goal_id) for goal_id in goal_id_rows.scalars()}
        links = await active_links_for_group(db, group_id=group_id, user_ids=member_ids)
        linked_keys = {(link.user_id, link.folio_number, link.isin.upper()) for link in links}
        linked_folios = {(link.user_id, link.folio_number) for link in links}
        candidate_orders = list(
            (
                await db.execute(
                    select(MfOrder).where(
                        MfOrder.user_id.in_(member_ids),
                        MfOrder.status == MfOrderStatus.succeeded,
                    )
                )
            ).scalars()
        )
        for order in candidate_orders:
            metadata = order.metadata_ if isinstance(order.metadata_, dict) else {}
            folio = str(metadata.get("folio_number") or "").strip()
            isin = str(metadata.get("isin") or order.fp_scheme_id or "").strip().upper()
            group_meta = str(metadata.get(FAMILY_GROUP_METADATA_KEY) or "")
            goal_meta = str(metadata.get(FAMILY_GOAL_METADATA_KEY) or "")
            if folio and isin.startswith("INF"):
                linked = (order.user_id, folio, isin) in linked_keys
            elif folio:
                linked = (order.user_id, folio) in linked_folios
            else:
                linked = group_meta == str(group_id) or bool(goal_meta and goal_meta in goal_ids)
            if linked and order.created_at is not None and order.amount_inr > 0:
                order_rows.append((order.created_at, order.amount_inr))

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

    plans = list(
        (
            await db.execute(
                select(MfSipPlan).where(
                    MfSipPlan.user_id.in_(list(member_labels.keys())),
                    MfSipPlan.status == MfSipPlanStatus.active,
                )
            )
        ).scalars()
    )

    links = await active_links_for_group(db, group_id=group_id, user_ids=list(member_labels.keys()))
    linked_keys = {(link.user_id, link.folio_number, link.isin.upper()) for link in links}
    goal_by_holding = {
        (link.user_id, link.folio_number, link.isin.upper()): goal_titles.get(str(link.goal_id))
        for link in links
        if link.goal_id
    }
    isins_by_fund = await _isins_by_fund_id(db, {plan.fund_id for plan in plans if plan.fund_id})

    addons: list[dict[str, Any]] = []
    for plan in plans:
        if not _plan_counts_for_group(
            plan,
            group_id=group_id,
            goal_ids=set(goal_titles),
            linked_keys=linked_keys,
            isins_by_fund=isins_by_fund,
        ):
            continue
        metadata = plan.metadata_ if isinstance(plan.metadata_, dict) else {}
        raw_goal_id = metadata.get(FAMILY_GOAL_METADATA_KEY)
        folio = str(metadata.get("folio_number") or "").strip()
        isins = _plan_isins(plan, isins_by_fund)
        goal_title = goal_titles.get(str(raw_goal_id)) if raw_goal_id else None
        if goal_title is None and folio:
            for isin in isins:
                goal_title = goal_by_holding.get((plan.user_id, folio, isin))
                if goal_title:
                    break
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
    group_id: UUID,
    member_labels: dict[UUID, str],
) -> list[dict[str, Any]]:
    if not member_labels:
        return []
    return await collect_group_linked_holdings(
        db,
        group_id=group_id,
        member_ids=list(member_labels.keys()),
        member_labels=member_labels,
    )


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
                GoalContribution.source_type == GoalContributionSourceType.manual,
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
