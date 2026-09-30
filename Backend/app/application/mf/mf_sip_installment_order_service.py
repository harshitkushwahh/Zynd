"""Materialize Cybrilla SIP installment purchases as local MfOrder rows for the transactions tab."""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.mf_fp_state import map_fp_purchase_state
from app.application.mf.mf_order_service import _record_order_event
from app.application.mf.mf_sip_first_installment_service import (
    _fetch_first_installment_payment_status,
    _first_installment_meta,
    _payment_covers_first_installment,
    _pick_first_installment_purchase,
)
from app.infrastructure.mf.fp_oms_client import get_mf_purchase, list_mf_purchases_for_plan
from app.infrastructure.mf.fp_payment_client import is_payment_success_status
from app.infrastructure.persistence.mf_transaction_models import (
    MfOrder,
    MfOrderStatus,
    MfOrderType,
    MfSipPlan,
    MfSipPlanStatus,
)

logger = logging.getLogger(__name__)


def _first_installment_idempotency_key(plan_id: UUID, fp_purchase_id: str) -> str:
    return f"sip-first-installment:{plan_id}:{fp_purchase_id}"


def _store_first_installment_payment_meta(
    order: MfOrder,
    *,
    fp_payment_status: str | None,
    fp_payment_id: Any = None,
    payment_succeeded: bool,
    sip_plan_id: UUID,
) -> None:
    metadata = dict(order.metadata_ or {})
    ondc = dict(metadata.get("ondc") or {}) if isinstance(metadata.get("ondc"), dict) else {}
    if fp_payment_status is not None:
        ondc["fp_payment_status"] = fp_payment_status
    if fp_payment_id is not None:
        ondc["fp_payment_id"] = fp_payment_id
    if payment_succeeded:
        ondc["payment_success"] = True
    metadata["ondc"] = ondc
    metadata["sip_plan_id"] = str(sip_plan_id)
    metadata["sip_installment"] = "first"
    order.metadata_ = metadata


