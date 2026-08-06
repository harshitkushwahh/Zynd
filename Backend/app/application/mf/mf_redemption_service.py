from __future__ import annotations

import logging
import re
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
from app.application.mf.investment_constraints import extract_investment_constraints_from_scheme
from app.application.mf.mf_fp_state import map_fp_redemption_state_to_order
from app.application.mf.mf_order_errors import MfOrderError
from app.application.mf.mf_order_service import TERMINAL_STATUSES, _record_order_event, get_or_create_mf_investment_account
from app.application.mf.mf_redemption_journey_service import index_active_redemptions, list_fp_redemptions_for_mfia
from app.application.mf.mf_investment_account_service import ensure_fp_mfia, ensure_mfia_old_id
from app.application.mf.portfolio_holdings_service import (
    build_portfolio_holding_id,
    invalidate_user_portfolio_cache,
    parse_holding_id,
    parse_holdings_report,
)
from app.core.config import get_settings
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.mf.fp_oms_client import (
    create_mf_redemption,
    extract_fp_state,
    get_fund_scheme_by_isin,
    get_holdings_report,
    get_mf_redemption,
    list_mf_folios,
    update_mf_redemption,
)
from app.application.mf.mf_transaction_retry import bump_transient_retry, is_transient_error, should_skip_retry
from app.infrastructure.persistence.mf_models import MutualFund, Product
from app.infrastructure.persistence.mf_transaction_models import (
    MfInvestmentAccount,
    MfOrder,
    MfOrderStatus,
    MfOrderType,
)

logger = logging.getLogger(__name__)

RedeemMode = Literal["amount", "units", "all"]


def _order_meta(order: MfOrder) -> dict[str, Any]:
    return order.metadata_ if isinstance(order.metadata_, dict) else {}


def _fp_redemption_id(order: MfOrder) -> str | None:
    meta = _order_meta(order)
    value = meta.get("fp_redemption_id")
    return str(value) if value else None


def _normalize_folio_mobile(raw: str | None) -> str | None:
    if not raw:
        return None
    cleaned = re.sub(r"\D", "", raw.lstrip("+"))
    if cleaned.startswith("91") and len(cleaned) > 10:
        cleaned = cleaned[2:]
    return cleaned if len(cleaned) >= 10 else None


def _mask_email(email: str) -> str:
    local, _, domain = email.partition("@")
    if not domain:
        return email
    if len(local) <= 2:
        masked_local = local[0] + "•••"
    else:
        masked_local = local[0] + "•••" + local[-1]
    return f"{masked_local}@{domain}"


def _mask_mobile(mobile: str) -> str:
    digits = re.sub(r"\D", "", mobile)
    if len(digits) < 4:
        return mobile
    return f"+91 •••• ••{digits[-4:]}"


def _extract_folio_consent_contacts(folio_payload: dict[str, Any]) -> tuple[str | None, str | None]:
    rows = folio_payload.get("data")
    if not isinstance(rows, list) or not rows:
        return None, None
    folio = rows[0] if isinstance(rows[0], dict) else {}

    email = None
    emails = folio.get("email_addresses")
    if isinstance(emails, list):
        for item in emails:
            if isinstance(item, str) and item.strip():
                email = item.strip().lower()
                break

    mobile = None
    mobiles = folio.get("mobile_numbers")
    if isinstance(mobiles, list):
        for item in mobiles:
            normalized = _normalize_folio_mobile(str(item) if item is not None else None)
            if normalized:
                mobile = normalized
                break
    return email, mobile


def _amount_matches_multiple(amount: Decimal, multiple: float | None) -> bool:
    if multiple is None or multiple <= 0:
        return True
    remainder = float(amount) % multiple
    return remainder < 0.01 or (multiple - remainder) < 0.01


def _units_matches_multiple(units: float, multiple: float | None) -> bool:
    if multiple is None or multiple <= 0:
        return True
    remainder = units % multiple
    return remainder < 0.0001 or (multiple - remainder) < 0.0001


def _validate_redemption_amount(
    *,
    amount_inr: Decimal,
    redeemable_amount_inr: float,
    constraints: dict[str, Any] | None,
) -> None:
    redemption = (constraints or {}).get("redemption") or {}
    min_inr = redemption.get("min_inr")
    max_inr = redemption.get("max_inr")
    multiples_inr = redemption.get("multiples_inr")

    if amount_inr <= 0:
        raise MfOrderError(code="invalid_amount", message="Amount must be positive")
    if amount_inr > Decimal(str(redeemable_amount_inr)):
        raise MfOrderError(code="above_redeemable", message="Amount exceeds redeemable balance")
    if min_inr is not None and float(amount_inr) < float(min_inr):
        raise MfOrderError(code="below_minimum", message=f"Minimum redemption amount is INR {min_inr}")
    if max_inr is not None and float(amount_inr) > float(max_inr):
        raise MfOrderError(code="above_maximum", message=f"Maximum redemption amount is INR {max_inr}")
    if not _amount_matches_multiple(amount_inr, multiples_inr):
        raise MfOrderError(code="invalid_multiple", message="Amount must match fund withdrawal multiples")


