from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.mf_order_service import TERMINAL_STATUSES, _record_order_event, get_or_create_mf_investment_account
from app.application.referral.referral_investment_service import record_referral_investment_activity
from app.core.config import get_settings
from app.infrastructure.mf.fp_oms_client import create_mf_investment_account, create_mf_purchase, get_mf_purchase
from app.infrastructure.persistence.investor_models import InvestorProfile, InvestorProfileStatus
from app.infrastructure.persistence.mf_transaction_models import (
    MfInvestmentAccountStatus,
    MfOrder,
    MfOrderStatus,
)
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.referral_models import ReferralInvestmentProduct

logger = logging.getLogger(__name__)

FP_SUCCESS_STATES = {"successful", "succeeded", "completed", "confirmed"}
FP_FAILURE_STATES = {"failed", "cancelled", "rejected", "expired"}
FP_PAYMENT_PENDING_STATES = {"pending", "payment_pending", "awaiting_payment", "created", "submitted"}


async def _ensure_fp_mfia(session: AsyncSession, *, user_id, mfia) -> str | None:
    if mfia.fp_mfia_id and mfia.status == MfInvestmentAccountStatus.active:
        return mfia.fp_mfia_id

    profile = await session.get(InvestorProfile, user_id)
    if not profile or profile.status != InvestorProfileStatus.active or not profile.external_profile_id:
        return None

    settings = get_settings()
    if not settings.resolved_fp_enabled:
        stub_id = f"stub-mfia-{user_id}"
        mfia.fp_mfia_id = stub_id
        mfia.status = MfInvestmentAccountStatus.active
        await session.flush()
        return stub_id

    result = await create_mf_investment_account(investor_profile_id=profile.external_profile_id)
    fp_mfia_id = result.get("fp_mfia_id")
    if not fp_mfia_id:
        mfia.status = MfInvestmentAccountStatus.failed
        mfia.failure_reason = "Cybrilla did not return mf_investment_account id"
        await session.flush()
        return None

    mfia.fp_mfia_id = fp_mfia_id
    mfia.status = MfInvestmentAccountStatus.active
    await session.flush()
    return fp_mfia_id


def _map_fp_state(fp_state: str | None) -> MfOrderStatus:
    normalized = (fp_state or "").lower()
    if normalized in FP_SUCCESS_STATES:
        return MfOrderStatus.succeeded
    if normalized in FP_FAILURE_STATES:
        return MfOrderStatus.failed
    if normalized in FP_PAYMENT_PENDING_STATES:
        return MfOrderStatus.payment_pending
    return MfOrderStatus.processing


async def submit_pending_order(session: AsyncSession, order: MfOrder, *, user_ip: str | None = None) -> bool:
    if order.status != MfOrderStatus.pending:
        return False

    mfia = await get_or_create_mf_investment_account(session, user_id=order.user_id)
    order.mf_investment_account_id = mfia.id
    fp_mfia_id = await _ensure_fp_mfia(session, user_id=order.user_id, mfia=mfia)
    if not fp_mfia_id or not order.fp_scheme_id:
        return False

    try:
        result = await create_mf_purchase(
            fp_mfia_id=fp_mfia_id,
            scheme=order.fp_scheme_id,
            amount_inr=float(order.amount_inr),
            user_ip=user_ip,
            gateway=get_settings().zynd_mf_order_payment_gateway,
        )
    except Exception as exc:
        logger.exception("MF purchase submit failed order=%s", order.id)
        previous = order.status.value
        order.status = MfOrderStatus.failed
        order.failure_code = "fp_submit_failed"
        order.failure_reason = str(exc)
        await _record_order_event(
            session,
            order,
            from_status=previous,
            to_status=order.status.value,
            source="WORKER",
            payload={"error": str(exc)},
        )
        return True

    previous = order.status.value
    order.fp_purchase_id = result.get("fp_purchase_id")
    order.fp_state = result.get("state")
    order.status = _map_fp_state(order.fp_state)
    if order.status == MfOrderStatus.payment_pending:
        order.status = MfOrderStatus.submitted
    order.submitted_at = datetime.now(timezone.utc)
    await _record_order_event(
        session,
        order,
        from_status=previous,
        to_status=order.status.value,
        source="WORKER",
        payload={"fp_purchase_id": order.fp_purchase_id, "fp_state": order.fp_state},
    )
    return True


async def sync_order_from_fp(session: AsyncSession, order: MfOrder) -> bool:
    if order.status in TERMINAL_STATUSES or not order.fp_purchase_id:
        return False

    payload = await get_mf_purchase(order.fp_purchase_id)
    fp_state = payload.get("state") or (payload.get("data") or {}).get("state")
    mapped = _map_fp_state(str(fp_state) if fp_state else None)
    if mapped == order.status and fp_state == order.fp_state:
        return False

    previous = order.status.value
    order.fp_state = str(fp_state) if fp_state else order.fp_state
    order.status = mapped
    if mapped == MfOrderStatus.succeeded:
        order.settled_at = datetime.now(timezone.utc)
        user = await session.get(User, order.user_id)
        if user:
            await record_referral_investment_activity(
                session,
                user=user,
                product=ReferralInvestmentProduct.mutual_fund,
                amount_inr=int(order.amount_inr),
            )
    elif mapped == MfOrderStatus.failed:
        order.failure_code = "fp_terminal_failed"
        order.failure_reason = str(fp_state)

    await _record_order_event(
        session,
        order,
        from_status=previous,
        to_status=order.status.value,
        source="WORKER",
        payload={"fp_state": order.fp_state},
    )
    return True


async def process_pending_orders(session: AsyncSession, *, batch_size: int = 20) -> dict[str, int]:
    orders = list(
        (
            await session.execute(
                select(MfOrder)
                .where(MfOrder.status == MfOrderStatus.pending)
                .order_by(MfOrder.created_at)
                .limit(batch_size)
            )
        ).scalars()
    )
    submitted = skipped = 0
    for order in orders:
        changed = await submit_pending_order(session, order)
        if changed:
            submitted += 1
        else:
            skipped += 1
    return {"processed": len(orders), "submitted": submitted, "skipped": skipped}


async def sync_open_orders(session: AsyncSession, *, batch_size: int = 50) -> dict[str, int]:
    orders = list(
        (
            await session.execute(
                select(MfOrder)
                .where(
                    MfOrder.fp_purchase_id.is_not(None),
                    MfOrder.status.not_in(list(TERMINAL_STATUSES)),
                )
                .order_by(MfOrder.updated_at)
                .limit(batch_size)
            )
        ).scalars()
    )
    updated = 0
    for order in orders:
        if await sync_order_from_fp(session, order):
            updated += 1
    return {"processed": len(orders), "updated": updated}
