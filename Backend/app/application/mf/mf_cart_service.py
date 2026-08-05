from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.goals.errors import GoalError
from app.application.goals.goal_funding_service import apply_family_goal_metadata, validate_family_goal_link
from app.application.investor.investor_bank_account_resolver import (
    bank_account_metadata_snapshot,
    resolve_payment_bank_account,
)
from app.application.mf.mf_mandate_service import create_mandate_for_user
from app.application.mf.mf_order_errors import MfOrderError
from app.application.mf.mf_order_service import (
    _derive_next_action,
    _load_order_context,
    _record_order_event,
    get_or_create_mf_investment_account,
)
from app.application.mf.mf_sip_plan_service import (
    _validate_installment_day,
    _validate_number_of_installments,
    create_sip_plan,
    default_installments,
)
from app.application.mf.public_asset_service import resolve_amc_logo_url
from app.application.investor.investor_profile_service import ensure_pending_investor_profile_for_payment
from app.core.config import get_settings
from app.infrastructure.persistence.investor_models import InvestorProvisionTrigger
from app.infrastructure.persistence.mf_models import FundAmc, MutualFund, Product
from app.infrastructure.persistence.mf_transaction_models import (
    MfCartInvestmentType,
    MfCartItem,
    MfCheckout,
    MfCheckoutStatus,
    MfCheckoutType,
    MfOrder,
    MfOrderStatus,
    MfOrderType,
    MfSipPlan,
)