def _validate_redemption_units(
    *,
    units: float,
    redeemable_units: float,
    constraints: dict[str, Any] | None,
) -> None:
    redemption = (constraints or {}).get("redemption") or {}
    min_units = redemption.get("min_units")
    max_units = redemption.get("max_inr")  # units max often tied to holdings
    unit_multiples = redemption.get("unit_multiples")

    if units <= 0:
        raise MfOrderError(code="invalid_units", message="Units must be positive")
    if units > redeemable_units + 0.0001:
        raise MfOrderError(code="above_redeemable", message="Units exceed redeemable balance")
    if min_units is not None and units < float(min_units):
        raise MfOrderError(code="below_minimum", message=f"Minimum redemption units is {min_units}")
    if max_units is not None and units > float(max_units):
        raise MfOrderError(code="above_maximum", message=f"Maximum redemption units is {max_units}")
    if not _units_matches_multiple(units, unit_multiples):
        raise MfOrderError(code="invalid_multiple", message="Units must match fund withdrawal multiples")


async def _load_fund_context(session: AsyncSession, *, isin: str) -> tuple[Product, MutualFund]:
    row = (
        await session.execute(
            select(Product, MutualFund).join(MutualFund, MutualFund.product_id == Product.id).where(MutualFund.isin == isin)
        )
    ).first()
    if not row:
        raise MfOrderError(code="fund_not_found", message="Fund not found for this holding", status_code=404)
    return row[0], row[1]


async def _load_holding_row(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    holding_id: str,
) -> tuple[MfInvestmentAccount, str, str, dict[str, Any], str, str]:
    parsed = parse_holding_id(holding_id)
    if parsed is None:
        raise MfOrderError(code="invalid_holding_id", message="Invalid holding id", status_code=400)

    folio_number, isin = parsed
    mfia = await get_or_create_mf_investment_account(session, user_id=user_id)
    fp_mfia_id = mfia.fp_mfia_id or await ensure_fp_mfia(session, user_id=user_id, mfia=mfia)
    if not fp_mfia_id:
        raise MfOrderError(code="no_mfia", message="Investment account is not ready yet", status_code=409)

    old_id = await ensure_mfia_old_id(session, mfia=mfia)
    if old_id is None:
        raise MfOrderError(code="mfia_not_ready", message="Investment account is not ready yet", status_code=409)

    holdings_payload = await get_holdings_report(investment_account_id=old_id, folios=folio_number)
    rows = [row for row in parse_holdings_report(holdings_payload) if str(row.get("isin")).upper() == isin]
    if not rows:
        raise MfOrderError(code="holding_not_found", message="Holding not found", status_code=404)

    row = rows[0]
    redeemable_units = float(row.get("redeemable_units") or 0)
    if redeemable_units <= 0:
        raise MfOrderError(code="not_redeemable", message="This holding has no redeemable units")

    fp_redemptions = await list_fp_redemptions_for_mfia(fp_mfia_id=fp_mfia_id)
    active = index_active_redemptions(fp_redemptions)
    if active.get(build_portfolio_holding_id(folio_number=folio_number, isin=isin)):
        raise MfOrderError(
            code="active_redemption_exists",
            message="A redemption is already in progress for this holding",
            status_code=409,
        )

    _product, fund = await _load_fund_context(session, isin=isin)
    scheme = fund.fp_scheme_id or isin
    return mfia, folio_number, isin, row, scheme, fp_mfia_id


async def _load_redemption_constraints(isin: str) -> dict[str, Any] | None:
    try:
        raw = await get_fund_scheme_by_isin(isin)
    except FpClientError:
        return None
    return extract_investment_constraints_from_scheme(raw)


