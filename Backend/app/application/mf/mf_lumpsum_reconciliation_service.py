"""Unified lumpsum payment reconciliation (MultiPlus-style outcomes)."""

from __future__ import annotations

from typing import Any, Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.mf_ondc_order_service import (
    _load_checkout_orders,
    _ondc_checkout_metadata,
    _ondc_metadata,
    advance_ondc_cart_checkout,
    advance_ondc_order,
    sync_order_from_fp,
)
from app.application.mf.mf_order_service import TERMINAL_STATUSES, _record_order_event, order_payment_completed
from app.core.config import get_settings
from app.infrastructure.mf.fp_oms_client import extract_fp_state, get_mf_purchase
from app.infrastructure.mf.fp_payment_client import (
    extract_payment_status,
    get_payment,
    is_payment_failure_status,
    is_payment_pending_status,
    is_payment_success_status,
)
from app.infrastructure.persistence.mf_transaction_models import (
    MfCheckout,
    MfCheckoutStatus,
    MfCheckoutType,
    MfOrder,
    MfOrderStatus,
    MfOrderType,
)
from app.application.mf.mf_fp_state import (
    FP_FAILURE_STATES,
    FP_PAYMENT_PENDING_STATES,
    FP_PROCESSING_STATES,
    FP_SUBMITTED_STATES,
    FP_SUCCESS_STATES,
    map_fp_purchase_state,
    map_fp_purchase_state_to_checkout,
)

PaymentReconcileOutcome = Literal["success", "failed", "pending", "unclear"]

# Local cancellation reasons that can be reversed when Cybrilla payment succeeded.
_REPAIRABLE_CANCEL_FAILURE_CODES = frozenset({None, "payment_abandoned", "payment_expired"})


def _metadata_payment_succeeded(order: MfOrder) -> bool:
    ondc = _ondc_metadata(order)
    if not ondc.get("payment_success"):
        return False
    fp_payment_status = ondc.get("fp_payment_status")
    return bool(fp_payment_status and is_payment_success_status(str(fp_payment_status)))


def _is_sip_first_installment_order(order: MfOrder) -> bool:
    if order.order_type != MfOrderType.sip or order.checkout_id is not None:
        return False
    metadata = order.metadata_ if isinstance(order.metadata_, dict) else {}
    return metadata.get("sip_installment") == "first"


def _ondc_gateway_enabled() -> bool:
    return get_settings().zynd_mf_order_payment_gateway.strip().lower() == "ondc"


def _resolve_order_payment_id(order: MfOrder, checkout: MfCheckout | None = None) -> int | None:
    ondc = _ondc_metadata(order)
    payment_id = ondc.get("fp_payment_id")
    if payment_id is not None:
        try:
            return int(payment_id)
        except (TypeError, ValueError):
            pass
    if checkout and checkout.fp_payment_id is not None:
        return int(checkout.fp_payment_id)
    return None


def _resolve_checkout_payment_id(checkout: MfCheckout, orders: list[MfOrder]) -> int | None:
    if checkout.fp_payment_id is not None:
        return int(checkout.fp_payment_id)
    ondc = _ondc_checkout_metadata(checkout)
    payment_id = ondc.get("fp_payment_id")
    if payment_id is not None:
        try:
            return int(payment_id)
        except (TypeError, ValueError):
            pass
    for order in orders:
        resolved = _resolve_order_payment_id(order, checkout)
        if resolved is not None:
            return resolved
    return None


async def _fetch_fp_payment(payment_id: int | None) -> dict[str, Any] | None:
    if payment_id is None:
        return None
    try:
        return await get_payment(payment_id)
    except Exception:
        return None


async def _fetch_fp_payment_status(payment_id: int | None) -> str | None:
    payload = await _fetch_fp_payment(payment_id)
    if payload is None:
        return None
    return extract_payment_status(payload)


def _payment_amc_order_ids(payment_payload: dict[str, Any] | None) -> set[int]:
    if not payment_payload:
        return set()
    amc_order_ids = payment_payload.get("amc_order_ids") or []
    data = payment_payload.get("data")
    if isinstance(data, dict) and not amc_order_ids:
        amc_order_ids = data.get("amc_order_ids") or []
    covered: set[int] = set()
    for raw in amc_order_ids:
        try:
            covered.add(int(raw))
        except (TypeError, ValueError):
            continue
    return covered