def serialize_cart_item(
    item: MfCartItem,
    *,
    product_name: str | None = None,
    amc_name: str | None = None,
    amc_logo_url: str | None = None,
) -> dict:
    return {
        "product_id": str(item.product_id),
        "product_name": product_name,
        "fund_id": item.fund_id,
        "amc_name": amc_name,
        "amc_logo_url": amc_logo_url,
        "amount_inr": float(item.amount_inr),
        "investment_type": item.investment_type.value,
        "installment_day": item.installment_day,
        "frequency": item.frequency,
        "number_of_installments": item.number_of_installments,
        "fp_scheme_id": item.fp_scheme_id,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def serialize_checkout(
    checkout: MfCheckout,
    orders: list[MfOrder],
    *,
    product_names: dict[uuid.UUID, str] | None = None,
    payout_bank: dict[str, str] | None = None,
) -> dict:
    names = product_names or {}
    payment_url = checkout.token_url
    status = checkout.status.value
    metadata = checkout.metadata_ if isinstance(checkout.metadata_, dict) else {}
    if payout_bank:
        payload_bank_id = payout_bank.get("investor_bank_account_id")
        payload_bank_masked = payout_bank.get("payout_bank_account_masked")
        payload_bank_ifsc = payout_bank.get("payout_bank_ifsc_code")
        payload_bank_name = payout_bank.get("payout_bank_name")
    else:
        payload_bank_id = metadata.get("investor_bank_account_id")
        payload_bank_masked = metadata.get("payout_bank_account_masked")
        payload_bank_ifsc = metadata.get("payout_bank_ifsc_code")
        payload_bank_name = metadata.get("payout_bank_name")

    payload = {
        "checkout_id": str(checkout.id),
        "checkout_type": checkout.checkout_type.value,
        "status": status,
        "total_amount_inr": float(checkout.total_amount_inr),
        "payment_method": metadata.get("payment_method", "upi"),
        "payment_url": payment_url,
        "next_action": _derive_next_action(status=status, payment_url=payment_url),
        "fp_payment_id": checkout.fp_payment_id,
        "failure_code": checkout.failure_code,
        "failure_reason": checkout.failure_reason,
        "created_at": checkout.created_at.isoformat() if checkout.created_at else None,
        "orders": [
            {
                "order_id": str(order.id),
                "product_id": str(order.product_id),
                "product_name": names.get(order.product_id),
                "amount_inr": float(order.amount_inr),
                "status": order.status.value,
                "line_index": order.line_index,
                "fp_state": order.fp_state,
            }
            for order in sorted(orders, key=lambda row: row.line_index)
        ],
    }
    if payload_bank_id or payload_bank_masked or payload_bank_ifsc or payload_bank_name:
        payload["payout_bank_account_id"] = str(payload_bank_id) if payload_bank_id else None
        payload["payout_bank_account_masked"] = payload_bank_masked
        payload["payout_bank_ifsc_code"] = payload_bank_ifsc
        payload["payout_bank_name"] = payload_bank_name
    return payload


def _normalize_investment_type(value: str | MfCartInvestmentType) -> MfCartInvestmentType:
    if isinstance(value, MfCartInvestmentType):
        return value
    normalized = value.strip().lower()
    if normalized == MfCartInvestmentType.sip.value:
        return MfCartInvestmentType.sip
    return MfCartInvestmentType.lumpsum


async def list_cart_items(session: AsyncSession, *, user_id: uuid.UUID) -> list[MfCartItem]:
    result = await session.execute(
        select(MfCartItem)
        .where(MfCartItem.user_id == user_id)
        .order_by(MfCartItem.created_at)
    )
    return list(result.scalars())


async def _load_cart_fund_metadata(
    session: AsyncSession,
    items: list[MfCartItem],
) -> tuple[dict[int, str], dict[int, str | None]]:
    fund_ids = {item.fund_id for item in items}
    if not fund_ids:
        return {}, {}

    settings = get_settings()
    result = await session.execute(
        select(MutualFund.id, FundAmc.name, FundAmc.logo_url, FundAmc.slug).join(
            FundAmc, MutualFund.amc_id == FundAmc.id
        ).where(MutualFund.id.in_(fund_ids))
    )
    amc_names: dict[int, str] = {}
    amc_logos: dict[int, str | None] = {}
    for fund_id, name, logo_url, slug in result:
        amc_names[fund_id] = name
        amc_logos[fund_id] = resolve_amc_logo_url(logo_url, slug, settings)
    return amc_names, amc_logos


async def get_cart_summary(session: AsyncSession, *, user_id: uuid.UUID) -> dict:
    items = await list_cart_items(session, user_id=user_id)
    product_ids = {item.product_id for item in items}
    products = {
        row.id: row.name
        for row in (
            await session.execute(select(Product).where(Product.id.in_(product_ids)))
        ).scalars()
    } if product_ids else {}
    amc_names, amc_logos = await _load_cart_fund_metadata(session, items)

    serialized = [
        serialize_cart_item(
            item,
            product_name=products.get(item.product_id),
            amc_name=amc_names.get(item.fund_id),
            amc_logo_url=amc_logos.get(item.fund_id),
        )
        for item in items
    ]
    lumpsum_items = [row for row in serialized if row["investment_type"] == MfCartInvestmentType.lumpsum.value]
    sip_items = [row for row in serialized if row["investment_type"] == MfCartInvestmentType.sip.value]
    settings = get_settings()

    return {
        "items": serialized,
        "lumpsum_items": lumpsum_items,
        "sip_items": sip_items,
        "item_count": len(serialized),
        "lumpsum_item_count": len(lumpsum_items),
        "sip_item_count": len(sip_items),
        "total_amount_inr": sum(float(item.amount_inr) for item in items),
        "lumpsum_total_amount_inr": sum(row["amount_inr"] for row in lumpsum_items),
        "sip_total_amount_inr": sum(row["amount_inr"] for row in sip_items),
        "max_items": settings.zynd_mf_cart_max_items,
    }


async def upsert_cart_item(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    product_id: uuid.UUID,
    amount_inr: Decimal,
    investment_type: str | MfCartInvestmentType = MfCartInvestmentType.lumpsum,
    installment_day: int | None = None,
    frequency: str = "monthly",
    number_of_installments: int | None = None,
) -> MfCartItem:
    if amount_inr <= 0:
        raise MfOrderError(code="invalid_amount", message="Amount must be positive")

    cart_type = _normalize_investment_type(investment_type)
    settings = get_settings()
    product, fund, _amc = await _load_order_context(session, product_id=product_id)

    if cart_type == MfCartInvestmentType.sip:
        min_amount = fund.min_sip_amount
        if min_amount is not None and amount_inr < min_amount:
            raise MfOrderError(
                code="below_minimum",
                message=f"Minimum SIP amount is INR {min_amount}",
            )
        resolved_installment_day = _validate_installment_day(
            frequency=frequency,
            installment_day=installment_day,
        )
        resolved_installments = _validate_number_of_installments(number_of_installments)
    else:
        resolved_installment_day = None
        resolved_installments = None
        min_amount = fund.min_lumpsum_amount
        if min_amount is not None and amount_inr < min_amount:
            raise MfOrderError(
                code="below_minimum",
                message=f"Minimum lumpsum amount is INR {min_amount}",
            )

    existing_items = await list_cart_items(session, user_id=user_id)
    existing = next(
        (
            item
            for item in existing_items
            if item.product_id == product_id and item.investment_type == cart_type
        ),
        None,
    )
    if existing is None and len(existing_items) >= settings.zynd_mf_cart_max_items:
        raise MfOrderError(
            code="cart_full",
            message=f"Cart supports at most {settings.zynd_mf_cart_max_items} funds",
        )

    if existing:
        existing.amount_inr = amount_inr
        existing.fp_scheme_id = fund.fp_scheme_id
        if cart_type == MfCartInvestmentType.sip:
            existing.installment_day = resolved_installment_day
            existing.frequency = frequency
            existing.number_of_installments = resolved_installments
        await session.flush()
        return existing

    item = MfCartItem(
        user_id=user_id,
        product_id=product.id,
        fund_id=fund.id,
        amount_inr=amount_inr,
        investment_type=cart_type,
        installment_day=resolved_installment_day if cart_type == MfCartInvestmentType.sip else None,
        frequency=frequency if cart_type == MfCartInvestmentType.sip else "monthly",
        number_of_installments=resolved_installments if cart_type == MfCartInvestmentType.sip else None,
        fp_scheme_id=fund.fp_scheme_id,
    )
    session.add(item)
    await session.flush()
    return item


async def bulk_upsert_cart_items(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    items: list[tuple[uuid.UUID, Decimal]],
) -> None:
    if not items:
        raise MfOrderError(code="invalid_request", message="Add at least one fund")

    settings = get_settings()
    seen: set[uuid.UUID] = set()
    for product_id, _amount in items:
        if product_id in seen:
            raise MfOrderError(code="duplicate_fund", message="Duplicate funds in bulk cart request")
        seen.add(product_id)

    existing_items = await list_cart_items(session, user_id=user_id)
    existing_lumpsum_ids = {
        item.product_id for item in existing_items if item.investment_type == MfCartInvestmentType.lumpsum
    }
    new_count = sum(1 for product_id, _ in items if product_id not in existing_lumpsum_ids)
    if len(existing_items) + new_count > settings.zynd_mf_cart_max_items:
        raise MfOrderError(
            code="cart_full",
            message=f"Cart supports at most {settings.zynd_mf_cart_max_items} funds",
        )

    for product_id, amount_inr in items:
        await upsert_cart_item(
            session,
            user_id=user_id,
            product_id=product_id,
            amount_inr=amount_inr,
            investment_type=MfCartInvestmentType.lumpsum,
        )


async def remove_cart_item(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    product_id: uuid.UUID,
    investment_type: str | MfCartInvestmentType = MfCartInvestmentType.lumpsum,
) -> None:
    cart_type = _normalize_investment_type(investment_type)
    item = await session.scalar(
        select(MfCartItem).where(
            MfCartItem.user_id == user_id,
            MfCartItem.product_id == product_id,
            MfCartItem.investment_type == cart_type,
        )
    )
    if not item:
        raise MfOrderError(code="cart_item_not_found", message="Cart item not found", status_code=404)
    await session.delete(item)
    await session.flush()


async def clear_cart(session: AsyncSession, *, user_id: uuid.UUID) -> None:
    await session.execute(delete(MfCartItem).where(MfCartItem.user_id == user_id))


async def clear_lumpsum_cart(session: AsyncSession, *, user_id: uuid.UUID) -> None:
    await session.execute(
        delete(MfCartItem).where(
            MfCartItem.user_id == user_id,
            MfCartItem.investment_type == MfCartInvestmentType.lumpsum,
        )
    )


async def clear_sip_cart(session: AsyncSession, *, user_id: uuid.UUID) -> None:
    await session.execute(
        delete(MfCartItem).where(
            MfCartItem.user_id == user_id,
            MfCartItem.investment_type == MfCartInvestmentType.sip,
        )
    )


async def checkout_cart(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    idempotency_key: str,
    user_ip: str | None = None,
    bank_account_id: uuid.UUID | None = None,
    family_goal_id: uuid.UUID | None = None,
    payment_method: str = "upi",
) -> tuple[MfCheckout, list[MfOrder]]:
    existing = await session.scalar(select(MfCheckout).where(MfCheckout.idempotency_key == idempotency_key))
    if existing:
        if existing.user_id != user_id:
            raise MfOrderError(code="idempotency_conflict", message="Idempotency key already used", status_code=409)
        orders = list(
            (
                await session.execute(
                    select(MfOrder)
                    .where(MfOrder.checkout_id == existing.id)
                    .order_by(MfOrder.line_index)
                )
            ).scalars()
        )
        return existing, orders

    items = [
        item
        for item in await list_cart_items(session, user_id=user_id)
        if item.investment_type == MfCartInvestmentType.lumpsum
    ]
    if not items:
        raise MfOrderError(code="cart_empty", message="Add at least one lumpsum fund to the cart")

    total_amount = sum((item.amount_inr for item in items), start=Decimal("0"))
    payout_bank = await resolve_payment_bank_account(
        session,
        user_id=user_id,
        bank_account_id=bank_account_id,
    )
    profile = await ensure_pending_investor_profile_for_payment(
        session,
        user_id=user_id,
        provision_trigger=InvestorProvisionTrigger.mf_order,
    )
    mfia = await get_or_create_mf_investment_account(session, user_id=user_id)
    try:
        linked_goal = await validate_family_goal_link(session, user_id=user_id, family_goal_id=family_goal_id)
    except GoalError as exc:
        raise MfOrderError(code=exc.code, message=exc.message, status_code=exc.status_code) from exc

    checkout = MfCheckout(
        user_id=user_id,
        checkout_type=MfCheckoutType.cart,
        status=MfCheckoutStatus.pending,
        total_amount_inr=total_amount,
        idempotency_key=idempotency_key,
        metadata_={
            "user_ip": user_ip,
            "payment_method": payment_method,
            **bank_account_metadata_snapshot(payout_bank),
        },
    )
    session.add(checkout)
    await session.flush()

    orders: list[MfOrder] = []
    for line_index, item in enumerate(items):
        product, fund, _amc = await _load_order_context(session, product_id=item.product_id)
        min_amount = fund.min_lumpsum_amount
        if min_amount is not None and item.amount_inr < min_amount:
            raise MfOrderError(
                code="below_minimum",
                message=f"Minimum lumpsum amount is INR {min_amount} for {product.name}",
            )
        order = MfOrder(
            user_id=user_id,
            product_id=product.id,
            fund_id=fund.id,
            mf_investment_account_id=mfia.id,
            checkout_id=checkout.id,
            line_index=line_index,
            order_type=MfOrderType.lumpsum,
            amount_inr=item.amount_inr,
            status=MfOrderStatus.pending,
            fp_scheme_id=fund.fp_scheme_id,
            idempotency_key=f"{idempotency_key}:{line_index}",
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
        orders.append(order)

    await session.flush()
    for order in orders:
        await _record_order_event(session, order, from_status=None, to_status=order.status.value)

    await clear_lumpsum_cart(session, user_id=user_id)
    return checkout, orders


async def checkout_sip_cart(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    idempotency_key: str,
    user_ip: str | None = None,
    bank_account_id: uuid.UUID | None = None,
    family_goal_id: uuid.UUID | None = None,
    mandate_type: str = "upi",
) -> list[MfSipPlan]:
    items = [
        item
        for item in await list_cart_items(session, user_id=user_id)
        if item.investment_type == MfCartInvestmentType.sip
    ]
    if not items:
        raise MfOrderError(code="cart_empty", message="Add at least one SIP fund to the cart")

    max_amount = max(item.amount_inr for item in items)
    mandate = await create_mandate_for_user(
        session,
        user_id=user_id,
        idempotency_key=f"{idempotency_key}:mandate",
        installment_amount_inr=max_amount,
        bank_account_id=bank_account_id,
        mandate_type=mandate_type,
    )

    plans: list[MfSipPlan] = []
    for index, item in enumerate(items):
        plan = await create_sip_plan(
            session,
            user_id=user_id,
            product_id=item.product_id,
            amount_inr=item.amount_inr,
            frequency=item.frequency,
            installment_day=item.installment_day,
            number_of_installments=item.number_of_installments or default_installments(item.frequency),
            mandate_id=mandate.id,
            idempotency_key=f"{idempotency_key}:{index}",
            user_ip=user_ip,
            family_goal_id=family_goal_id,
            mandate_type=mandate_type,
        )
        plans.append(plan)

    await clear_sip_cart(session, user_id=user_id)
    return plans


async def get_user_checkout(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    checkout_id: uuid.UUID,
) -> tuple[MfCheckout, list[MfOrder]] | None:
    checkout = await session.get(MfCheckout, checkout_id)
    if not checkout or checkout.user_id != user_id:
        return None
    orders = list(
        (
            await session.execute(
                select(MfOrder).where(MfOrder.checkout_id == checkout.id).order_by(MfOrder.line_index)
            )
        ).scalars()
    )
    return checkout, orders
