"""User-facing payment polling: advance ONDC pipeline and abandon unpaid checkouts."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.mf_ondc_order_service import (
    _load_checkout_orders,
    advance_ondc_cart_checkout,
    advance_ondc_order,
    submit_pending_cart_checkout,
    submit_pending_order,
    sync_order_from_fp,
)
from app.application.mf.mf_order_service import TERMINAL_STATUSES, _record_order_event
from app.core.config import get_settings
from app.infrastructure.persistence.mf_transaction_models import (
    MfCheckout,
    MfCheckoutStatus,
    MfCheckoutType,
    MfOrder,
    MfOrderStatus,
)

_ABANDONABLE_ORDER_STATUSES = {
    MfOrderStatus.submitted,
    MfOrderStatus.payment_pending,
    MfOrderStatus.processing,
}
_ABANDONABLE_CHECKOUT_STATUSES = {
    MfCheckoutStatus.submitted,
    MfCheckoutStatus.payment_pending,
    MfCheckoutStatus.processing,
}


def _ondc_gateway_enabled() -> bool:
    return get_settings().zynd_mf_order_payment_gateway.strip().lower() == "ondc"


async def advance_order_for_payment(
    session: AsyncSession,
    order: MfOrder,
    *,
    user_ip: str | None = None,
) -> bool:
    if not _ondc_gateway_enabled() or order.status in TERMINAL_STATUSES:
        return False

    changed = False
    if order.status == MfOrderStatus.pending:
        if await submit_pending_order(session, order, user_ip=user_ip):
            changed = True

    if order.fp_purchase_id and order.status not in TERMINAL_STATUSES:
        if await sync_order_from_fp(session, order):
            changed = True
        if await advance_ondc_order(session, order):
            changed = True
    return changed


async def advance_checkout_for_payment(
    session: AsyncSession,
    checkout: MfCheckout,
    *,
    user_ip: str | None = None,
) -> bool:
    if not _ondc_gateway_enabled() or checkout.status in {
        MfCheckoutStatus.succeeded,
        MfCheckoutStatus.failed,
        MfCheckoutStatus.cancelled,
    }:
        return False

    orders = await _load_checkout_orders(session, checkout.id)
    changed = False

    if checkout.status == MfCheckoutStatus.pending and orders and all(
        order.status == MfOrderStatus.pending for order in orders
    ):
        if checkout.checkout_type == MfCheckoutType.cart:
            if await submit_pending_cart_checkout(session, checkout, orders, user_ip=user_ip):
                changed = True
        else:
            for order in orders:
                if await submit_pending_order(session, order, user_ip=user_ip):
                    changed = True

    if checkout.checkout_type == MfCheckoutType.cart:
        if await advance_ondc_cart_checkout(session, checkout):
            changed = True
    else:
        for order in orders:
            if await advance_order_for_payment(session, order, user_ip=user_ip):
                changed = True
    return changed


async def _cancel_checkout_orders(
    session: AsyncSession,
    checkout: MfCheckout,
    *,
    source: str,
) -> bool:
    orders = await _load_checkout_orders(session, checkout.id)
    open_orders = [order for order in orders if order.status not in TERMINAL_STATUSES]
    if not open_orders and checkout.status not in _ABANDONABLE_CHECKOUT_STATUSES:
        return False

    if checkout.status in _ABANDONABLE_CHECKOUT_STATUSES:
        checkout.status = MfCheckoutStatus.cancelled
        checkout.token_url = None
        checkout.failure_code = checkout.failure_code or "payment_abandoned"
        checkout.failure_reason = checkout.failure_reason or "Payment was not completed"

    for order in open_orders:
        if order.status not in _ABANDONABLE_ORDER_STATUSES:
            continue
        previous = order.status.value
        order.status = MfOrderStatus.cancelled
        order.failure_code = order.failure_code or "payment_abandoned"
        order.failure_reason = order.failure_reason or "Payment was not completed"
        await _record_order_event(
            session,
            order,
            from_status=previous,
            to_status=order.status.value,
            source=source,
            payload={"reason": "payment_abandoned"},
        )
    await session.flush()
    return True


async def abandon_unpaid_order_payment(session: AsyncSession, order: MfOrder) -> bool:
    if order.status not in _ABANDONABLE_ORDER_STATUSES:
        return False
    checkout = await session.get(MfCheckout, order.checkout_id) if order.checkout_id else None
    if checkout:
        return await _cancel_checkout_orders(session, checkout, source="USER")

    previous = order.status.value
    order.status = MfOrderStatus.cancelled
    order.failure_code = order.failure_code or "payment_abandoned"
    order.failure_reason = order.failure_reason or "Payment was not completed"
    await _record_order_event(
        session,
        order,
        from_status=previous,
        to_status=order.status.value,
        source="USER",
        payload={"reason": "payment_abandoned"},
    )
    await session.flush()
    return True


async def abandon_unpaid_checkout_payment(session: AsyncSession, checkout_id: uuid.UUID) -> bool:
    checkout = await session.get(MfCheckout, checkout_id)
    if not checkout or checkout.status not in _ABANDONABLE_CHECKOUT_STATUSES:
        return False
    return await _cancel_checkout_orders(session, checkout, source="USER")
