from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.application.identity.otp_app_service import (
    OtpCooldownError,
    OtpPurpose,
    OtpRateLimitError,
    request_otp,
    verify_otp,
)
from app.application.mf.investment_constraints import investment_details_for_fund
from app.application.mf.mf_fp_state import map_fp_plan_state
from app.application.mf.mf_investment_account_service import ensure_fp_mfia
from app.application.mf.mf_order_errors import MfOrderError
from app.application.mf.mf_order_service import get_or_create_mf_investment_account
from app.application.mf.mf_redemption_service import (
    _extract_folio_consent_contacts,
    _load_fund_context,
    _load_holding_row,
    _mask_email,
    _mask_mobile,
)
from app.application.mf.mf_scheme_resolution import resolve_mf_purchase_scheme
from app.application.mf.mf_switch_service import _is_switch_in_destination, _load_destination_fund
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.mf.fp_oms_client import (
    cancel_mf_redemption_plan,
    cancel_mf_switch_plan,
    create_mf_redemption_plan,
    create_mf_switch_plan,
    get_mf_redemption_plan,
    get_mf_switch_plan,
    list_mf_folios,
    resolve_fp_user_ip,
    update_mf_redemption_plan,
    update_mf_switch_plan,
)
from app.infrastructure.persistence.mf_models import Product
from app.infrastructure.persistence.mf_transaction_models import (
    MfSipPlanStatus,
    MfStpPlan,
    MfStpPlanEvent,
    MfSwpPlan,
    MfSwpPlanEvent,
)

logger = logging.getLogger(__name__)

PlanKind = Literal["swp", "stp"]
MONTHLY_FREQUENCY = "monthly"

_TERMINAL = {MfSipPlanStatus.cancelled, MfSipPlanStatus.failed}


def _plan_meta(plan: MfSwpPlan | MfStpPlan) -> dict[str, Any]:
    return plan.metadata_ if isinstance(plan.metadata_, dict) else {}


async def _record_event(
    session: AsyncSession,
    plan: MfSwpPlan | MfStpPlan,
    *,
    from_status: str | None,
    to_status: str,
    source: str = "SYSTEM",
    payload: dict[str, Any] | None = None,
) -> None:
    event_cls = MfSwpPlanEvent if isinstance(plan, MfSwpPlan) else MfStpPlanEvent
    session.add(
        event_cls(
            plan_id=plan.id,
            from_status=from_status,
            to_status=to_status,
            source=source,
            payload=payload,
        )
    )
    await session.flush()


def _amount_allowed(amount: Decimal, details: dict[str, Any] | None, key: str) -> None:
    block = (details or {}).get(key) if isinstance(details, dict) else None
    block = block if isinstance(block, dict) else {}
    min_inr = block.get("min_inr")
    max_inr = block.get("max_inr")
    multiples = block.get("multiples_inr")
    value = float(amount)
    if min_inr is not None and value < float(min_inr):
        raise MfOrderError(code="below_minimum", message=f"Minimum amount is {min_inr}")
    if max_inr is not None and value > float(max_inr):
        raise MfOrderError(code="above_maximum", message=f"Maximum amount is {max_inr}")
    if multiples and float(multiples) > 0 and value % float(multiples) != 0:
        raise MfOrderError(code="invalid_multiple", message="Amount must match fund multiples")


