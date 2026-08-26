"""First SIP installment payment (ONDC / Cybrilla parity with MultiPlus)."""

from __future__ import annotations

import logging
from typing import Any, Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.mf_fp_state import (
    FP_FAILURE_STATES,
    FP_PAYMENT_PENDING_STATES,
    FP_PROCESSING_STATES,
    FP_SUBMITTED_STATES,
    FP_SUCCESS_STATES,
)
from app.core.config import get_settings
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.mf.fp_oms_client import get_mf_purchase, list_mf_purchases_for_plan
from app.infrastructure.mf.fp_payment_client import create_netbanking_payment, extract_payment_token_url
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


async def resolve_sip_first_installment(
    session: AsyncSession,
    plan: MfSipPlan,
    *,
    mandate: MfMandate | None = None,
) -> dict[str, Any]:
    """Return first-installment status for an active SIP plan."""
    del mandate
    if plan.status != MfSipPlanStatus.active or not plan.fp_plan_id:
        return {"status": "not_applicable"}

    cached = _first_installment_meta(plan)
    if cached.get("status") == "paid":
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
    status = classify_first_installment_state(str(fp_state) if fp_state is not None else None)
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
            fp_purchase_id=installment.get("fp_purchase_id"),
            fp_purchase_old_id=installment.get("fp_purchase_old_id"),
            fp_state=fp_state,
            payment_url=None,
        )
    elif status == "pending":
        await _set_first_installment_meta(
            session,
            plan,
            status="pending",
            amount_inr=amount_inr,
            fp_purchase_id=installment.get("fp_purchase_id"),
            fp_purchase_old_id=installment.get("fp_purchase_old_id"),
            fp_state=fp_state,
            payment_url=None,
        )

    return {
        "status": status,
        "amount_inr": amount_inr,
        "payment_url": None,
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
    if fp_purchase_old_id is None:
        purchases = await list_mf_purchases_for_plan(fp_plan_id=plan.fp_plan_id)
        installment = _pick_first_installment_purchase(purchases)
        if installment is None or installment.get("fp_purchase_old_id") is None:
            raise FpClientError("First installment order is not ready yet", "first_installment_missing", 409)
        fp_purchase_old_id = installment["fp_purchase_old_id"]
        fp_purchase_id = installment.get("fp_purchase_id")

    if mandate is None or mandate.bank_account_old_id is None:
        raise FpClientError("Debit bank account is unavailable", "bank_old_id_missing", 400)

    settings = get_settings()
    try:
        payment = await create_netbanking_payment(
            amc_order_ids=[int(fp_purchase_old_id)],
            bank_account_id=int(mandate.bank_account_old_id),
            method=_resolve_payment_method(mandate),
            provider_name="ONDC" if settings.zynd_mf_order_payment_gateway == "ondc" else "CYBRILLAPOA",
            payment_postback_url=settings.resolved_mf_sip_first_installment_postback_url_for_plan(str(plan.id)),
        )
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
