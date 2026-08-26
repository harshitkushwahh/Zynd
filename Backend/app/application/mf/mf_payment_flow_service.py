"""User-facing payment polling: advance ONDC pipeline and abandon unpaid checkouts."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.mf_lumpsum_reconciliation_service import (
    reconcile_checkout_payment,
    reconcile_order_payment,
)
from app.application.mf.mf_ondc_order_service import (
    _load_checkout_orders,
    submit_pending_cart_checkout,
    submit_pending_order,
)
from app.application.mf.mf_order_service import TERMINAL_STATUSES, _record_order_event
from app.core.config import get_settings
from app.infrastructure.mf.fp_payment_client import is_payment_success_status
from app.infrastructure.persistence.mf_transaction_models import (
    MfCheckout,
    MfCheckoutStatus,
    MfCheckoutType,
    MfOrder,
    MfOrderStatus,
)

_ABANDONABLE_ORDER_STATUSES = {
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
    if not _ondc_gateway_enabled():
        return False

    if order.status == MfOrderStatus.pending:
        if await submit_pending_order(session, order, user_ip=user_ip):
            pass

    result = await reconcile_order_payment(session, order, user_ip=user_ip)
    return bool(result.get("repaired") or result.get("advanced"))


async def advance_checkout_for_payment(
    session: AsyncSession,
    checkout: MfCheckout,
    *,
    user_ip: str | None = None,
) -> bool:
    if not _ondc_gateway_enabled():
        return False

    orders = await _load_checkout_orders(session, checkout.id)

    if checkout.status == MfCheckoutStatus.pending and orders and all(
        order.status == MfOrderStatus.pending for order in orders
    ):
        if checkout.checkout_type == MfCheckoutType.cart:
            await submit_pending_cart_checkout(session, checkout, orders, user_ip=user_ip)
        else:
            for order in orders:
                await submit_pending_order(session, order, user_ip=user_ip)

    result = await reconcile_checkout_payment(session, checkout, user_ip=user_ip)
    return bool(result.get("repaired") or result.get("advanced"))


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


async def confirm_order_payment_return(
    session: AsyncSession,
    order: MfOrder,
    *,
    user_ip: str | None = None,
) -> bool:
    """Sync/advance ONDC payment pipeline after investor returns from the gateway (never cancels)."""
    result = await reconcile_order_payment(session, order, user_ip=user_ip)
    return bool(result.get("repaired") or result.get("advanced") or result.get("outcome") == "success")


async def confirm_checkout_payment_return(
    session: AsyncSession,
    checkout: MfCheckout,
    *,
    user_ip: str | None = None,
) -> bool:
    result = await reconcile_checkout_payment(session, checkout, user_ip=user_ip)
    return bool(result.get("repaired") or result.get("advanced") or result.get("outcome") == "success")


async def abandon_unpaid_order_payment(session: AsyncSession, order: MfOrder) -> bool:
    if order.status not in _ABANDONABLE_ORDER_STATUSES:
        return False

    checkout = await session.get(MfCheckout, order.checkout_id) if order.checkout_id else None
    if checkout:
        reconcile = await reconcile_checkout_payment(session, checkout)
    else:
        reconcile = await reconcile_order_payment(session, order)
    if reconcile.get("repaired") or is_payment_success_status(reconcile.get("fp_payment_status")):
        return False
    await session.refresh(order)
    if order.status not in _ABANDONABLE_ORDER_STATUSES:
        return False

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

    reconcile = await reconcile_checkout_payment(session, checkout)
    if reconcile.get("repaired") or is_payment_success_status(reconcile.get("fp_payment_status")):
        return False
    await session.refresh(checkout)
    if checkout.status not in _ABANDONABLE_CHECKOUT_STATUSES:
        return False

    return await _cancel_checkout_orders(session, checkout, source="USER")