def serialize_systematic_plan(
    plan: MfSwpPlan | MfStpPlan,
    *,
    product_name: str | None = None,
    switch_in_name: str | None = None,
) -> dict[str, Any]:
    meta = _plan_meta(plan)
    next_action = "complete"
    if plan.status == MfSipPlanStatus.consent_pending:
        next_action = "confirm_consent"
    elif plan.status in {MfSipPlanStatus.pending, MfSipPlanStatus.review}:
        next_action = "wait_review"
    elif plan.status == MfSipPlanStatus.failed:
        next_action = "failed"
    payload = {
        "plan_id": str(plan.id),
        "kind": "swp" if isinstance(plan, MfSwpPlan) else "stp",
        "product_id": str(plan.product_id),
        "product_name": product_name,
        "amount_inr": float(plan.amount_inr),
        "frequency": plan.frequency,
        "installment_day": plan.installment_day,
        "number_of_installments": plan.number_of_installments,
        "folio_number": plan.folio_number,
        "status": plan.status.value,
        "fp_plan_id": plan.fp_plan_id,
        "fp_state": plan.fp_state,
        "next_installment_date": plan.next_installment_date.isoformat() if plan.next_installment_date else None,
        "next_action": next_action,
        "consent_otp_sent": bool(meta.get("consent_otp_sent")),
        "plan_confirmed": bool(meta.get("plan_confirmed")),
        "failure_code": plan.failure_code,
        "failure_reason": plan.failure_reason,
        "created_at": plan.created_at.isoformat() if plan.created_at else None,
        "activated_at": plan.activated_at.isoformat() if plan.activated_at else None,
        "cancelled_at": plan.cancelled_at.isoformat() if plan.cancelled_at else None,
    }
    if isinstance(plan, MfStpPlan):
        payload["switch_in_product_id"] = str(plan.switch_in_product_id)
        payload["switch_in_name"] = switch_in_name
    return payload


async def create_swp_plan(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    holding_id: str,
    idempotency_key: str,
    amount_inr: Decimal,
    installment_day: int,
    number_of_installments: int,
    user_ip: str | None = None,
) -> MfSwpPlan:
    existing = await session.scalar(select(MfSwpPlan).where(MfSwpPlan.idempotency_key == idempotency_key))
    if existing:
        if existing.user_id != user_id:
            raise MfOrderError(code="idempotency_conflict", message="Idempotency key already used", status_code=409)
        return existing
    if installment_day < 1 or installment_day > 28:
        raise MfOrderError(code="invalid_installment_day", message="Installment day must be between 1 and 28")
    if number_of_installments < 1:
        raise MfOrderError(code="invalid_installments", message="Number of installments must be at least 1")

    mfia, folio_number, isin, row, fp_mfia_id, _active = await _load_holding_row(
        session, user_id=user_id, holding_id=holding_id
    )
    if not folio_number:
        raise MfOrderError(code="folio_required", message="An existing folio is required for SWP")
    product, fund = await _load_fund_context(session, isin=isin)
    details = investment_details_for_fund(fund)
    types = (details or {}).get("transaction_types")
    if isinstance(types, list) and types and "swp" not in types:
        raise MfOrderError(code="swp_not_allowed", message="This fund does not allow SWP")
    _amount_allowed(amount_inr, details, "swp")
    redeemable = float(row.get("redeemable_amount_inr") or row.get("current_value_inr") or 0)
    if float(amount_inr) > redeemable + 0.01:
        raise MfOrderError(code="above_holding", message="SWP amount exceeds holding value")
    scheme, _fallback = resolve_mf_purchase_scheme(fund, stored_scheme=isin)
    if not scheme:
        raise MfOrderError(code="scheme_not_ready", message="Scheme is not synced for SWP yet")

    plan = MfSwpPlan(
        user_id=user_id,
        product_id=product.id,
        fund_id=fund.id,
        mf_investment_account_id=mfia.id,
        amount_inr=amount_inr,
        frequency=MONTHLY_FREQUENCY,
        installment_day=installment_day,
        number_of_installments=number_of_installments,
        folio_number=folio_number,
        status=MfSipPlanStatus.pending,
        idempotency_key=idempotency_key,
        metadata_={"holding_id": holding_id, "isin": isin, "scheme": scheme, "user_ip": user_ip},
    )
    session.add(plan)
    await session.flush()

    body = {
        "mf_investment_account": fp_mfia_id,
        "folio_number": folio_number,
        "scheme": scheme,
        "frequency": MONTHLY_FREQUENCY,
        "installment_day": installment_day,
        "amount": float(amount_inr),
        "number_of_installments": number_of_installments,
        "systematic": True,
        "auto_generate_installments": True,
        "source_ref_id": str(plan.id),
        "initiated_by": "investor",
        "initiated_via": "web",
    }
    user_ip_resolved = await resolve_fp_user_ip(user_ip)
    if user_ip_resolved:
        body["user_ip"] = user_ip_resolved
    try:
        result = await create_mf_redemption_plan(body=body)
    except FpClientError as exc:
        plan.status = MfSipPlanStatus.failed
        plan.failure_code = exc.code or "fp_plan_submit_failed"
        plan.failure_reason = exc.message
        await session.flush()
        raise MfOrderError(code=plan.failure_code, message=exc.message, status_code=exc.status_code) from exc

    plan.fp_plan_id = result.get("fp_plan_id")
    plan.fp_state = result.get("state")
    plan.status = map_fp_plan_state(plan.fp_state)
    await session.flush()
    await _record_event(session, plan, from_status=None, to_status=plan.status.value)
    return plan


