from __future__ import annotations

import logging
import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.investor.investor_bank_account_resolver import (
    bank_account_metadata_snapshot,
    resolve_payment_bank_account,
)
from app.application.mf.catalog_governance_service import is_product_investable
from app.application.mf.catalog_lifecycle_service import is_catalog_eligible
from app.application.goals.errors import GoalError
from app.application.goals.goal_funding_service import apply_family_goal_metadata, validate_family_goal_link
from app.application.investor.investor_profile_service import ensure_pending_investor_profile_for_payment
from app.application.mf.mf_order_errors import MfOrderError
from app.application.mf.public_asset_service import resolve_amc_logo_url
from app.core.config import get_settings
from app.infrastructure.persistence.investor_models import InvestorProfileStatus, InvestorProvisionTrigger
from app.infrastructure.persistence.mf_models import FundAmc, MutualFund, Product, ProductLifecycleStatus
from app.infrastructure.persistence.mf_transaction_models import (
    MfCheckout,
    MfCheckoutStatus,
    MfCheckoutType,
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
    user_ip: str | None = None,
    bank_account_id: uuid.UUID | None = None,
    family_goal_id: uuid.UUID | None = None,
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

    profile = await ensure_pending_investor_profile_for_payment(
        session,
        user_id=user_id,
        provision_trigger=InvestorProvisionTrigger.mf_order,
    )
    payout_bank = await resolve_payment_bank_account(
        session,
        user_id=user_id,
        bank_account_id=bank_account_id,
    )
    mfia = await get_or_create_mf_investment_account(session, user_id=user_id)
    try:
        linked_goal = await validate_family_goal_link(session, user_id=user_id, family_goal_id=family_goal_id)
    except GoalError as exc:
        raise MfOrderError(code=exc.code, message=exc.message, status_code=exc.status_code) from exc

    checkout = MfCheckout(
        user_id=user_id,
        checkout_type=MfCheckoutType.single,
        status=MfCheckoutStatus.pending,
        total_amount_inr=amount_inr,
        idempotency_key=idempotency_key,
        metadata_=bank_account_metadata_snapshot(payout_bank),
    )
    session.add(checkout)
    await session.flush()

    order = MfOrder(
        user_id=user_id,
        product_id=product.id,
        fund_id=fund.id,
        mf_investment_account_id=mfia.id,
        checkout_id=checkout.id,
        line_index=0,
        order_type=MfOrderType.lumpsum,
        amount_inr=amount_inr,
        status=MfOrderStatus.pending,
        fp_scheme_id=fund.fp_scheme_id,
        idempotency_key=idempotency_key,
        metadata_={
            "investor_profile_status": profile.status.value,
            "mfia_status": mfia.status.value,
            "user_ip": user_ip,
            **(
                apply_family_goal_metadata({}, family_goal_id=linked_goal.id)
                if linked_goal
                else {}
            ),
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


async def get_user_order_journey(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    order_id: uuid.UUID,
) -> dict | None:
    order = await get_user_order(session, user_id=user_id, order_id=order_id)
    if not order:
        return None

    events = list(
        (
            await session.execute(
                select(MfOrderEvent)
                .where(MfOrderEvent.order_id == order.id)
                .order_by(MfOrderEvent.created_at)
            )
        ).scalars()
    )
    product = await session.get(Product, order.product_id)
    amc_names, amc_logos = await load_order_fund_metadata(session, [order])
    checkout = await session.get(MfCheckout, order.checkout_id) if order.checkout_id else None

    return {
        "order": serialize_order(
            order,
            product_name=product.name if product else None,
            checkout=checkout,
            amc_name=amc_names.get(order.fund_id),
            amc_logo_url=amc_logos.get(order.fund_id),
        ),
        "events": [
            {
                "from_status": event.from_status,
                "to_status": event.to_status,
                "source": event.source,
                "payload": event.payload,
                "created_at": event.created_at.isoformat() if event.created_at else None,
            }
            for event in events
        ],
    }


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


def _derive_next_action(*, status: str, payment_url: str | None) -> str:
    if status == "PENDING":
        return "wait_processing"
    if status == "PROCESSING":
        return "wait_review"
    if status == "PAYMENT_PENDING":
        return "wait_payment_setup"
    if status == "SUBMITTED":
        return "pay_upi" if payment_url else "wait_payment_link"
    if status == "SUCCEEDED":
        return "complete"
    if status in {"FAILED", "CANCELLED"}:
        return "failed"
    return "wait_processing"


async def load_order_fund_metadata(
    session: AsyncSession,
    orders: list[MfOrder],
) -> tuple[dict[int, str], dict[int, str | None]]:
    fund_ids = {order.fund_id for order in orders}
    if not fund_ids:
        return {}, {}

    settings = get_settings()
    result = await session.execute(
        select(MutualFund.id, FundAmc.name, FundAmc.logo_url, FundAmc.slug)
        .join(FundAmc, MutualFund.amc_id == FundAmc.id)
        .where(MutualFund.id.in_(fund_ids))
    )
    amc_names: dict[int, str] = {}
    amc_logos: dict[int, str | None] = {}
    for fund_id, name, logo_url, slug in result:
        amc_names[fund_id] = name
        amc_logos[fund_id] = resolve_amc_logo_url(logo_url, slug, settings)
    return amc_names, amc_logos


def serialize_order(
    order: MfOrder,
    *,
    product_name: str | None = None,
    checkout: MfCheckout | None = None,
    amc_name: str | None = None,
    amc_logo_url: str | None = None,
) -> dict:
    payment_url = checkout.token_url if checkout else None
    metadata = checkout.metadata_ if checkout and isinstance(checkout.metadata_, dict) else {}
    payload = {
        "order_id": str(order.id),
        "checkout_id": str(order.checkout_id) if order.checkout_id else None,
        "product_id": str(order.product_id),
        "product_name": product_name,
        "amc_name": amc_name,
        "amc_logo_url": amc_logo_url,
        "order_type": order.order_type.value,
        "amount_inr": float(order.amount_inr),
        "status": order.status.value,
        "fp_purchase_id": order.fp_purchase_id,
        "fp_purchase_old_id": order.fp_purchase_old_id,
        "fp_state": order.fp_state,
        "payment_url": payment_url,
        "next_action": _derive_next_action(status=order.status.value, payment_url=payment_url),
        "failure_code": order.failure_code,
        "failure_reason": order.failure_reason,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "submitted_at": order.submitted_at.isoformat() if order.submitted_at else None,
        "settled_at": order.settled_at.isoformat() if order.settled_at else None,
    }
    if metadata.get("investor_bank_account_id") or metadata.get("payout_bank_account_masked"):
        payload["payout_bank_account_id"] = metadata.get("investor_bank_account_id")
        payload["payout_bank_account_masked"] = metadata.get("payout_bank_account_masked")
        payload["payout_bank_ifsc_code"] = metadata.get("payout_bank_ifsc_code")
        payload["payout_bank_name"] = metadata.get("payout_bank_name")
    return payload