def _purchase_state_ahead_of_payment(fp_state: str | None) -> bool:
    normalized = (fp_state or "").strip().lower()
    return normalized in FP_SUBMITTED_STATES | FP_PROCESSING_STATES | FP_SUCCESS_STATES


def _target_status_without_payment(
    *,
    fp_state: str | None,
    fp_payment_status: str | None,
    payment_id: int | None,
) -> MfOrderStatus:
    normalized_fp = (fp_state or "").strip().lower()

    if is_payment_failure_status(fp_payment_status):
        return MfOrderStatus.failed
    if normalized_fp in FP_FAILURE_STATES:
        return MfOrderStatus.failed

    if _purchase_state_ahead_of_payment(fp_state):
        if payment_id is None:
            # Review / setup has no PG row yet. Do not mark the order failed.
            if normalized_fp in FP_PROCESSING_STATES | FP_PAYMENT_PENDING_STATES:
                return map_fp_purchase_state(fp_state)
            if normalized_fp in FP_SUBMITTED_STATES:
                return MfOrderStatus.payment_pending
            return map_fp_purchase_state(fp_state)
        if is_payment_failure_status(fp_payment_status):
            return MfOrderStatus.failed
        return MfOrderStatus.payment_pending

    return map_fp_purchase_state(fp_state)


def _store_fp_payment_status(order: MfOrder, fp_payment_status: str | None) -> None:
    if fp_payment_status is None:
        return
    metadata = order.metadata_ if isinstance(order.metadata_, dict) else {}
    ondc = metadata.get("ondc")
    if not isinstance(ondc, dict):
        ondc = {}
    ondc["fp_payment_status"] = fp_payment_status
    metadata["ondc"] = ondc
    order.metadata_ = metadata


def payment_covers_order(payment_payload: dict[str, Any] | None, order: MfOrder) -> bool:
    if order.fp_purchase_old_id is None:
        return False
    try:
        old_id = int(order.fp_purchase_old_id)
    except (TypeError, ValueError):
        return False
    return old_id in _payment_amc_order_ids(payment_payload)


async def fetch_order_fp_truth(
    order: MfOrder,
    *,
    checkout: MfCheckout | None = None,
) -> dict[str, Any]:
    payment_id = _resolve_order_payment_id(order, checkout)
    payment_payload = await _fetch_fp_payment(payment_id)
    fp_payment_status = extract_payment_status(payment_payload) if payment_payload else None
    if fp_payment_status is None:
        stored_status = _ondc_metadata(order).get("fp_payment_status")
        if stored_status is not None:
            fp_payment_status = str(stored_status)
    covers_order = payment_covers_order(payment_payload, order)
    payment_succeeded = is_payment_success_status(fp_payment_status) and covers_order
    if not payment_succeeded and _metadata_payment_succeeded(order):
        payment_succeeded = True
        covers_order = True

    fp_state = order.fp_state
    if order.fp_purchase_id:
        try:
            purchase = await get_mf_purchase(order.fp_purchase_id)
            fp_state = extract_fp_state(purchase) or fp_state
        except Exception:
            pass

    if payment_succeeded:
        target_status = map_fp_purchase_state(fp_state)
        if target_status in {MfOrderStatus.submitted, MfOrderStatus.payment_pending}:
            target_status = MfOrderStatus.processing
    elif is_payment_failure_status(fp_payment_status) or (fp_state or "").strip().lower() in FP_FAILURE_STATES:
        target_status = MfOrderStatus.failed
    elif not payment_succeeded and (
        order.status
        in {
            MfOrderStatus.submitted,
            MfOrderStatus.processing,
            MfOrderStatus.succeeded,
        }
        or _purchase_state_ahead_of_payment(fp_state)
    ):
        target_status = _target_status_without_payment(
            fp_state=fp_state,
            fp_payment_status=fp_payment_status,
            payment_id=payment_id,
        )
    elif order.failure_code in _REPAIRABLE_CANCEL_FAILURE_CODES or order.status == MfOrderStatus.cancelled:
        target_status = MfOrderStatus.cancelled
    else:
        target_status = map_fp_purchase_state(fp_state)

    return {
        "payment_id": payment_id,
        "fp_payment_status": fp_payment_status,
        "payment_covers_order": covers_order,
        "fp_state": fp_state,
        "payment_succeeded": payment_succeeded,
        "target_status": target_status.value,
    }