async def create_redemption_order(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    holding_id: str,
    idempotency_key: str,
    redeem_mode: RedeemMode,
    amount_inr: Decimal | None = None,
    units: float | None = None,
    user_ip: str | None = None,
) -> MfOrder:
    existing = await session.scalar(select(MfOrder).where(MfOrder.idempotency_key == idempotency_key))
    if existing:
        if existing.user_id != user_id:
            raise MfOrderError(code="idempotency_conflict", message="Idempotency key already used", status_code=409)
        return existing

    mfia, folio_number, isin, row, scheme_id, fp_mfia_id = await _load_holding_row(
        session,
        user_id=user_id,
        holding_id=holding_id,
    )
    product, fund = await _load_fund_context(session, isin=isin)
    constraints = await _load_redemption_constraints(isin)

    redeemable_units = float(row.get("redeemable_units") or 0)
    redeemable_amount_inr = float(row.get("redeemable_amount_inr") or row.get("current_value_inr") or 0)
    nav = float(row.get("nav") or 0)

    fp_amount: float | None = None
    fp_units: float | None = None
    order_amount = Decimal("0")

    if redeem_mode == "all":
        pass
    elif redeem_mode == "amount":
        if amount_inr is None:
            raise MfOrderError(code="invalid_amount", message="Amount is required")
        _validate_redemption_amount(
            amount_inr=amount_inr,
            redeemable_amount_inr=redeemable_amount_inr,
            constraints=constraints,
        )
        fp_amount = float(amount_inr)
        order_amount = amount_inr
    elif redeem_mode == "units":
        if units is None:
            raise MfOrderError(code="invalid_units", message="Units are required")
        _validate_redemption_units(units=units, redeemable_units=redeemable_units, constraints=constraints)
        fp_units = units
        order_amount = Decimal(str(round(units * nav, 2))) if nav > 0 else Decimal("0")
    else:
        raise MfOrderError(code="invalid_redeem_mode", message="Invalid redeem mode")

    if redeem_mode == "all":
        order_amount = Decimal(str(round(redeemable_amount_inr, 2)))

    order = MfOrder(
        user_id=user_id,
        product_id=product.id,
        fund_id=fund.id,
        mf_investment_account_id=mfia.id,
        checkout_id=None,
        line_index=0,
        order_type=MfOrderType.redemption,
        amount_inr=order_amount,
        status=MfOrderStatus.pending,
        idempotency_key=idempotency_key,
        fp_scheme_id=scheme_id,
        metadata_={
            "holding_id": holding_id,
            "folio_number": folio_number,
            "isin": isin,
            "redeem_mode": redeem_mode,
            "units": fp_units,
            "user_ip": user_ip,
            "consent_otp_sent": False,
            "redemption_confirmed": False,
        },
    )
    session.add(order)
    await session.flush()

    try:
        fp_result = await create_mf_redemption(
            fp_mfia_id=fp_mfia_id,
            folio_number=folio_number,
            scheme=scheme_id,
            source_ref_id=str(order.id),
            amount_inr=fp_amount,
            units=fp_units,
            user_ip=user_ip,
        )
    except FpClientError as exc:
        order.status = MfOrderStatus.failed
        order.failure_code = exc.code or "fp_redemption_failed"
        order.failure_reason = exc.message
        await session.flush()
        raise MfOrderError(code=exc.code or "fp_redemption_failed", message=exc.message, status_code=exc.status_code) from exc

    fp_redemption_id = fp_result.get("fp_redemption_id")
    if not fp_redemption_id:
        order.status = MfOrderStatus.failed
        order.failure_code = "fp_redemption_failed"
        order.failure_reason = "FinPrim did not return a redemption id"
        await session.flush()
        raise MfOrderError(code="fp_redemption_failed", message="FinPrim did not return a redemption id", status_code=502)

    order.fp_state = str(fp_result.get("state") or "pending")
    order.status = map_fp_redemption_state_to_order(order.fp_state)
    order.metadata_ = {
        **(_order_meta(order)),
        "fp_redemption_id": fp_redemption_id,
    }
    order.submitted_at = datetime.now(timezone.utc)
    await session.flush()

    await _record_order_event(session, order, from_status=None, to_status=order.status.value)
    await invalidate_user_portfolio_cache(user_id)
    return order


async def get_redemption_order(session: AsyncSession, *, user_id: uuid.UUID, order_id: uuid.UUID) -> MfOrder | None:
    order = await session.get(MfOrder, order_id)
    if not order or order.user_id != user_id or order.order_type != MfOrderType.redemption:
        return None
    return order