async def create_stp_plan(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    holding_id: str,
    switch_in_product_id: uuid.UUID,
    idempotency_key: str,
    amount_inr: Decimal,
    installment_day: int,
    number_of_installments: int,
    user_ip: str | None = None,
) -> MfStpPlan:
    existing = await session.scalar(select(MfStpPlan).where(MfStpPlan.idempotency_key == idempotency_key))
    if existing:
        if existing.user_id != user_id:
            raise MfOrderError(code="idempotency_conflict", message="Idempotency key already used", status_code=409)
        return existing
    if installment_day < 1 or installment_day > 28:
        raise MfOrderError(code="invalid_installment_day", message="Installment day must be between 1 and 28")
    if number_of_installments < 1:
        raise MfOrderError(code="invalid_installments", message="Number of installments must be at least 1")

    mfia, folio_number, isin, row, fp_mfia_id, _active = await _load_holding_row(
        session, user_id=user_id, holding_id=holding_id
    )
    if not folio_number:
        raise MfOrderError(code="folio_required", message="An existing folio is required for STP")
    out_product, out_fund = await _load_fund_context(session, isin=isin)
    in_product, in_fund = await _load_destination_fund(session, switch_in_product_id=switch_in_product_id)
    if in_fund.amc_id != out_fund.amc_id:
        raise MfOrderError(code="switch_amc_mismatch", message="STP destination must be in the same AMC")
    if in_fund.id == out_fund.id:
        raise MfOrderError(code="switch_same_scheme", message="Choose a different scheme for STP")
    if not _is_switch_in_destination(in_fund, in_product):
        raise MfOrderError(code="switch_in_not_allowed", message="Choose an open-ended scheme to transfer into")
    details = investment_details_for_fund(out_fund)
    types = (details or {}).get("transaction_types")
    if isinstance(types, list) and types and "stp" not in types:
        raise MfOrderError(code="stp_not_allowed", message="This fund does not allow STP")
    _amount_allowed(amount_inr, details, "stp")
    redeemable = float(row.get("redeemable_amount_inr") or row.get("current_value_inr") or 0)
    if float(amount_inr) > redeemable + 0.01:
        raise MfOrderError(code="above_holding", message="STP amount exceeds holding value")
    out_scheme, _ = resolve_mf_purchase_scheme(out_fund, stored_scheme=isin)
    in_scheme, _ = resolve_mf_purchase_scheme(in_fund, stored_scheme=in_fund.isin_growth)
    if not out_scheme or not in_scheme:
        raise MfOrderError(code="scheme_not_ready", message="Scheme is not synced for STP yet")

    plan = MfStpPlan(
        user_id=user_id,
        product_id=out_product.id,
        fund_id=out_fund.id,
        switch_in_fund_id=in_fund.id,
        switch_in_product_id=in_product.id,
        mf_investment_account_id=mfia.id,
        amount_inr=amount_inr,
        frequency=MONTHLY_FREQUENCY,
        installment_day=installment_day,
        number_of_installments=number_of_installments,
        folio_number=folio_number,
        status=MfSipPlanStatus.pending,
        idempotency_key=idempotency_key,
        metadata_={
            "holding_id": holding_id,
            "isin": isin,
            "switch_out_scheme": out_scheme,
            "switch_in_scheme": in_scheme,
            "user_ip": user_ip,
        },
    )
    session.add(plan)
    await session.flush()

    body = {
        "mf_investment_account": fp_mfia_id,
        "folio_number": folio_number,
        "switch_out_scheme": out_scheme,
        "switch_in_scheme": in_scheme,
        "frequency": MONTHLY_FREQUENCY,
        "installment_day": installment_day,
        "amount": float(amount_inr),
        "number_of_installments": number_of_installments,
        "systematic": True,
        "auto_generate_installments": True,
        "source_ref_id": str(plan.id),
        "initiated_by": "investor",
        "initiated_via": "web",
    }
    user_ip_resolved = await resolve_fp_user_ip(user_ip)
    if user_ip_resolved:
        body["user_ip"] = user_ip_resolved
    try:
        result = await create_mf_switch_plan(body=body)
    except FpClientError as exc:
        plan.status = MfSipPlanStatus.failed
        plan.failure_code = exc.code or "fp_plan_submit_failed"
        plan.failure_reason = exc.message
        await session.flush()
        raise MfOrderError(code=plan.failure_code, message=exc.message, status_code=exc.status_code) from exc

    plan.fp_plan_id = result.get("fp_plan_id")
    plan.fp_state = result.get("state")
    plan.status = map_fp_plan_state(plan.fp_state)
    await session.flush()
    await _record_event(session, plan, from_status=None, to_status=plan.status.value)
    return plan