async def sync_sip_first_installment_order(
    session: AsyncSession,
    plan: MfSipPlan,
    *,
    installment: dict[str, Any] | None = None,
) -> MfOrder | None:
    """Upsert a SIP-type MfOrder for the plan's first Cybrilla purchase."""
    if plan.status != MfSipPlanStatus.active or not plan.fp_plan_id:
        return None

    if installment is None:
        purchases = await list_mf_purchases_for_plan(fp_plan_id=plan.fp_plan_id)
        installment = _pick_first_installment_purchase(purchases)
    if not installment:
        return None

    fp_purchase_id = installment.get("fp_purchase_id")
    if not fp_purchase_id:
        return None

    fp_purchase_id = str(fp_purchase_id)
    fp_purchase_old_id = installment.get("fp_purchase_old_id")
    fp_state = installment.get("state")
    raw = installment.get("raw") if isinstance(installment.get("raw"), dict) else {}
    try:
        amount_inr = Decimal(str(raw.get("amount") or plan.amount_inr))
    except (TypeError, ValueError):
        amount_inr = plan.amount_inr

    cached = _first_installment_meta(plan)
    fp_payment_id = cached.get("fp_payment_id")
    fp_payment_status, payment_payload = await _fetch_first_installment_payment_status(fp_payment_id)
    payment_succeeded = _payment_covers_first_installment(payment_payload, fp_purchase_old_id) and (
        is_payment_success_status(fp_payment_status)
    )

    if fp_purchase_id:
        try:
            purchase = await get_mf_purchase(fp_purchase_id)
            obj = purchase.get("data") if isinstance(purchase.get("data"), dict) else purchase
            fp_state = obj.get("state") or fp_state
            if obj.get("amount") is not None:
                try:
                    amount_inr = Decimal(str(obj.get("amount")))
                except (TypeError, ValueError):
                    pass
        except Exception:
            logger.warning(
                "Unable to refresh SIP first installment purchase plan=%s purchase=%s",
                plan.id,
                fp_purchase_id,
                exc_info=True,
            )

    target_status = map_fp_purchase_state(str(fp_state) if fp_state is not None else None)
    if payment_succeeded and target_status in {
        MfOrderStatus.payment_pending,
        MfOrderStatus.submitted,
    }:
        target_status = MfOrderStatus.processing

    order = await session.scalar(select(MfOrder).where(MfOrder.fp_purchase_id == fp_purchase_id))
    if order is None:
        idempotency_key = _first_installment_idempotency_key(plan.id, fp_purchase_id)
        order = await session.scalar(select(MfOrder).where(MfOrder.idempotency_key == idempotency_key))
    if order is None:
        order = MfOrder(
            user_id=plan.user_id,
            product_id=plan.product_id,
            fund_id=plan.fund_id,
            mf_investment_account_id=plan.mf_investment_account_id,
            checkout_id=None,
            line_index=0,
            order_type=MfOrderType.sip,
            amount_inr=amount_inr,
            status=target_status,
            fp_purchase_id=fp_purchase_id,
            fp_purchase_old_id=int(fp_purchase_old_id) if fp_purchase_old_id is not None else None,
            fp_scheme_id=(plan.metadata_ or {}).get("fp_scheme_id") if isinstance(plan.metadata_, dict) else None,
            fp_state=str(fp_state) if fp_state is not None else None,
            idempotency_key=_first_installment_idempotency_key(plan.id, fp_purchase_id),
        )
        _store_first_installment_payment_meta(
            order,
            fp_payment_status=fp_payment_status,
            fp_payment_id=fp_payment_id,
            payment_succeeded=payment_succeeded,
            sip_plan_id=plan.id,
        )
        session.add(order)
        await session.flush()
        await _record_order_event(
            session,
            order,
            from_status=None,
            to_status=order.status.value,
            source="SIP_SYNC",
            payload={"fp_state": order.fp_state, "sip_plan_id": str(plan.id)},
        )
        return order

    changed = False
    if order.fp_purchase_old_id is None and fp_purchase_old_id is not None:
        try:
            order.fp_purchase_old_id = int(fp_purchase_old_id)
            changed = True
        except (TypeError, ValueError):
            pass

    fp_state_text = str(fp_state) if fp_state is not None else order.fp_state
    if fp_state_text and order.fp_state != fp_state_text:
        order.fp_state = fp_state_text
        changed = True

    if order.amount_inr != amount_inr:
        order.amount_inr = amount_inr
        changed = True

    if payment_succeeded:
        order.failure_code = None
        order.failure_reason = None

    if order.status != target_status and (
        payment_succeeded
        or order.status
        not in {
            MfOrderStatus.succeeded,
            MfOrderStatus.failed,
            MfOrderStatus.cancelled,
        }
    ):
        previous = order.status.value
        order.status = target_status
        await _record_order_event(
            session,
            order,
            from_status=previous,
            to_status=order.status.value,
            source="SIP_SYNC",
            payload={"fp_state": order.fp_state, "sip_plan_id": str(plan.id)},
        )
        changed = True

    _store_first_installment_payment_meta(
        order,
        fp_payment_status=fp_payment_status,
        fp_payment_id=fp_payment_id,
        payment_succeeded=payment_succeeded,
        sip_plan_id=plan.id,
    )
    if changed:
        await session.flush()
    return order


async def resync_sip_first_installment_order(session: AsyncSession, order: MfOrder) -> bool:
    """Repair a SIP first-installment order from its linked plan and Cybrilla truth."""
    metadata = order.metadata_ if isinstance(order.metadata_, dict) else {}
    plan_id_raw = metadata.get("sip_plan_id")
    if not plan_id_raw:
        return False
    try:
        plan_id = UUID(str(plan_id_raw))
    except ValueError:
        return False

    plan = await session.get(MfSipPlan, plan_id)
    if plan is None:
        return False

    before_status = order.status
    before_failure = order.failure_code
    before_meta = dict(order.metadata_ or {})
    synced = await sync_sip_first_installment_order(session, plan)
    if synced is None:
        return False
    return (
        synced.status != before_status
        or synced.failure_code != before_failure
        or synced.metadata_ != before_meta
    )


async def sync_user_sip_installment_orders(
    session: AsyncSession,
    *,
    user_id: UUID,
    limit: int = 20,
) -> int:
    """Backfill SIP first-installment purchases into mf_orders for transaction history."""
    plans = list(
        (
            await session.execute(
                select(MfSipPlan)
                .where(
                    MfSipPlan.user_id == user_id,
                    MfSipPlan.status == MfSipPlanStatus.active,
                    MfSipPlan.fp_plan_id.is_not(None),
                )
                .order_by(MfSipPlan.created_at.desc())
                .limit(limit)
            )
        ).scalars()
    )
    synced = 0
    for plan in plans:
        if await sync_sip_first_installment_order(session, plan):
            synced += 1
    return synced
