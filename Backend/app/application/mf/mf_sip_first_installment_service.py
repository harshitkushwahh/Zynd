"""First SIP installment payment (ONDC / Cybrilla parity with MultiPlus)."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.mf_fp_review_poll import (
    PURCHASE_REVIEW_POLL_ATTEMPTS,
    PURCHASE_REVIEW_POLL_INTERVAL_SECONDS,
    PURCHASE_REVIEW_WAIT_STATES,
    poll_purchase_until_actionable,
    purchase_not_ready_error,
)
from app.application.mf.mf_fp_state import (
    FP_FAILURE_STATES,
    FP_PAYMENT_PENDING_STATES,
    FP_PROCESSING_STATES,
    FP_SUBMITTED_STATES,
    FP_SUCCESS_STATES,
)
from app.core.config import get_settings
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.mf.fp_oms_client import (
    extract_fp_old_id,
    extract_fp_state,
    get_mf_purchase,
    list_mf_purchases_for_plan,
)
from app.infrastructure.mf.fp_payment_client import (
    create_netbanking_payment,
    extract_payment_status,
    extract_payment_token_url,
    get_payment,
    is_payment_failure_status,
    is_payment_success_status,
)
from app.infrastructure.persistence.mf_transaction_models import MfMandate, MfSipPlan, MfSipPlanStatus

logger = logging.getLogger(__name__)

FirstInstallmentStatus = Literal["not_applicable", "pending", "paid", "failed"]

_FIRST_INSTALLMENT_UNPAID_STATES = FP_PAYMENT_PENDING_STATES | FP_SUBMITTED_STATES
_FIRST_INSTALLMENT_PAID_STATES = FP_SUCCESS_STATES | FP_PROCESSING_STATES


def _normalize_fp_state(fp_state: str | None) -> str:
    return (fp_state or "").strip().lower()


def _ondc_gateway_enabled() -> bool:
    return get_settings().zynd_mf_order_payment_gateway.strip().lower() == "ondc"


def classify_first_installment_state(fp_state: str | None) -> FirstInstallmentStatus:
    normalized = _normalize_fp_state(fp_state)
    if not normalized:
        return "pending"
    if normalized in FP_FAILURE_STATES:
        return "failed"
    if normalized in _FIRST_INSTALLMENT_UNPAID_STATES:
        return "pending"
    if normalized in _FIRST_INSTALLMENT_PAID_STATES:
        return "paid"
    return "pending"


def _pick_first_installment_purchase(purchases: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not purchases:
        return None
    return sorted(
        purchases,
        key=lambda item: str(item.get("fp_purchase_id") or item.get("raw", {}).get("created_at") or ""),
    )[0]


def _first_installment_meta(plan: MfSipPlan) -> dict[str, Any]:
    meta = dict(plan.metadata_ or {})
    sip = meta.get("sip")
    if not isinstance(sip, dict):
        return {}
    first = sip.get("first_installment")
    return dict(first) if isinstance(first, dict) else {}


async def _set_first_installment_meta(
    session: AsyncSession,
    plan: MfSipPlan,
    **updates: Any,
) -> None:
    meta = dict(plan.metadata_ or {})
    sip = dict(meta.get("sip") or {}) if isinstance(meta.get("sip"), dict) else {}
    first = _first_installment_meta(plan)
    first.update(updates)
    sip["first_installment"] = first
    plan.metadata_ = {**meta, "sip": sip}
    await session.flush()


def _resolve_payment_method(mandate: MfMandate | None) -> str:
    mandate_type = (mandate.mandate_type if mandate else "upi").strip().lower()
    return "NETBANKING" if mandate_type == "nach" else "UPI"


def _pending_first_installment_payload(*, amount_inr: float) -> dict[str, Any]:
    return {
        "status": "pending",
        "amount_inr": amount_inr,
        "payment_url": None,
    }


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


async def _fetch_first_installment_payment_status(
    fp_payment_id: Any,
) -> tuple[str | None, dict[str, Any] | None]:
    if fp_payment_id is None:
        return None, None
    try:
        payment_id = int(fp_payment_id)
    except (TypeError, ValueError):
        return None, None
    try:
        payload = await get_payment(payment_id)
    except Exception:
        logger.warning("Unable to fetch first installment payment id=%s", fp_payment_id, exc_info=True)
        return None, None
    return extract_payment_status(payload), payload


def _payment_covers_first_installment(
    payment_payload: dict[str, Any] | None,
    fp_purchase_old_id: Any,
) -> bool:
    if fp_purchase_old_id is None:
        return False
    try:
        old_id = int(fp_purchase_old_id)
    except (TypeError, ValueError):
        return False
    return old_id in _payment_amc_order_ids(payment_payload)


def _resolve_first_installment_status(
    *,
    fp_state: str | None,
    fp_payment_status: str | None,
    payment_succeeded: bool,
) -> FirstInstallmentStatus:
    if payment_succeeded:
        return "paid"
    if is_payment_failure_status(fp_payment_status):
        return "failed"
    return classify_first_installment_state(fp_state)


async def confirm_sip_first_installment_return(
    session: AsyncSession,
    plan: MfSipPlan,
    *,
    mandate: MfMandate | None = None,
) -> dict[str, Any]:
    """Reconcile Cybrilla payment truth after the investor returns from PG."""
    return await resolve_sip_first_installment(session, plan, mandate=mandate, force_reconcile=True)


async def resolve_sip_first_installment(
    session: AsyncSession,
    plan: MfSipPlan,
    *,
    mandate: MfMandate | None = None,
    force_reconcile: bool = False,
) -> dict[str, Any]:
    """Return first-installment status for an active SIP plan."""
    del mandate
    if plan.status != MfSipPlanStatus.active or not plan.fp_plan_id:
        return {"status": "not_applicable"}

    cached = _first_installment_meta(plan)
    if cached.get("status") == "paid" and not force_reconcile:
        return {
            "status": "paid",
            "amount_inr": cached.get("amount_inr") or float(plan.amount_inr),
            "payment_url": None,
        }

    purchases = await list_mf_purchases_for_plan(fp_plan_id=plan.fp_plan_id)
    installment = _pick_first_installment_purchase(purchases)
    if installment is None:
        if _ondc_gateway_enabled():
            return _pending_first_installment_payload(amount_inr=float(plan.amount_inr))
        return {"status": "not_applicable"}

    fp_state = installment.get("state")
    fp_purchase_id = cached.get("fp_purchase_id") or installment.get("fp_purchase_id")
    fp_purchase_old_id = cached.get("fp_purchase_old_id") or installment.get("fp_purchase_old_id")
    if fp_purchase_id:
        try:
            purchase = await get_mf_purchase(str(fp_purchase_id))
            obj = purchase.get("data") if isinstance(purchase.get("data"), dict) else purchase
            fp_state = obj.get("state") or fp_state
        except FpClientError:
            logger.warning(
                "Unable to refresh first installment purchase plan=%s purchase=%s",
                plan.id,
                fp_purchase_id,
                exc_info=True,
            )

    fp_payment_status, payment_payload = await _fetch_first_installment_payment_status(
        cached.get("fp_payment_id"),
    )
    payment_succeeded = _payment_covers_first_installment(payment_payload, fp_purchase_old_id) and (
        is_payment_success_status(fp_payment_status)
    )
    status = _resolve_first_installment_status(
        fp_state=str(fp_state) if fp_state is not None else None,
        fp_payment_status=fp_payment_status,
        payment_succeeded=payment_succeeded,
    )
    raw = installment.get("raw") if isinstance(installment.get("raw"), dict) else {}
    amount = raw.get("amount")
    try:
        amount_inr = float(amount) if amount is not None else float(plan.amount_inr)
    except (TypeError, ValueError):
        amount_inr = float(plan.amount_inr)

    if status == "paid":
        await _set_first_installment_meta(
            session,
            plan,
            status="paid",
            amount_inr=amount_inr,
            fp_purchase_id=fp_purchase_id,
            fp_purchase_old_id=fp_purchase_old_id,
            fp_state=fp_state,
            fp_payment_status=fp_payment_status,
            payment_url=None,
        )
    elif status == "failed":
        await _set_first_installment_meta(
            session,
            plan,
            status="failed",
            amount_inr=amount_inr,
            fp_purchase_id=fp_purchase_id,
            fp_purchase_old_id=fp_purchase_old_id,
            fp_state=fp_state,
            fp_payment_status=fp_payment_status,
            payment_url=None,
        )
    elif status == "pending":
        await _set_first_installment_meta(
            session,
            plan,
            status="pending",
            amount_inr=amount_inr,
            fp_purchase_id=fp_purchase_id,
            fp_purchase_old_id=fp_purchase_old_id,
            fp_state=fp_state,
            fp_payment_status=fp_payment_status,
            payment_url=None,
        )

    await _sync_first_installment_order(session, plan, installment=installment)

    return {
        "status": status,
        "amount_inr": amount_inr,
        "payment_url": None,
        "fp_state": str(fp_state) if fp_state is not None else cached.get("fp_state"),
        "fp_payment_status": fp_payment_status or cached.get("fp_payment_status"),
    }


async def _sync_first_installment_order(
    session: AsyncSession,
    plan: MfSipPlan,
    *,
    installment: dict[str, Any] | None,
) -> None:
    from app.application.mf.mf_sip_installment_order_service import sync_sip_first_installment_order

    await sync_sip_first_installment_order(session, plan, installment=installment)


async def _await_payable_first_installment(plan: MfSipPlan) -> dict[str, Any] | None:
    """List the plan purchase, then poll it out of under_review until old_id exists."""
    latest: dict[str, Any] | None = None
    for attempt in range(PURCHASE_REVIEW_POLL_ATTEMPTS):
        if not plan.fp_plan_id:
            return None
        purchases = await list_mf_purchases_for_plan(fp_plan_id=plan.fp_plan_id)
        latest = _pick_first_installment_purchase(purchases)
        if latest and latest.get("fp_purchase_id"):
            break
        if attempt + 1 < PURCHASE_REVIEW_POLL_ATTEMPTS:
            await asyncio.sleep(PURCHASE_REVIEW_POLL_INTERVAL_SECONDS)
    if not latest or not latest.get("fp_purchase_id"):
        return latest

    state = str(latest.get("state") or "").strip().lower()
    purchase_id = str(latest["fp_purchase_id"])
    if state not in PURCHASE_REVIEW_WAIT_STATES and latest.get("fp_purchase_old_id") is not None:
        return latest
    polled_state, payload = await poll_purchase_until_actionable(
        purchase_id,
        initial_state=state or "under_review",
    )
    old_id = extract_fp_old_id(payload)
    if old_id is None:
        refreshed = await get_mf_purchase(purchase_id)
        old_id = extract_fp_old_id(refreshed)
        polled_state = (extract_fp_state(refreshed) or polled_state).strip().lower()
    return {
        **latest,
        "state": polled_state,
        "fp_purchase_old_id": old_id if old_id is not None else latest.get("fp_purchase_old_id"),
    }


async def initiate_sip_first_installment_payment(
    session: AsyncSession,
    plan: MfSipPlan,
    *,
    mandate: MfMandate | None,
) -> dict[str, Any]:
    """Create a fresh PG payment for the unpaid first SIP installment."""
    if plan.status != MfSipPlanStatus.active or not plan.fp_plan_id:
        raise FpClientError("SIP is not active yet", "sip_not_active", 409)

    first_installment = await resolve_sip_first_installment(session, plan, mandate=mandate)
    if first_installment.get("status") == "paid":
        return first_installment
    if first_installment.get("status") != "pending":
        raise FpClientError("No first installment is due for this SIP", "first_installment_not_due", 409)

    cached = _first_installment_meta(plan)
    fp_purchase_old_id = cached.get("fp_purchase_old_id")
    fp_purchase_id = cached.get("fp_purchase_id")
    cached_state = str(cached.get("fp_state") or "").strip().lower()
    if (
        fp_purchase_old_id is None
        or not fp_purchase_id
        or cached_state in PURCHASE_REVIEW_WAIT_STATES
    ):
        awaited = await _await_payable_first_installment(plan)
        if awaited:
            fp_purchase_old_id = awaited.get("fp_purchase_old_id") or fp_purchase_old_id
            fp_purchase_id = awaited.get("fp_purchase_id") or fp_purchase_id
            cached_state = str(awaited.get("state") or cached_state).strip().lower()
    if fp_purchase_old_id is None or cached_state in PURCHASE_REVIEW_WAIT_STATES:
        raise FpClientError("First installment order is not ready yet", "first_installment_missing", 409)

    if mandate is None or mandate.bank_account_old_id is None:
        raise FpClientError("Debit bank account is unavailable", "bank_old_id_missing", 400)

    settings = get_settings()
    try:
        try:
            payment = await create_netbanking_payment(
                amc_order_ids=[int(fp_purchase_old_id)],
                bank_account_id=int(mandate.bank_account_old_id),
                method=_resolve_payment_method(mandate),
                provider_name="ONDC" if settings.zynd_mf_order_payment_gateway == "ondc" else "CYBRILLAPOA",
                payment_postback_url=settings.resolved_mf_sip_first_installment_postback_url_for_plan(str(plan.id)),
            )
        except FpClientError as exc:
            if not purchase_not_ready_error(exc) or not fp_purchase_id:
                raise
            polled_state, payload = await poll_purchase_until_actionable(
                str(fp_purchase_id),
                initial_state=cached_state or "under_review",
            )
            refreshed_old_id = extract_fp_old_id(payload) or fp_purchase_old_id
            if polled_state in PURCHASE_REVIEW_WAIT_STATES:
                raise
            payment = await create_netbanking_payment(
                amc_order_ids=[int(refreshed_old_id)],
                bank_account_id=int(mandate.bank_account_old_id),
                method=_resolve_payment_method(mandate),
                provider_name="ONDC" if settings.zynd_mf_order_payment_gateway == "ondc" else "CYBRILLAPOA",
                payment_postback_url=settings.resolved_mf_sip_first_installment_postback_url_for_plan(str(plan.id)),
            )
            fp_purchase_old_id = refreshed_old_id
    except FpClientError as exc:
        message = (exc.message or "").lower()
        if "already in progress" in message or "given order set" in message:
            raise FpClientError(
                "A payment for this installment is already in progress. Wait a moment, then try again.",
                "first_installment_payment_in_progress",
                409,
            ) from exc
        raise
    payment_url = payment.get("token_url") or extract_payment_token_url(payment.get("raw") or {})
    if not payment_url:
        raise FpClientError("Unable to start first installment payment", "first_installment_payment_failed", 502)

    fp_state = cached.get("fp_state")
    if fp_purchase_id:
        try:
            refreshed = await get_mf_purchase(str(fp_purchase_id))
            obj = refreshed.get("data") if isinstance(refreshed.get("data"), dict) else refreshed
            fp_state = obj.get("state") or fp_state
        except FpClientError:
            logger.warning("Unable to refresh first installment purchase plan=%s", plan.id, exc_info=True)

    await _set_first_installment_meta(
        session,
        plan,
        status="pending",
        amount_inr=first_installment.get("amount_inr") or float(plan.amount_inr),
        fp_purchase_id=fp_purchase_id,
        fp_purchase_old_id=fp_purchase_old_id,
        fp_state=fp_state,
        fp_payment_id=payment.get("id"),
        payment_url=None,
    )

    return {
        "status": "pending",
        "amount_inr": first_installment.get("amount_inr") or float(plan.amount_inr),
        "payment_url": payment_url,
    }