async def get_redemption_consent_context(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    order_id: uuid.UUID,
) -> dict[str, Any]:
    order = await get_redemption_order(session, user_id=user_id, order_id=order_id)
    if not order:
        raise MfOrderError(code="order_not_found", message="Redemption order not found", status_code=404)

    meta = _order_meta(order)
    folio_number = str(meta.get("folio_number") or "")
    fp_redemption_id = _fp_redemption_id(order)
    if not folio_number or not fp_redemption_id:
        raise MfOrderError(code="order_not_ready", message="Redemption order is missing folio details", status_code=409)

    mfia = await session.get(MfInvestmentAccount, order.mf_investment_account_id) if order.mf_investment_account_id else None
    fp_mfia_id = mfia.fp_mfia_id if mfia else None
    if not fp_mfia_id:
        raise MfOrderError(code="mfia_not_ready", message="Investment account is not ready yet", status_code=409)

    folio_payload = await list_mf_folios(fp_mfia_id=fp_mfia_id, folio_number=folio_number)
    email, mobile = _extract_folio_consent_contacts(folio_payload)
    if not email or not mobile:
        raise MfOrderError(
            code="consent_contact_missing",
            message="Folio registered email and mobile are required for redemption consent",
            status_code=409,
        )

    return {
        "order_id": str(order.id),
        "fp_redemption_id": fp_redemption_id,
        "status": order.status.value,
        "fp_state": order.fp_state,
        "masked_email": _mask_email(email),
        "masked_mobile": _mask_mobile(mobile),
        "consent_otp_sent": bool(meta.get("consent_otp_sent")),
        "redemption_confirmed": bool(meta.get("redemption_confirmed")),
    }


async def send_redemption_consent_otp(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    order_id: uuid.UUID,
    ip: str | None = None,
) -> dict[str, Any]:
    order = await get_redemption_order(session, user_id=user_id, order_id=order_id)
    if not order:
        raise MfOrderError(code="order_not_found", message="Redemption order not found", status_code=404)
    if order.status in TERMINAL_STATUSES:
        raise MfOrderError(code="order_terminal", message="This redemption order is already closed", status_code=409)

    meta = _order_meta(order)
    folio_number = str(meta.get("folio_number") or "")
    mfia = await session.get(MfInvestmentAccount, order.mf_investment_account_id) if order.mf_investment_account_id else None
    fp_mfia_id = mfia.fp_mfia_id if mfia else None
    if not fp_mfia_id or not folio_number:
        raise MfOrderError(code="order_not_ready", message="Redemption order is not ready for consent", status_code=409)

    folio_payload = await list_mf_folios(fp_mfia_id=fp_mfia_id, folio_number=folio_number)
    email, mobile = _extract_folio_consent_contacts(folio_payload)
    if not mobile:
        raise MfOrderError(code="consent_contact_missing", message="Folio registered mobile is unavailable", status_code=409)

    identifier = str(order.id)
    try:
        otp_meta = await request_otp(
            OtpPurpose.fund_confirmation,
            identifier,
            ip=ip,
            destination=mobile,
        )
    except (OtpCooldownError, OtpRateLimitError) as exc:
        raise MfOrderError(code="otp_rate_limited", message=str(exc), status_code=429) from exc

    order.metadata_ = {
        **meta,
        "consent_otp_sent": True,
        "consent_email": email,
        "consent_mobile": mobile,
    }
    await session.flush()
    return {"order_id": str(order.id), "masked_mobile": _mask_mobile(mobile), **otp_meta}


async def confirm_redemption_order(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    order_id: uuid.UUID,
    otp: str,
    ip: str | None = None,
) -> MfOrder:
    del ip
    order = await get_redemption_order(session, user_id=user_id, order_id=order_id)
    if not order:
        raise MfOrderError(code="order_not_found", message="Redemption order not found", status_code=404)
    if order.status in TERMINAL_STATUSES:
        raise MfOrderError(code="order_terminal", message="This redemption order is already closed", status_code=409)

    meta = _order_meta(order)
    if not meta.get("consent_otp_sent"):
        raise MfOrderError(code="consent_otp_required", message="Send OTP before confirming redemption", status_code=409)

    identifier = str(order.id)
    if not await verify_otp(OtpPurpose.fund_confirmation, identifier, otp.strip()):
        raise MfOrderError(code="invalid_otp", message="Invalid or expired OTP", status_code=400)

    fp_redemption_id = _fp_redemption_id(order)
    email = meta.get("consent_email")
    mobile = meta.get("consent_mobile")
    if not fp_redemption_id or not email or not mobile:
        raise MfOrderError(code="order_not_ready", message="Redemption consent details are incomplete", status_code=409)

    try:
        result = await update_mf_redemption(
            fp_redemption_id,
            body={
                "state": "confirmed",
                "consent": {"email": email, "mobile": mobile, "isd_code": "91"},
            },
        )
    except FpClientError as exc:
        raise MfOrderError(code=exc.code or "fp_confirm_failed", message=exc.message, status_code=exc.status_code) from exc

    previous = order.status.value
    order.fp_state = str(result.get("state") or order.fp_state)
    order.status = map_fp_redemption_state_to_order(order.fp_state)
    order.metadata_ = {**meta, "redemption_confirmed": True}
    await session.flush()

    await _record_order_event(
        session,
        order,
        from_status=previous,
        to_status=order.status.value,
        source="USER",
        payload={"stage": "confirmed", "fp_redemption_id": fp_redemption_id},
    )
    await invalidate_user_portfolio_cache(user_id)
    return order