async def apply_order_fp_truth(
    session: AsyncSession,
    order: MfOrder,
    *,
    checkout: MfCheckout | None = None,
    truth: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if order.order_type == MfOrderType.redemption:
        return {"changed": False}

    if truth is None:
        truth = await fetch_order_fp_truth(order, checkout=checkout)

    target = MfOrderStatus(truth["target_status"])
    fp_state_norm = (truth.get("fp_state") or "").strip().lower()
    # Cart checkout never runs this revert. Do not fail a one-time purchase
    # while Cybrilla is still reviewing or the payment link is not ready.
    if target in {MfOrderStatus.failed, MfOrderStatus.cancelled} and not truth.get("payment_succeeded"):
        if not is_payment_failure_status(truth.get("fp_payment_status")) and fp_state_norm not in FP_FAILURE_STATES:
            target = map_fp_purchase_state(truth.get("fp_state"))
            if target in {MfOrderStatus.failed, MfOrderStatus.cancelled}:
                target = MfOrderStatus.processing
    before = {
        "status": order.status.value,
        "fp_state": order.fp_state,
        "failure_code": order.failure_code,
    }

    changed = False
    if order.status != target or (truth["fp_state"] and order.fp_state != truth["fp_state"]):
        previous = order.status.value
        order.status = target
        if truth["fp_state"]:
            order.fp_state = truth["fp_state"]

        if truth["payment_succeeded"]:
            order.failure_code = None
            order.failure_reason = None
        elif target == MfOrderStatus.failed and not order.failure_code:
            fp_payment_status = truth.get("fp_payment_status")
            if is_payment_failure_status(fp_payment_status):
                order.failure_code = "payment_failed"
                order.failure_reason = f"Payment {fp_payment_status}".strip()
            else:
                order.failure_code = "payment_not_completed"
                order.failure_reason = "Payment was not completed"
        elif target == MfOrderStatus.cancelled and not order.failure_code:
            # payment_abandoned is reserved for explicit user abandon (abandon-payment API).
            order.failure_code = "payment_not_completed"
            order.failure_reason = "Payment was not completed"

        await _record_order_event(
            session,
            order,
            from_status=previous,
            to_status=order.status.value,
            source="RECONCILE",
            payload={
                "repair": "truth_sync" if truth["payment_succeeded"] else "truth_revert",
                "fp_payment_id": truth.get("payment_id"),
                "fp_payment_status": truth.get("fp_payment_status"),
                "payment_covers_order": truth.get("payment_covers_order"),
            },
        )
        changed = True

    _store_fp_payment_status(order, truth.get("fp_payment_status"))
    if changed or truth.get("fp_payment_status") is not None:
        await session.flush()

    return {
        **truth,
        "before": before,
        "after": {
            "status": order.status.value,
            "fp_state": order.fp_state,
            "failure_code": order.failure_code,
        },
        "changed": changed,
    }


async def try_repair_abandoned_paid_order(
    session: AsyncSession,
    order: MfOrder,
    *,
    checkout: MfCheckout | None = None,
    fp_payment_status: str | None = None,
) -> bool:
    if order.status != MfOrderStatus.cancelled:
        return False
    if order.failure_code not in _REPAIRABLE_CANCEL_FAILURE_CODES:
        return False

    payment_id = _resolve_order_payment_id(order, checkout)
    if payment_id is None:
        return False

    payment_payload = await _fetch_fp_payment(payment_id)
    if fp_payment_status is None:
        fp_payment_status = extract_payment_status(payment_payload) if payment_payload else None
    if not is_payment_success_status(fp_payment_status):
        return False
    if not payment_covers_order(payment_payload, order):
        return False

    target = MfOrderStatus.processing
    if order.fp_purchase_id:
        try:
            purchase = await get_mf_purchase(order.fp_purchase_id)
            fp_state = extract_fp_state(purchase)
            mapped = map_fp_purchase_state(fp_state)
            if mapped != MfOrderStatus.cancelled:
                target = mapped
                order.fp_state = fp_state or order.fp_state
        except Exception:
            pass

    previous = order.status.value
    order.status = target
    order.failure_code = None
    order.failure_reason = None

    if checkout and checkout.status == MfCheckoutStatus.cancelled:
        mapped_checkout = map_fp_purchase_state_to_checkout(order.fp_state)
        checkout.status = (
            mapped_checkout
            if mapped_checkout != MfCheckoutStatus.cancelled
            else MfCheckoutStatus.processing
        )
        checkout.failure_code = None
        checkout.failure_reason = None

    await _record_order_event(
        session,
        order,
        from_status=previous,
        to_status=order.status.value,
        source="RECONCILE",
        payload={"repair": "abandoned_paid", "fp_payment_id": payment_id},
    )
    await session.flush()
    return True


async def try_repair_abandoned_paid_checkout(
    session: AsyncSession,
    checkout: MfCheckout,
    orders: list[MfOrder],
    *,
    fp_payment_status: str | None = None,
) -> bool:
    if checkout.status != MfCheckoutStatus.cancelled:
        return False
    if checkout.failure_code not in _REPAIRABLE_CANCEL_FAILURE_CODES:
        return False

    payment_id = _resolve_checkout_payment_id(checkout, orders)
    if payment_id is None:
        return False

    if fp_payment_status is None:
        fp_payment_status = await _fetch_fp_payment_status(payment_id)
    if not is_payment_success_status(fp_payment_status):
        return False

    checkout.status = MfCheckoutStatus.processing
    checkout.failure_code = None
    checkout.failure_reason = None
    await session.flush()

    repaired_any = False
    for order in orders:
        if await try_repair_abandoned_paid_order(
            session,
            order,
            checkout=checkout,
            fp_payment_status=fp_payment_status,
        ):
            repaired_any = True
    return repaired_any


def classify_order_payment_outcome(
    order: MfOrder,
    *,
    fp_payment_status: str | None,
    repaired: bool,
) -> PaymentReconcileOutcome:
    if order.status == MfOrderStatus.succeeded:
        return "success"
    if order.status == MfOrderStatus.failed:
        return "failed"

    if order.status == MfOrderStatus.cancelled:
        if repaired:
            return "pending"
        if is_payment_success_status(fp_payment_status):
            return "unclear"
        if order.failure_code == "payment_abandoned":
            return "failed"
        return "failed"

    if order_payment_completed(order):
        return "success"

    if is_payment_success_status(fp_payment_status) and order.status in {
        MfOrderStatus.processing,
        MfOrderStatus.submitted,
    }:
        return "success"

    if order.status not in TERMINAL_STATUSES:
        return "pending"

    return "unclear"


def classify_checkout_payment_outcome(
    checkout: MfCheckout,
    orders: list[MfOrder],
    *,
    fp_payment_status: str | None,
    repaired: bool,
) -> PaymentReconcileOutcome:
    if checkout.status == MfCheckoutStatus.succeeded:
        return "success"
    if checkout.status == MfCheckoutStatus.failed:
        return "failed"

    if checkout.status == MfCheckoutStatus.cancelled:
        if repaired:
            return "pending"
        if is_payment_success_status(fp_payment_status):
            return "unclear"
        if checkout.failure_code == "payment_abandoned":
            return "failed"
        return "failed"

    if any(order.status == MfOrderStatus.succeeded for order in orders):
        return "pending" if checkout.status != MfCheckoutStatus.succeeded else "success"

    if orders:
        order_outcomes = {
            classify_order_payment_outcome(order, fp_payment_status=fp_payment_status, repaired=repaired)
            for order in orders
        }
        if "unclear" in order_outcomes:
            return "unclear"
        if order_outcomes == {"success"}:
            return "success"
        if "failed" in order_outcomes and "pending" not in order_outcomes:
            return "failed"

    if checkout.status not in {
        MfCheckoutStatus.succeeded,
        MfCheckoutStatus.failed,
        MfCheckoutStatus.cancelled,
    }:
        return "pending"

    return "unclear"


async def reconcile_order_payment(
    session: AsyncSession,
    order: MfOrder,
    *,
    user_ip: str | None = None,
    force: bool = False,
) -> dict[str, Any]:
    if order.order_type == MfOrderType.redemption:
        return {
            "outcome": "pending",
            "fp_payment_status": None,
            "repaired": False,
            "advanced": False,
        }

    if _is_sip_first_installment_order(order):
        from app.application.mf.mf_sip_installment_order_service import resync_sip_first_installment_order

        changed = await resync_sip_first_installment_order(session, order)
        fp_payment_status = _ondc_metadata(order).get("fp_payment_status")
        if isinstance(fp_payment_status, str):
            fp_payment_status = fp_payment_status
        else:
            fp_payment_status = None
        return {
            "outcome": classify_order_payment_outcome(
                order,
                fp_payment_status=fp_payment_status,
                repaired=changed,
            ),
            "fp_payment_status": fp_payment_status,
            "repaired": changed,
            "advanced": False,
            "truth_changed": changed,
        }

    if not _ondc_gateway_enabled():
        return {
            "outcome": "pending",
            "fp_payment_status": None,
            "repaired": False,
            "advanced": False,
        }

    checkout = await session.get(MfCheckout, order.checkout_id) if order.checkout_id else None
    if (
        order.status == MfOrderStatus.failed
        and order.failure_code == "payment_not_completed"
        and (order.fp_state or "").strip().lower() not in FP_FAILURE_STATES
    ):
        restored = map_fp_purchase_state(order.fp_state)
        order.status = restored if restored != MfOrderStatus.failed else MfOrderStatus.processing
        order.failure_code = None
        order.failure_reason = None
        if checkout and checkout.status == MfCheckoutStatus.failed:
            checkout.status = map_fp_purchase_state_to_checkout(order.fp_state)
            checkout.failure_code = None
            checkout.failure_reason = None
        await session.flush()

    payment_id = _resolve_order_payment_id(order, checkout)
    fp_payment_status = await _fetch_fp_payment_status(payment_id)

    repaired = await try_repair_abandoned_paid_order(
        session,
        order,
        checkout=checkout,
        fp_payment_status=fp_payment_status,
    )

    advanced = False
    if order.status not in TERMINAL_STATUSES:
        if order.fp_purchase_id and await sync_order_from_fp(session, order):
            advanced = True
        if await advance_ondc_order(session, order, force=force):
            advanced = True

    truth = await fetch_order_fp_truth(order, checkout=checkout)
    applied = await apply_order_fp_truth(session, order, checkout=checkout, truth=truth)
    fp_payment_status = truth.get("fp_payment_status") or fp_payment_status
    if applied.get("changed"):
        advanced = True

    outcome = classify_order_payment_outcome(order, fp_payment_status=fp_payment_status, repaired=repaired)
    return {
        "outcome": outcome,
        "fp_payment_status": fp_payment_status,
        "repaired": repaired,
        "advanced": advanced,
        "truth_changed": applied.get("changed", False),
    }


async def reconcile_checkout_payment(
    session: AsyncSession,
    checkout: MfCheckout,
    *,
    user_ip: str | None = None,
) -> dict[str, Any]:
    if not _ondc_gateway_enabled():
        return {
            "outcome": "pending",
            "fp_payment_status": None,
            "repaired": False,
            "advanced": False,
        }

    orders = await _load_checkout_orders(session, checkout.id)
    payment_id = _resolve_checkout_payment_id(checkout, orders)
    fp_payment_status = await _fetch_fp_payment_status(payment_id)

    repaired = await try_repair_abandoned_paid_checkout(
        session,
        checkout,
        orders,
        fp_payment_status=fp_payment_status,
    )

    advanced = False
    if checkout.status not in {
        MfCheckoutStatus.succeeded,
        MfCheckoutStatus.failed,
        MfCheckoutStatus.cancelled,
    }:
        if checkout.checkout_type == MfCheckoutType.cart:
            if await advance_ondc_cart_checkout(session, checkout):
                advanced = True
        else:
            for order in orders:
                result = await reconcile_order_payment(session, order, user_ip=user_ip)
                if result.get("advanced") or result.get("repaired"):
                    advanced = True

    outcome = classify_checkout_payment_outcome(
        checkout,
        orders,
        fp_payment_status=fp_payment_status,
        repaired=repaired,
    )
    return {
        "outcome": outcome,
        "fp_payment_status": fp_payment_status,
        "repaired": repaired,
        "advanced": advanced,
    }
