from __future__ import annotations

import logging
import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.catalog_governance_service import is_product_investable
from app.application.mf.catalog_lifecycle_service import is_catalog_eligible
from app.application.mf.mf_order_errors import MfOrderError
from app.application.investor.investor_profile_service import ensure_pending_investor_profile_for_payment
from app.infrastructure.persistence.investor_models import InvestorProfileStatus, InvestorProvisionTrigger
from app.infrastructure.persistence.mf_models import FundAmc, MutualFund, Product, ProductLifecycleStatus
from app.infrastructure.persistence.mf_transaction_models import (
    MfInvestmentAccount,
    MfInvestmentAccountStatus,
    MfOrder,
    MfOrderEvent,
    MfOrderStatus,
    MfOrderType,
)

logger = logging.getLogger(__name__)

TERMINAL_STATUSES = {
    MfOrderStatus.succeeded,
    MfOrderStatus.failed,
    MfOrderStatus.cancelled,
}

FP_SUCCESS_STATES = {"successful", "succeeded", "completed", "confirmed"}
FP_FAILURE_STATES = {"failed", "cancelled", "rejected", "expired"}
FP_PAYMENT_PENDING_STATES = {"pending", "payment_pending", "awaiting_payment", "created"}


async def get_or_create_mf_investment_account(session: AsyncSession, *, user_id: uuid.UUID) -> MfInvestmentAccount:
    existing = await session.scalar(
        select(MfInvestmentAccount).where(MfInvestmentAccount.user_id == user_id)
    )
    if existing:
        return existing
    account = MfInvestmentAccount(user_id=user_id, status=MfInvestmentAccountStatus.pending)
    session.add(account)
    await session.flush()
    return account


async def _load_order_context(
    session: AsyncSession,
    *,
    product_id: uuid.UUID,
) -> tuple[Product, MutualFund, FundAmc]:
    row = (
        await session.execute(
            select(Product, MutualFund, FundAmc)
            .join(MutualFund, MutualFund.product_id == Product.id)
            .join(FundAmc, FundAmc.id == MutualFund.amc_id)
            .where(Product.id == product_id)
        )
    ).first()
    if not row:
        raise MfOrderError(code="fund_not_found", message="Fund not found", status_code=404)
    product, fund, amc = row
    if product.lifecycle_status != ProductLifecycleStatus.active:
        raise MfOrderError(code="fund_not_investable", message="Fund is not available for investment")
    if not is_product_investable(product=product, fund=fund, amc=amc):
        raise MfOrderError(code="fund_not_investable", message="Fund is not available for investment")
    if not is_catalog_eligible(
        amc_active=amc.is_active,
        fund_active=fund.is_active,
        fp_oms_purchase_allowed=fund.fp_oms_purchase_allowed,
        fp_oms_active=fund.fp_oms_active,
    ):
        raise MfOrderError(code="fund_not_investable", message="Fund is not available for investment")
    if not fund.fp_scheme_id:
        raise MfOrderError(code="scheme_not_ready", message="Scheme is not synced for orders yet")
    return product, fund, amc


async def create_lumpsum_order(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    product_id: uuid.UUID,
    amount_inr: Decimal,
    idempotency_key: str,
) -> MfOrder:
    if amount_inr <= 0:
        raise MfOrderError(code="invalid_amount", message="Amount must be positive")

    existing = await session.scalar(select(MfOrder).where(MfOrder.idempotency_key == idempotency_key))
    if existing:
        if existing.user_id != user_id:
            raise MfOrderError(code="idempotency_conflict", message="Idempotency key already used", status_code=409)
        return existing

    product, fund, _amc = await _load_order_context(session, product_id=product_id)
    min_amount = fund.min_lumpsum_amount
    if min_amount is not None and amount_inr < min_amount:
        raise MfOrderError(
            code="below_minimum",
            message=f"Minimum lumpsum amount is INR {min_amount}",
        )

    profile = await ensure_pending_investor_profile_for_payment(session, user_id=user_id)
    profile.provision_trigger = InvestorProvisionTrigger.mf_order
    mfia = await get_or_create_mf_investment_account(session, user_id=user_id)

    order = MfOrder(
        user_id=user_id,
        product_id=product.id,
        fund_id=fund.id,
        mf_investment_account_id=mfia.id,
        order_type=MfOrderType.lumpsum,
        amount_inr=amount_inr,
        status=MfOrderStatus.pending,
        fp_scheme_id=fund.fp_scheme_id,
        idempotency_key=idempotency_key,
        metadata_={
            "investor_profile_status": profile.status.value,
            "mfia_status": mfia.status.value,
        },
    )
    session.add(order)
    await session.flush()
    await _record_order_event(session, order, from_status=None, to_status=order.status.value)
    return order


async def list_user_orders(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    limit: int = 50,
) -> list[MfOrder]:
    result = await session.execute(
        select(MfOrder)
        .where(MfOrder.user_id == user_id)
        .order_by(MfOrder.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars())


async def get_user_order(session: AsyncSession, *, user_id: uuid.UUID, order_id: uuid.UUID) -> MfOrder | None:
    order = await session.get(MfOrder, order_id)
    if not order or order.user_id != user_id:
        return None
    return order


async def _record_order_event(
    session: AsyncSession,
    order: MfOrder,
    *,
    from_status: str | None,
    to_status: str,
    source: str = "SYSTEM",
    payload: dict | None = None,
) -> None:
    session.add(
        MfOrderEvent(
            order_id=order.id,
            from_status=from_status,
            to_status=to_status,
            source=source,
            payload=payload,
        )
    )


def serialize_order(order: MfOrder, *, product_name: str | None = None) -> dict:
    return {
        "order_id": str(order.id),
        "product_id": str(order.product_id),
        "product_name": product_name,
        "order_type": order.order_type.value,
        "amount_inr": float(order.amount_inr),
        "status": order.status.value,
        "fp_purchase_id": order.fp_purchase_id,
        "fp_state": order.fp_state,
        "failure_code": order.failure_code,
        "failure_reason": order.failure_reason,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "submitted_at": order.submitted_at.isoformat() if order.submitted_at else None,
        "settled_at": order.settled_at.isoformat() if order.settled_at else None,
    }