async def apply_redemption_fp_state(
    session: AsyncSession,
    order: MfOrder,
    *,
    fp_state: str | None,
    source: str,
    payload: dict[str, Any] | None = None,
) -> bool:
    if order.order_type != MfOrderType.redemption or order.status in TERMINAL_STATUSES:
        return False

    mapped = map_fp_redemption_state_to_order(fp_state)
    if mapped == order.status and fp_state == order.fp_state:
        return False

    previous = order.status.value
    order.fp_state = str(fp_state) if fp_state is not None else order.fp_state
    order.status = mapped
    if mapped == MfOrderStatus.succeeded:
        order.settled_at = datetime.now(timezone.utc)
    elif mapped == MfOrderStatus.failed:
        order.failure_code = order.failure_code or "fp_terminal_failed"
        order.failure_reason = order.failure_reason or str(fp_state)

    await _record_order_event(
        session,
        order,
        from_status=previous,
        to_status=order.status.value,
        source=source,
        payload={"fp_state": order.fp_state, **(payload or {})},
    )
    await invalidate_user_portfolio_cache(order.user_id)
    return True


async def sync_redemption_order_from_fp(session: AsyncSession, order: MfOrder) -> bool:
    if order.order_type != MfOrderType.redemption or order.status in TERMINAL_STATUSES:
        return False
    if should_skip_retry(order.metadata_):
        return False

    fp_redemption_id = _fp_redemption_id(order)
    if not fp_redemption_id:
        return False

    try:
        payload = await get_mf_redemption(fp_redemption_id)
    except FpClientError as exc:
        if is_transient_error(exc):
            order.metadata_, _terminal = bump_transient_retry(
                order.metadata_,
                error_code=exc.code,
                error_message=exc.message,
            )
            await session.flush()
        return False

    fp_state = extract_fp_state(payload) or order.fp_state
    return await apply_redemption_fp_state(session, order, fp_state=fp_state, source="WORKER", payload={"stage": "sync"})


async def sync_open_redemption_orders(session: AsyncSession, *, batch_size: int = 50) -> dict[str, int]:
    orders = list(
        (
            await session.execute(
                select(MfOrder)
                .where(
                    MfOrder.order_type == MfOrderType.redemption,
                    MfOrder.status.not_in(list(TERMINAL_STATUSES)),
                )
                .order_by(MfOrder.updated_at)
                .limit(batch_size)
            )
        ).scalars()
    )
    updated = 0
    for order in orders:
        if await sync_redemption_order_from_fp(session, order):
            updated += 1
    return {"processed": len(orders), "updated": updated}


def serialize_redemption_order(order: MfOrder, *, product_name: str | None = None) -> dict[str, Any]:
    meta = _order_meta(order)
    next_action = "complete"
    if order.status == MfOrderStatus.payment_pending:
        next_action = "confirm_consent"
    elif order.status in {MfOrderStatus.pending, MfOrderStatus.processing}:
        next_action = "wait_review"
    elif order.status == MfOrderStatus.submitted:
        next_action = "wait_settlement"
    elif order.status == MfOrderStatus.failed:
        next_action = "failed"

    return {
        "order_id": str(order.id),
        "product_id": str(order.product_id),
        "product_name": product_name,
        "order_type": order.order_type.value,
        "amount_inr": float(order.amount_inr),
        "status": order.status.value,
        "fp_redemption_id": meta.get("fp_redemption_id"),
        "fp_state": order.fp_state,
        "holding_id": meta.get("holding_id"),
        "folio_number": meta.get("folio_number"),
        "isin": meta.get("isin"),
        "units": meta.get("units"),
        "redeem_mode": meta.get("redeem_mode"),
        "next_action": next_action,
        "consent_otp_sent": bool(meta.get("consent_otp_sent")),
        "redemption_confirmed": bool(meta.get("redemption_confirmed")),
        "failure_code": order.failure_code,
        "failure_reason": order.failure_reason,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "submitted_at": order.submitted_at.isoformat() if order.submitted_at else None,
        "settled_at": order.settled_at.isoformat() if order.settled_at else None,
    }