async def get_swp_plan(session: AsyncSession, *, user_id: uuid.UUID, plan_id: uuid.UUID) -> MfSwpPlan | None:
    plan = await session.get(MfSwpPlan, plan_id)
    if not plan or plan.user_id != user_id:
        return None
    return plan


async def get_stp_plan(session: AsyncSession, *, user_id: uuid.UUID, plan_id: uuid.UUID) -> MfStpPlan | None:
    plan = await session.get(MfStpPlan, plan_id)
    if not plan or plan.user_id != user_id:
        return None
    return plan


async def _consent_contacts(session: AsyncSession, plan: MfSwpPlan | MfStpPlan) -> tuple[str, str]:
    mfia = await get_or_create_mf_investment_account(session, user_id=plan.user_id)
    fp_mfia_id = mfia.fp_mfia_id or await ensure_fp_mfia(session, user_id=plan.user_id, mfia=mfia)
    if not fp_mfia_id or not plan.folio_number:
        raise MfOrderError(code="plan_not_ready", message="Plan is not ready for consent", status_code=409)
    folio_payload = await list_mf_folios(fp_mfia_id=fp_mfia_id, folio_number=plan.folio_number)
    email, mobile = _extract_folio_consent_contacts(folio_payload)
    if not email or not mobile:
        raise MfOrderError(
            code="consent_contact_missing",
            message="Folio registered email and mobile are required",
            status_code=409,
        )
    return email, mobile


async def get_plan_consent_context(
    session: AsyncSession,
    plan: MfSwpPlan | MfStpPlan,
) -> dict[str, Any]:
    email, mobile = await _consent_contacts(session, plan)
    meta = _plan_meta(plan)
    return {
        "plan_id": str(plan.id),
        "fp_plan_id": plan.fp_plan_id,
        "status": plan.status.value,
        "fp_state": plan.fp_state,
        "masked_email": _mask_email(email),
        "masked_mobile": _mask_mobile(mobile),
        "consent_otp_sent": bool(meta.get("consent_otp_sent")),
        "plan_confirmed": bool(meta.get("plan_confirmed")),
    }


