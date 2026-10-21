"""Opt-in links from a mutual-fund holding to one family group and optional goal."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.family_groups.display import get_active_membership
from app.application.goals.constants import FAMILY_GOAL_METADATA_KEY, FAMILY_GROUP_METADATA_KEY
from app.application.goals.errors import GoalError
from app.infrastructure.persistence.family_group_models import (
    FamilyGroup,
    FamilyGroupStatus,
    FamilyHoldingLink,
)
from app.infrastructure.persistence.goal_models import (
    Goal,
    GoalContribution,
    GoalContributionSourceType,
    GoalStatus,
)
from app.infrastructure.persistence.mf_models import MutualFund
from app.infrastructure.persistence.mf_transaction_models import MfOrder, MfSipPlan


def _parse_uuid(raw: Any) -> UUID | None:
    if not raw:
        return None
    try:
        return UUID(str(raw))
    except ValueError:
        return None


def apply_family_link_metadata(
    metadata: dict[str, Any] | None,
    *,
    family_group_id: UUID | None,
    family_goal_id: UUID | None,
) -> dict[str, Any]:
    payload = dict(metadata or {})
    if family_goal_id is None:
        payload.pop(FAMILY_GOAL_METADATA_KEY, None)
    else:
        payload[FAMILY_GOAL_METADATA_KEY] = str(family_goal_id)
    if family_group_id is None:
        payload.pop(FAMILY_GROUP_METADATA_KEY, None)
    else:
        payload[FAMILY_GROUP_METADATA_KEY] = str(family_group_id)
    return payload


def _metadata_dict(metadata: Any) -> dict[str, Any]:
    return metadata if isinstance(metadata, dict) else {}


async def resolve_purchase_family_link(
    db: AsyncSession,
    *,
    user_id: UUID,
    family_group_id: UUID | None,
    family_goal_id: UUID | None,
) -> tuple[UUID | None, UUID | None]:
    """Return ``(group_id, goal_id)``. Either may be omitted. Goal requires its group."""
    if family_group_id is None and family_goal_id is None:
        return None, None

    goal: Goal | None = None
    if family_goal_id is not None:
        goal = await db.get(Goal, family_goal_id)
        if not goal or goal.family_group_id is None:
            raise GoalError(code="goal_not_found", message="Family goal not found.", status_code=404)
        if goal.status == GoalStatus.archived:
            raise GoalError(
                code="goal_archived",
                message="Cannot link a fund to an archived goal.",
                status_code=409,
            )
        if family_group_id is None:
            family_group_id = goal.family_group_id
        elif goal.family_group_id != family_group_id:
            raise GoalError(
                code="goal_group_mismatch",
                message="That goal belongs to a different family.",
                status_code=409,
            )

    group = await db.get(FamilyGroup, family_group_id)
    if not group or group.status != FamilyGroupStatus.active:
        raise GoalError(code="family_group_not_found", message="Family group not found.", status_code=404)

    membership = await get_active_membership(db, group_id=group.id, user_id=user_id)
    if not membership:
        raise GoalError(
            code="forbidden",
            message="You can only link a fund to a family you belong to.",
            status_code=403,
        )
    return group.id, goal.id if goal else None


async def _find_link(
    db: AsyncSession,
    *,
    user_id: UUID,
    folio_number: str,
    isin: str,
) -> FamilyHoldingLink | None:
    return await db.scalar(
        select(FamilyHoldingLink).where(
            FamilyHoldingLink.user_id == user_id,
            FamilyHoldingLink.folio_number == folio_number,
            FamilyHoldingLink.isin == isin,
        )
    )


async def upsert_family_holding_link(
    db: AsyncSession,
    *,
    user_id: UUID,
    folio_number: str,
    isin: str,
    family_group_id: UUID,
    goal_id: UUID | None,
) -> FamilyHoldingLink:
    group_id, resolved_goal_id = await resolve_purchase_family_link(
        db,
        user_id=user_id,
        family_group_id=family_group_id,
        family_goal_id=goal_id,
    )
    if group_id is None:
        raise GoalError(code="family_group_not_found", message="Family group not found.", status_code=404)

    folio = folio_number.strip()
    scheme = isin.strip().upper()
    if not folio or not scheme:
        raise GoalError(code="invalid_holding", message="Folio and scheme are required.", status_code=400)

    existing = await _find_link(db, user_id=user_id, folio_number=folio, isin=scheme)
    if existing:
        existing.family_group_id = group_id
        existing.goal_id = resolved_goal_id
        existing.removed_at = None
        await db.flush()
        return existing

    link = FamilyHoldingLink(
        user_id=user_id,
        folio_number=folio,
        isin=scheme,
        family_group_id=group_id,
        goal_id=resolved_goal_id,
    )
    db.add(link)
    await db.flush()
    return link


async def remove_family_holding_link(
    db: AsyncSession,
    *,
    user_id: UUID,
    folio_number: str,
    isin: str,
) -> bool:
    existing = await _find_link(
        db,
        user_id=user_id,
        folio_number=folio_number.strip(),
        isin=isin.strip().upper(),
    )
    if not existing or existing.removed_at is not None:
        return False
    existing.removed_at = datetime.now(timezone.utc)
    existing.goal_id = None
    await db.flush()
    return True


async def serialize_family_holding_link(
    db: AsyncSession,
    *,
    user_id: UUID,
    folio_number: str,
    isin: str,
) -> dict[str, Any] | None:
    link = await _find_link(
        db,
        user_id=user_id,
        folio_number=folio_number.strip(),
        isin=isin.strip().upper(),
    )
    if not link or link.removed_at is not None:
        return None
    group = await db.get(FamilyGroup, link.family_group_id)
    goal = await db.get(Goal, link.goal_id) if link.goal_id else None
    return {
        "family_group_id": str(link.family_group_id),
        "family_group_title": group.title if group else "",
        "goal_id": str(link.goal_id) if link.goal_id else None,
        "goal_title": goal.title if goal else None,
    }


def _isin_from_fund(fund: MutualFund | None, metadata: dict[str, Any], stored_scheme: str | None) -> str | None:
    for raw in (metadata.get("isin"), stored_scheme, fund.isin_growth if fund else None, fund.isin_div_reinvestment if fund else None):
        text = str(raw or "").strip().upper()
        if text.startswith("INF"):
            return text
    return None


async def materialize_family_link_from_order(db: AsyncSession, order: MfOrder) -> FamilyHoldingLink | None:
    metadata = _metadata_dict(order.metadata_)
    fund = await db.get(MutualFund, order.fund_id) if order.fund_id else None
    folio = str(metadata.get("folio_number") or "").strip()
    isin = _isin_from_fund(fund, metadata, order.fp_scheme_id)
    return await _materialize_from_metadata(
        db,
        user_id=order.user_id,
        folio_number=folio,
        isin=isin,
        metadata=metadata,
    )


async def materialize_family_link_from_sip_plan(db: AsyncSession, plan: MfSipPlan) -> FamilyHoldingLink | None:
    metadata = _metadata_dict(plan.metadata_)
    fund = await db.get(MutualFund, plan.fund_id) if plan.fund_id else None
    folio = str(metadata.get("folio_number") or "").strip()
    stored_scheme = str(metadata.get("fp_scheme_id") or metadata.get("purchase_scheme") or "")
    isin = _isin_from_fund(fund, metadata, stored_scheme or None)
    return await _materialize_from_metadata(
        db,
        user_id=plan.user_id,
        folio_number=folio,
        isin=isin,
        metadata=metadata,
    )


async def _materialize_from_metadata(
    db: AsyncSession,
    *,
    user_id: UUID,
    folio_number: str,
    isin: str | None,
    metadata: dict[str, Any],
) -> FamilyHoldingLink | None:
    """Create a link from purchase intent only when the owner has not chosen yet."""
    if not folio_number or not isin:
        return None

    group_id = _parse_uuid(metadata.get(FAMILY_GROUP_METADATA_KEY))
    goal_id = _parse_uuid(metadata.get(FAMILY_GOAL_METADATA_KEY))
    if group_id is None and goal_id is None:
        return None

    existing = await _find_link(db, user_id=user_id, folio_number=folio_number, isin=isin)
    if existing:
        return None if existing.removed_at is not None else existing

    try:
        resolved_group_id, resolved_goal_id = await resolve_purchase_family_link(
            db,
            user_id=user_id,
            family_group_id=group_id,
            family_goal_id=goal_id,
        )
    except GoalError:
        return None
    if resolved_group_id is None:
        return None

    link = FamilyHoldingLink(
        user_id=user_id,
        folio_number=folio_number,
        isin=isin,
        family_group_id=resolved_group_id,
        goal_id=resolved_goal_id,
    )
    db.add(link)
    await db.flush()
    return link


async def _cached_user_holdings(db: AsyncSession, user_id: UUID) -> list[dict[str, Any]]:
    from app.application.mf.portfolio_holdings_service import list_user_portfolio_holdings

    cache: dict[UUID, list[dict[str, Any]]] = db.info.setdefault("zynd_user_holdings_cache", {})
    if user_id not in cache:
        payload = await list_user_portfolio_holdings(db, user_id=user_id)
        cache[user_id] = list(payload.get("holdings") or [])
    return cache[user_id]


async def collect_group_linked_holdings(
    db: AsyncSession,
    *,
    group_id: UUID,
    member_ids: list[UUID] | None = None,
    member_labels: dict[UUID, str] | None = None,
) -> list[dict[str, Any]]:
    """Holdings explicitly linked to this group. Unlinked personal funds are omitted."""
    link_query = select(FamilyHoldingLink).where(
        FamilyHoldingLink.family_group_id == group_id,
        FamilyHoldingLink.removed_at.is_(None),
    )
    if member_ids is not None:
        if not member_ids:
            return []
        link_query = link_query.where(FamilyHoldingLink.user_id.in_(member_ids))
    links = list((await db.execute(link_query)).scalars())
    if not links:
        return []

    goal_ids = {link.goal_id for link in links if link.goal_id}
    goal_titles: dict[UUID, str] = {}
    if goal_ids:
        goal_rows = await db.execute(select(Goal.id, Goal.title).where(Goal.id.in_(goal_ids)))
        goal_titles = {goal_id: title for goal_id, title in goal_rows.all()}

    by_user: dict[UUID, dict[tuple[str, str], FamilyHoldingLink]] = {}
    for link in links:
        by_user.setdefault(link.user_id, {})[(link.folio_number, link.isin.upper())] = link

    rows: list[dict[str, Any]] = []
    for user_id, user_links in by_user.items():
        label = (member_labels or {}).get(user_id, "Member")
        for holding in await _cached_user_holdings(db, user_id):
            folio = str(holding.get("folio_number") or "").strip()
            isin = str(holding.get("isin") or "").upper()
            link = user_links.get((folio, isin))
            if not link:
                continue
            rows.append(
                {
                    "holding_id": holding.get("id"),
                    "user_id": user_id,
                    "member_label": label.split(" ")[0] if label else "Member",
                    "member_display_name": label,
                    "scheme_name": holding.get("fund_name") or "Mutual fund",
                    "matched_scheme_name": holding.get("fund_name") or "Mutual fund",
                    "folio_number": folio,
                    "isin": isin,
                    "units": float(holding.get("units") or 0),
                    "nav_value": holding.get("nav"),
                    "current_value_inr": float(holding.get("current_value_inr") or 0),
                    "invested_inr": float(holding.get("invested_inr") or 0),
                    "market_value_inr": float(holding.get("current_value_inr") or 0),
                    "as_of_date": holding.get("nav_as_on"),
                    "amc_name": holding.get("amc_name"),
                    "source": holding.get("source") or "zynd",
                    "goal_id": str(link.goal_id) if link.goal_id else None,
                    "goal_title": goal_titles.get(link.goal_id) if link.goal_id else None,
                }
            )

    rows.sort(key=lambda item: (-float(item.get("current_value_inr") or 0), str(item.get("scheme_name") or "")))
    return rows


async def family_goal_funding_parts(db: AsyncSession, goal: Goal) -> dict[str, Decimal]:
    """Family goal progress: existing savings + manual cash + live linked holding value."""
    savings = Decimal(str(goal.existing_savings_inr or 0))
    manual_result = await db.scalar(
        select(func.coalesce(func.sum(GoalContribution.amount_inr), 0)).where(
            GoalContribution.goal_id == goal.id,
            GoalContribution.source_type == GoalContributionSourceType.manual,
        )
    )
    manual = Decimal(str(manual_result or 0))
    linked_value = Decimal("0")
    if goal.family_group_id:
        for row in await collect_group_linked_holdings(db, group_id=goal.family_group_id):
            if row.get("goal_id") == str(goal.id):
                linked_value += Decimal(str(row.get("current_value_inr") or 0))
    return {
        "existing_savings_inr": savings,
        "manual_contributions_inr": manual,
        "linked_holdings_value_inr": linked_value,
        "effective_current_inr": savings + manual + linked_value,
    }


async def active_links_for_group(
    db: AsyncSession,
    *,
    group_id: UUID,
    user_ids: list[UUID],
) -> list[FamilyHoldingLink]:
    if not user_ids:
        return []
    return list(
        (
            await db.execute(
                select(FamilyHoldingLink).where(
                    FamilyHoldingLink.family_group_id == group_id,
                    FamilyHoldingLink.removed_at.is_(None),
                    FamilyHoldingLink.user_id.in_(user_ids),
                )
            )
        ).scalars()
    )
