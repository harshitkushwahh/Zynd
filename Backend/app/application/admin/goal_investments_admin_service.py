from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.goals.constants import FAMILY_GOAL_METADATA_KEY
from app.application.mf.mf_order_service import list_user_orders, serialize_order
from app.application.mf.mf_sip_plan_service import serialize_sip_plan
from app.infrastructure.persistence.family_group_models import FamilyGroupMember, FamilyGroupMemberStatus
from app.infrastructure.persistence.goal_models import Goal, GoalContribution
from app.infrastructure.persistence.mf_models import MutualFund, Product
from app.infrastructure.persistence.mf_transaction_models import (
    MfExternalHolding,
    MfMandate,
    MfOrder,
    MfOrderStatus,
    MfSipPlan,
    MfSipPlanStatus,
)
from app.infrastructure.persistence.models import User


def _goal_metadata_matches(metadata: dict[str, Any] | None, *, goal_id: UUID) -> bool:
    if not metadata:
        return False
    return metadata.get(FAMILY_GOAL_METADATA_KEY) == str(goal_id)


async def _investment_scope_user_ids(db: AsyncSession, goal: Goal) -> list[UUID]:
    if goal.family_group_id:
        rows = await db.execute(
            select(FamilyGroupMember.user_id).where(
                FamilyGroupMember.group_id == goal.family_group_id,
                FamilyGroupMember.status == FamilyGroupMemberStatus.active,
            )
        )
        return list(rows.scalars())
    return [goal.user_id]


async def _member_display_names(db: AsyncSession, user_ids: list[UUID]) -> dict[UUID, str]:
    if not user_ids:
        return {}
    rows = await db.execute(
        select(User.id, User.first_name, User.last_name, User.email).where(User.id.in_(user_ids))
    )
    labels: dict[UUID, str] = {}
    for user_id, first_name, last_name, email in rows.all():
        parts = [first_name, last_name]
        name = " ".join(part.strip() for part in parts if part and part.strip())
        if name:
            labels[user_id] = name
        else:
            local = email.split("@", 1)[0]
            labels[user_id] = local.replace(".", " ").replace("_", " ").title()
    return labels