async def send_plan_consent_otp(
    session: AsyncSession,
    plan: MfSwpPlan | MfStpPlan,
    *,
    ip: str | None = None,
) -> dict[str, Any]:
    if plan.status in _TERMINAL:
        raise MfOrderError(code="plan_terminal", message="This plan is already closed", status_code=409)
    email, mobile = await _consent_contacts(session, plan)
    try:
        otp_meta = await request_otp(OtpPurpose.fund_confirmation, str(plan.id), ip=ip, destination=mobile)
    except (OtpCooldownError, OtpRateLimitError) as exc:
        raise MfOrderError(code="otp_rate_limited", message=str(exc), status_code=429) from exc
    plan.metadata_ = {**_plan_meta(plan), "consent_otp_sent": True, "consent_email": email, "consent_mobile": mobile}
    await session.flush()
    return {"plan_id": str(plan.id), "masked_mobile": _mask_mobile(mobile), **otp_meta}


async def confirm_systematic_plan(
    session: AsyncSession,
    plan: MfSwpPlan | MfStpPlan,
    *,
    otp: str,
) -> MfSwpPlan | MfStpPlan:
    if plan.status in _TERMINAL:
        raise MfOrderError(code="plan_terminal", message="This plan is already closed", status_code=409)
    meta = _plan_meta(plan)
    if not meta.get("consent_otp_sent"):
        raise MfOrderError(code="consent_otp_required", message="Send OTP before confirming", status_code=409)
    if not await verify_otp(OtpPurpose.fund_confirmation, str(plan.id), otp.strip()):
        raise MfOrderError(code="invalid_otp", message="Invalid or expired OTP", status_code=400)
    if not plan.fp_plan_id:
        raise MfOrderError(code="plan_not_ready", message="Plan is not ready for confirmation", status_code=409)
    body = {
        "id": plan.fp_plan_id,
        "state": "confirmed",
        "consent": {
            "email": meta.get("consent_email"),
            "mobile": meta.get("consent_mobile"),
            "isd_code": "91",
        },
    }
    try:
        if isinstance(plan, MfSwpPlan):
            result = await update_mf_redemption_plan(body=body)
        else:
            result = await update_mf_switch_plan(body=body)
    except FpClientError as exc:
        raise MfOrderError(code=exc.code or "fp_confirm_failed", message=exc.message, status_code=exc.status_code) from exc
    previous = plan.status.value
    plan.fp_state = str(result.get("state") or plan.fp_state)
    plan.status = map_fp_plan_state(plan.fp_state)
    plan.metadata_ = {**meta, "plan_confirmed": True}
    if plan.status == MfSipPlanStatus.active:
        plan.activated_at = datetime.now(timezone.utc)
    await session.flush()
    await _record_event(session, plan, from_status=previous, to_status=plan.status.value, source="USER")
    return plan


async def cancel_systematic_plan(session: AsyncSession, plan: MfSwpPlan | MfStpPlan) -> MfSwpPlan | MfStpPlan:
    if plan.status in _TERMINAL:
        return plan
    if plan.fp_plan_id:
        try:
            if isinstance(plan, MfSwpPlan):
                result = await cancel_mf_redemption_plan(fp_plan_id=plan.fp_plan_id)
            else:
                result = await cancel_mf_switch_plan(fp_plan_id=plan.fp_plan_id)
            plan.fp_state = str(result.get("state") or "cancelled")
        except FpClientError as exc:
            raise MfOrderError(code=exc.code or "fp_cancel_failed", message=exc.message, status_code=exc.status_code) from exc
    previous = plan.status.value
    plan.status = MfSipPlanStatus.cancelled
    plan.cancelled_at = datetime.now(timezone.utc)
    await session.flush()
    await _record_event(session, plan, from_status=previous, to_status=plan.status.value, source="USER")
    return plan


