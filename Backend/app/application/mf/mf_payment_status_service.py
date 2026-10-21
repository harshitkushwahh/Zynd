"""Checkout and order payment polling — single path for Finprim reconcile + HTTP DTOs."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.mf.schemas import MfCheckoutResponse, MfOrderResponse, MfPaymentStatusResponse
from app.api.v1.mf._router_helpers import _order_response as order_response, _payment_status_message as payment_status_message
from app.application.mf.mf_cart_service import get_user_checkout, serialize_checkout
from app.application.mf.mf_lumpsum_reconciliation_service import (
    reconcile_checkout_payment,
    reconcile_order_payment,
)
from app.application.mf.mf_order_service import get_user_order
from app.application.mf.mf_payment_flow_service import (
    abandon_unpaid_checkout_payment,
    abandon_unpaid_order_payment,
    confirm_checkout_payment_return,
    confirm_order_payment_return,
)
from app.infrastructure.persistence.mf_models import Product


async def _product_names_for_orders(db: AsyncSession, orders) -> dict:
    product_ids = {order.product_id for order in orders}
    if not product_ids:
        return {}
    return {
        row.id: row.name
        for row in (await db.execute(select(Product).where(Product.id.in_(product_ids)))).scalars()
    }


async def get_checkout_payment_status(
    db: AsyncSession,
    *,
    user_id: UUID,
    checkout_id: UUID,
    user_ip: str | None,
) -> MfPaymentStatusResponse:
    result = await get_user_checkout(db, user_id=user_id, checkout_id=checkout_id)
    if not result:
        raise LookupError("checkout_not_found")
    checkout, orders = result
    reconcile = await reconcile_checkout_payment(
        db,
        checkout,
        user_ip=user_ip,
        payment_poll=True,
    )
    products = await _product_names_for_orders(db, orders)
    return MfPaymentStatusResponse(
        outcome=reconcile["outcome"],
        fp_payment_status=reconcile.get("fp_payment_status"),
        repaired=bool(reconcile.get("repaired")),
        message=payment_status_message(reconcile["outcome"]),
        checkout=MfCheckoutResponse(**serialize_checkout(checkout, orders, product_names=products)),
    )


async def confirm_checkout_payment_return_for_user(
    db: AsyncSession,
    *,
    user_id: UUID,
    checkout_id: UUID,
    user_ip: str | None,
) -> MfCheckoutResponse:
    result = await get_user_checkout(db, user_id=user_id, checkout_id=checkout_id)
    if not result:
        raise LookupError("checkout_not_found")
    checkout, orders = result
    await confirm_checkout_payment_return(db, checkout, user_ip=user_ip)
    products = await _product_names_for_orders(db, orders)
    return MfCheckoutResponse(**serialize_checkout(checkout, orders, product_names=products))


async def abandon_checkout_payment_for_user(
    db: AsyncSession,
    *,
    user_id: UUID,
    checkout_id: UUID,
) -> MfCheckoutResponse:
    result = await get_user_checkout(db, user_id=user_id, checkout_id=checkout_id)
    if not result:
        raise LookupError("checkout_not_found")
    checkout, orders = result
    if not await abandon_unpaid_checkout_payment(db, checkout_id):
        raise ValueError("cannot_abandon")
    products = await _product_names_for_orders(db, orders)
    return MfCheckoutResponse(**serialize_checkout(checkout, orders, product_names=products))


async def get_order_payment_status(
    db: AsyncSession,
    *,
    user_id: UUID,
    order_id: UUID,
    user_ip: str | None,
) -> MfPaymentStatusResponse:
    order = await get_user_order(db, user_id=user_id, order_id=order_id)
    if not order:
        raise LookupError("order_not_found")
    reconcile = await reconcile_order_payment(
        db,
        order,
        user_ip=user_ip,
        force=False,
        payment_poll=True,
    )
    product = await db.get(Product, order.product_id)
    return MfPaymentStatusResponse(
        outcome=reconcile["outcome"],
        fp_payment_status=reconcile.get("fp_payment_status"),
        repaired=bool(reconcile.get("repaired")),
        message=payment_status_message(reconcile["outcome"]),
        order=await order_response(db, order, product_name=product.name if product else None),
    )


async def confirm_order_payment_return_for_user(
    db: AsyncSession,
    *,
    user_id: UUID,
    order_id: UUID,
    user_ip: str | None,
) -> MfOrderResponse:
    order = await get_user_order(db, user_id=user_id, order_id=order_id)
    if not order:
        raise LookupError("order_not_found")
    await confirm_order_payment_return(db, order, user_ip=user_ip)
    product = await db.get(Product, order.product_id)
    return await order_response(db, order, product_name=product.name if product else None)


async def abandon_order_payment_for_user(
    db: AsyncSession,
    *,
    user_id: UUID,
    order_id: UUID,
) -> MfOrderResponse:
    order = await get_user_order(db, user_id=user_id, order_id=order_id)
    if not order:
        raise LookupError("order_not_found")
    if not await abandon_unpaid_order_payment(db, order):
        raise ValueError("cannot_abandon")
    product = await db.get(Product, order.product_id)
    return await order_response(db, order, product_name=product.name if product else None)