async def build_goal_investments_detail(db: AsyncSession, *, goal: Goal) -> dict[str, Any]:
    scope_user_ids = await _investment_scope_user_ids(db, goal)
    member_labels = await _member_display_names(db, scope_user_ids)

    linked_product_id = goal.linked_product_id
    linked_product_name: str | None = None
    linked_fund_isin: str | None = None
    matched_fund_id: int | None = None

    if linked_product_id:
        product = await db.get(Product, linked_product_id)
        if product:
            linked_product_name = product.name
            fund = await db.scalar(select(MutualFund).where(MutualFund.product_id == product.id))
            if fund:
                linked_fund_isin = fund.isin
                matched_fund_id = fund.id

    holdings: list[dict[str, Any]] = []
    if matched_fund_id is not None and scope_user_ids:
        rows = (
            await db.execute(
                select(MfExternalHolding, MutualFund.scheme_name)
                .outerjoin(MutualFund, MutualFund.id == MfExternalHolding.matched_fund_id)
                .where(
                    MfExternalHolding.user_id.in_(scope_user_ids),
                    MfExternalHolding.matched_fund_id == matched_fund_id,
                )
                .order_by(
                    MfExternalHolding.market_value_inr.desc().nullslast(),
                    MfExternalHolding.scheme_name.asc(),
                )
            )
        ).all()
        for holding, matched_name in rows:
            owner_label = member_labels.get(holding.user_id, "Member")
            holdings.append(
                {
                    "holding_id": holding.id,
                    "user_id": str(holding.user_id),
                    "owner_display_name": owner_label,
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

    sip_plans: list[dict[str, Any]] = []
    if scope_user_ids:
        plans = (
            await db.execute(
                select(MfSipPlan)
                .where(MfSipPlan.user_id.in_(scope_user_ids))
                .order_by(MfSipPlan.created_at.desc())
            )
        ).scalars()
        product_ids = {plan.product_id for plan in plans}
        products = {
            row.id: row.name
            for row in (await db.execute(select(Product).where(Product.id.in_(product_ids)))).scalars()
        } if product_ids else {}

        for plan in plans:
            metadata = plan.metadata_ if isinstance(plan.metadata_, dict) else {}
            goal_linked = _goal_metadata_matches(metadata, goal_id=goal.id)
            product_linked = linked_product_id is not None and plan.product_id == linked_product_id
            if not goal_linked and not product_linked:
                continue

            mandate = await db.get(MfMandate, plan.mf_mandate_id) if plan.mf_mandate_id else None
            owner_label = member_labels.get(plan.user_id, "Member")
            payload = serialize_sip_plan(plan, product_name=products.get(plan.product_id), mandate=mandate)
            payload["user_id"] = str(plan.user_id)
            payload["owner_display_name"] = owner_label
            payload["is_goal_linked"] = goal_linked
            sip_plans.append(payload)

    orders: list[dict[str, Any]] = []
    if scope_user_ids:
        for user_id in scope_user_ids:
            user_orders = await list_user_orders(db, user_id=user_id, limit=100)
            for order in user_orders:
                if order.status != MfOrderStatus.succeeded:
                    continue
                metadata = order.metadata_ if isinstance(order.metadata_, dict) else {}
                goal_linked = _goal_metadata_matches(metadata, goal_id=goal.id)
                product_linked = linked_product_id is not None and order.product_id == linked_product_id
                if not goal_linked and not product_linked:
                    continue

                product = await db.get(Product, order.product_id)
                owner_label = member_labels.get(order.user_id, "Member")
                payload = serialize_order(order, product_name=product.name if product else None)
                payload["user_id"] = str(order.user_id)
                payload["owner_display_name"] = owner_label
                payload["is_goal_linked"] = goal_linked
                orders.append(payload)

        orders.sort(key=lambda item: item.get("created_at") or "", reverse=True)

    contribution_rows = (
        await db.scalars(
            select(GoalContribution)
            .where(GoalContribution.goal_id == goal.id)
            .order_by(GoalContribution.contributed_at.desc(), GoalContribution.id.desc())
        )
    ).all()
    contributions = [
        {
            "id": str(row.id),
            "user_id": str(row.user_id),
            "owner_display_name": member_labels.get(row.user_id, "Member"),
            "amount_inr": float(row.amount_inr),
            "source_type": row.source_type.value,
            "note": row.note,
            "contributed_at": row.contributed_at.isoformat() if row.contributed_at else None,
        }
        for row in contribution_rows
    ]

    holdings_value_inr = sum(item["market_value_inr"] or 0 for item in holdings)
    invested_via_orders_inr = sum(item["amount_inr"] for item in orders)
    linked_sip_monthly_inr = sum(
        item["amount_inr"] for item in sip_plans if item.get("status") == "active"
    )
    contributions_total_inr = sum(item["amount_inr"] for item in contributions)

    return {
        "goal_id": str(goal.id),
        "linked_product": {
            "product_id": str(linked_product_id),
            "product_name": linked_product_name,
            "isin": linked_fund_isin,
        }
        if linked_product_id
        else None,
        "holdings": holdings,
        "sip_plans": sip_plans,
        "orders": orders,
        "contributions": contributions,
        "summary": {
            "holdings_value_inr": holdings_value_inr,
            "invested_via_orders_inr": invested_via_orders_inr,
            "linked_sip_monthly_inr": linked_sip_monthly_inr,
            "contributions_total_inr": contributions_total_inr,
            "has_linked_investment": bool(
                linked_product_id
                or holdings
                or sip_plans
                or orders
                or contributions
            ),
        },
    }