async def apply_plan_fp_state(
    session: AsyncSession,
    plan: MfSwpPlan | MfStpPlan,
    *,
    fp_state: str | None,
    source: str,
    payload: dict[str, Any] | None = None,
) -> bool:
    mapped = map_fp_plan_state(fp_state)
    if mapped == plan.status and fp_state == plan.fp_state:
        return False
    previous = plan.status.value
    plan.fp_state = str(fp_state) if fp_state is not None else plan.fp_state
    plan.status = mapped
    if mapped == MfSipPlanStatus.active and plan.activated_at is None:
        plan.activated_at = datetime.now(timezone.utc)
    if mapped == MfSipPlanStatus.cancelled and plan.cancelled_at is None:
        plan.cancelled_at = datetime.now(timezone.utc)
    next_date = None
    if isinstance(payload, dict):
        next_date = payload.get("next_installment_date")
    if next_date:
        try:
            from datetime import date as date_cls

            plan.next_installment_date = date_cls.fromisoformat(str(next_date)[:10])
        except ValueError:
            pass
    await session.flush()
    await _record_event(session, plan, from_status=previous, to_status=plan.status.value, source=source, payload=payload)
    return True


async def find_swp_by_fp_id(session: AsyncSession, fp_plan_id: str) -> MfSwpPlan | None:
    return await session.scalar(select(MfSwpPlan).where(MfSwpPlan.fp_plan_id == fp_plan_id))


async def find_stp_by_fp_id(session: AsyncSession, fp_plan_id: str) -> MfStpPlan | None:
    return await session.scalar(select(MfStpPlan).where(MfStpPlan.fp_plan_id == fp_plan_id))


async def refresh_plan_from_fp(session: AsyncSession, plan: MfSwpPlan | MfStpPlan) -> bool:
    if not plan.fp_plan_id:
        return False
    try:
        payload = await (
            get_mf_redemption_plan(plan.fp_plan_id) if isinstance(plan, MfSwpPlan) else get_mf_switch_plan(plan.fp_plan_id)
        )
    except FpClientError:
        logger.exception("Failed to refresh systematic plan %s", plan.fp_plan_id)
        return False
    state = payload.get("state") if isinstance(payload, dict) else None
    return await apply_plan_fp_state(session, plan, fp_state=state, source="POLL", payload=payload if isinstance(payload, dict) else {})


async def list_user_swp_plans(session: AsyncSession, *, user_id: uuid.UUID) -> list[MfSwpPlan]:
    return list(
        (
            await session.execute(
                select(MfSwpPlan).where(MfSwpPlan.user_id == user_id).order_by(MfSwpPlan.created_at.desc())
            )
        ).scalars()
    )


async def list_user_stp_plans(session: AsyncSession, *, user_id: uuid.UUID) -> list[MfStpPlan]:
    return list(
        (
            await session.execute(
                select(MfStpPlan).where(MfStpPlan.user_id == user_id).order_by(MfStpPlan.created_at.desc())
            )
        ).scalars()
    )


async def product_name(session: AsyncSession, product_id: uuid.UUID) -> str | None:
    product = await session.get(Product, product_id)
    return product.name if product else None


async def get_plan_journey(session: AsyncSession, plan: MfSwpPlan | MfStpPlan) -> dict[str, Any]:
    event_cls = MfSwpPlanEvent if isinstance(plan, MfSwpPlan) else MfStpPlanEvent
    events = (
        await session.execute(select(event_cls).where(event_cls.plan_id == plan.id).order_by(event_cls.created_at.asc()))
    ).scalars().all()
    return {
        "status": "ok",
        "journey": {
            "order_id": str(plan.id),
            "status": plan.status.value,
            "amount_inr": float(plan.amount_inr),
            "units": 0,
            "placed_at": plan.created_at.isoformat() if plan.created_at else "",
            "folio_number": plan.folio_number,
            "isin": _plan_meta(plan).get("isin"),
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
        },
    }
