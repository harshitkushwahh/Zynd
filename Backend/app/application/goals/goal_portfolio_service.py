from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.goals.errors import GoalError
from app.application.goals.goal_calculator_service import calculate_goal_plan
from app.application.goals.constants import FAMILY_GOAL_METADATA_KEY
from app.application.mf.catalog_governance_service import is_product_investable
from app.application.mf.catalog_lifecycle_service import is_catalog_eligible
from app.infrastructure.persistence.goal_models import Goal
from app.infrastructure.persistence.mf_models import MutualFund, Product, ProductLifecycleStatus
from app.infrastructure.persistence.mf_transaction_models import (
    MfExternalHolding,
    MfOrder,
    MfOrderStatus,
    MfSipPlan,
    MfSipPlanStatus,
)


def _decimal(value: float | Decimal | str) -> Decimal:
    return Decimal(str(value))


def _compute_progress_pct(*, current: Decimal, target: Decimal) -> float:
    if target <= 0:
        return 0.0
    pct = (current / target * Decimal("100")).quantize(Decimal("0.01"))
    return float(min(pct, Decimal("100")))


async def validate_linked_product(db: AsyncSession, *, product_id: UUID) -> Product:
    product = await db.get(Product, product_id)
    if not product:
        raise GoalError(code="product_not_found", message="Linked fund not found.", status_code=404)
    if product.lifecycle_status != ProductLifecycleStatus.active:
        raise GoalError(code="product_not_investable", message="Linked fund is not available.", status_code=409)
    fund = await db.scalar(select(MutualFund).where(MutualFund.product_id == product.id))
    if not fund or not is_catalog_eligible(fund) or not is_product_investable(product, fund):
        raise GoalError(code="product_not_investable", message="Linked fund is not available.", status_code=409)
    return product


async def linked_holdings_value_inr(
    db: AsyncSession,
    *,
    user_id: UUID,
    product_id: UUID,
) -> Decimal:
    fund = await db.scalar(select(MutualFund).where(MutualFund.product_id == product_id))
    if not fund:
        return Decimal("0")

    result = await db.execute(
        select(func.coalesce(func.sum(MfExternalHolding.market_value_inr), 0)).where(
            MfExternalHolding.user_id == user_id,
            MfExternalHolding.matched_fund_id == fund.id,
            MfExternalHolding.market_value_inr.is_not(None),
        )
    )
    return Decimal(str(result.scalar_one()))


async def linked_succeeded_orders_inr(
    db: AsyncSession,
    *,
    user_id: UUID,
    product_id: UUID,
) -> Decimal:
    result = await db.execute(
        select(func.coalesce(func.sum(MfOrder.amount_inr), 0)).where(
            MfOrder.user_id == user_id,
            MfOrder.product_id == product_id,
            MfOrder.status == MfOrderStatus.succeeded,
        )
    )
    return Decimal(str(result.scalar_one()))


async def linked_active_sip_monthly_inr(
    db: AsyncSession,
    *,
    user_id: UUID,
    goal_id: UUID,
) -> Decimal:
    goal_key = str(goal_id)
    plans = (
        await db.execute(
            select(MfSipPlan).where(
                MfSipPlan.user_id == user_id,
                MfSipPlan.status == MfSipPlanStatus.active,
            )
        )
    ).scalars()
    total = Decimal("0")
    for plan in plans:
        metadata = plan.metadata_ if isinstance(plan.metadata_, dict) else {}
        if metadata.get(FAMILY_GOAL_METADATA_KEY) == goal_key:
            total += plan.amount_inr
    return total


def _months_until(target_date: date, *, today: date | None = None) -> int:
    anchor = today or date.today()
    if target_date <= anchor:
        return 0
    months = (target_date.year - anchor.year) * 12 + (target_date.month - anchor.month)
    if target_date.day < anchor.day:
        months -= 1
    return max(months, 0)


async def build_goal_portfolio_snapshot(db: AsyncSession, goal: Goal) -> dict[str, Any]:
    holdings_value = Decimal("0")
    invested_via_orders = Decimal("0")
    linked_product_name: str | None = None
    linked_sip_monthly = Decimal("0")

    if goal.linked_product_id:
        product = await db.get(Product, goal.linked_product_id)
        linked_product_name = product.name if product else None
        holdings_value = await linked_holdings_value_inr(
            db,
            user_id=goal.user_id,
            product_id=goal.linked_product_id,
        )
        if goal.family_group_id is None:
            invested_via_orders = await linked_succeeded_orders_inr(
                db,
                user_id=goal.user_id,
                product_id=goal.linked_product_id,
            )

    if goal.family_group_id:
        linked_sip_monthly = await linked_active_sip_monthly_inr(
            db,
            user_id=goal.user_id,
            goal_id=goal.id,
        )

    effective_current = _decimal(goal.current_amount_inr) + holdings_value + invested_via_orders
    progress_pct = _compute_progress_pct(current=effective_current, target=goal.target_amount_inr)

    months_remaining = _months_until(goal.target_date)
    plan = calculate_goal_plan(
        target_amount_inr=goal.target_amount_inr,
        target_date=goal.target_date,
        existing_savings_inr=effective_current,
        expected_return_pct=goal.expected_return_pct,
    )
    projected_value = _decimal(plan["projected_value_inr"])
    if linked_sip_monthly > 0 and months_remaining > 0:
        projected_value = max(
            projected_value,
            effective_current + linked_sip_monthly * Decimal(months_remaining),
        )

    return {
        "linked_product_id": str(goal.linked_product_id) if goal.linked_product_id else None,
        "linked_product_name": linked_product_name,
        "holdings_value_inr": float(holdings_value),
        "invested_via_orders_inr": float(invested_via_orders),
        "linked_sip_monthly_inr": float(linked_sip_monthly),
        "effective_current_amount_inr": float(effective_current),
        "effective_progress_pct": progress_pct,
        "projected_value_inr": float(projected_value),
    }


async def enrich_goal_payload(db: AsyncSession, goal: Goal, payload: dict[str, Any]) -> dict[str, Any]:
    snapshot = await build_goal_portfolio_snapshot(db, goal)
    enriched = {**payload, **snapshot}
    if snapshot["effective_current_amount_inr"] != payload.get("current_amount_inr"):
        enriched["progress_pct"] = snapshot["effective_progress_pct"]
    return enriched
