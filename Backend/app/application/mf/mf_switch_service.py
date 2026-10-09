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
from app.application.mf.investment_constraints import extract_investment_constraints_from_scheme, investment_details_for_fund
from app.application.mf.mf_fp_state import map_fp_redemption_state_to_order
from app.application.mf.mf_order_errors import MfOrderError
from app.application.mf.mf_order_service import TERMINAL_STATUSES, _record_order_event
from app.application.mf.mf_redemption_service import (
    _extract_folio_consent_contacts,
    _load_fund_context,
    _load_holding_row,
    _mask_email,
    _mask_mobile,
    _units_matches_multiple,
)
from app.application.mf.mf_scheme_resolution import resolve_mf_purchase_scheme
from app.application.mf.portfolio_holdings_service import invalidate_user_portfolio_cache, parse_holding_id
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.mf.fp_oms_client import (
    create_mf_switch,
    extract_fp_redemption_failure,
    extract_fp_state,
    get_fund_scheme_by_isin,
    get_mf_switch,
    list_mf_folios,
    list_mf_switches,
    update_mf_switch,
)
from app.application.mf.public_asset_service import resolve_amc_logo_url
from app.core.config import get_settings
from app.infrastructure.persistence.mf_models import FundAmc, MutualFund, Product, ProductDisplayContent
from app.infrastructure.persistence.mf_transaction_models import (
    MfInvestmentAccount,
    MfOrder,
    MfOrderEvent,
    MfOrderStatus,
    MfOrderType,
)

logger = logging.getLogger(__name__)

SwitchMode = Literal["amount", "units", "all"]
map_fp_switch_state_to_order = map_fp_redemption_state_to_order


def _order_meta(order: MfOrder) -> dict[str, Any]:
    return order.metadata_ if isinstance(order.metadata_, dict) else {}


def _fp_switch_id(order: MfOrder) -> str | None:
    value = _order_meta(order).get("fp_switch_id")
    return str(value) if value else None


def _maybe_mark_switch_submitted(order: MfOrder) -> None:
    if order.status == MfOrderStatus.submitted and order.submitted_at is None:
        order.submitted_at = datetime.now(timezone.utc)


_CLOSED_SCHEME_RE = re.compile(
    r"\bfmp\b|fixed maturity|close[- ]?ended|closed[- ]?ended|interval fund|interval scheme|annual interval",
    re.IGNORECASE,
)


def _fund_allows_switch_out(fund: MutualFund) -> bool:
    details = investment_details_for_fund(fund) or {}
    types = details.get("transaction_types")
    if isinstance(types, list) and types and "switch" not in types:
        return False
    return True


def _fund_allows_switch_in(fund: MutualFund) -> bool:
    return _fund_allows_switch_out(fund)


def _is_closed_maturity_scheme(fund: MutualFund, product: Product) -> bool:
    haystack = " ".join(
        part for part in (fund.scheme_name, product.name, fund.sebi_category) if part
    )
    return bool(_CLOSED_SCHEME_RE.search(haystack))


def _is_switch_in_destination(fund: MutualFund, product: Product) -> bool:
    if fund.fp_oms_purchase_allowed is False:
        return False
    if _is_closed_maturity_scheme(fund, product):
        return False
    return _fund_allows_switch_in(fund)


async def list_switch_destinations(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    holding_id: str,
) -> list[dict[str, Any]]:
    _mfia, _folio, isin, _row, _fp_mfia_id, _active = await _load_holding_row(
        session, user_id=user_id, holding_id=holding_id
    )
    _product, source_fund = await _load_fund_context(session, isin=isin)
    amc = await session.get(FundAmc, source_fund.amc_id)
    settings = get_settings()
    amc_name = amc.name if amc else None
    amc_slug = amc.slug if amc else None
    amc_logo_url = resolve_amc_logo_url(amc.logo_url if amc else None, amc_slug or "", settings)
    rows = (
        await session.execute(
            select(Product, MutualFund, ProductDisplayContent)
            .join(MutualFund, MutualFund.product_id == Product.id)
            .outerjoin(ProductDisplayContent, ProductDisplayContent.product_id == Product.id)
            .where(
                MutualFund.amc_id == source_fund.amc_id,
                MutualFund.id != source_fund.id,
                MutualFund.is_active.is_(True),
                MutualFund.product_id.is_not(None),
            )
            .order_by(Product.name.asc())
        )
    ).all()
    destinations: list[dict[str, Any]] = []
    for product, fund, display in rows:
        if not _is_switch_in_destination(fund, product):
            continue
        destinations.append(
            {
                "product_id": str(product.id),
                "fund_id": fund.id,
                "isin": fund.isin_growth,
                "name": product.name,
                "seo_slug": display.seo_slug if display else None,
                "amc_name": amc_name,
                "amc_slug": amc_slug,
                "amc_logo_url": amc_logo_url,
            }
        )
    return destinations


async def _load_destination_fund(session: AsyncSession, *, switch_in_product_id: uuid.UUID) -> tuple[Product, MutualFund]:
    row = (
        await session.execute(
            select(Product, MutualFund)
            .join(MutualFund, MutualFund.product_id == Product.id)
            .where(Product.id == switch_in_product_id)
        )
    ).first()
    if not row:
        raise MfOrderError(code="switch_in_not_found", message="Destination fund not found", status_code=404)
    return row[0], row[1]


async def create_switch_order(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    holding_id: str,
    switch_in_product_id: uuid.UUID,
    idempotency_key: str,
    switch_mode: SwitchMode,
    amount_inr: Decimal | None = None,
    units: float | None = None,
    user_ip: str | None = None,
) -> MfOrder:
    existing = await session.scalar(select(MfOrder).where(MfOrder.idempotency_key == idempotency_key))
    if existing:
        if existing.user_id != user_id:
            raise MfOrderError(code="idempotency_conflict", message="Idempotency key already used", status_code=409)
        return existing

    mfia, folio_number, isin, row, fp_mfia_id, _active = await _load_holding_row(
        session, user_id=user_id, holding_id=holding_id
    )
    if not folio_number:
        raise MfOrderError(code="folio_required", message="An existing folio is required for switch")
    out_product, out_fund = await _load_fund_context(session, isin=isin)
    in_product, in_fund = await _load_destination_fund(session, switch_in_product_id=switch_in_product_id)
    if in_fund.amc_id != out_fund.amc_id:
        raise MfOrderError(code="switch_amc_mismatch", message="Switch destination must be in the same AMC")
    if in_fund.id == out_fund.id:
        raise MfOrderError(code="switch_same_scheme", message="Choose a different scheme to switch into")
    if not _fund_allows_switch_out(out_fund) or not _is_switch_in_destination(in_fund, in_product):
        raise MfOrderError(code="switch_not_allowed", message="This scheme does not allow switches")

    out_scheme, _fallback = resolve_mf_purchase_scheme(out_fund, stored_scheme=isin)
    in_scheme, _in_fallback = resolve_mf_purchase_scheme(in_fund, stored_scheme=in_fund.isin_growth)
    if not out_scheme or not in_scheme:
        raise MfOrderError(code="scheme_not_ready", message="Scheme is not synced for switches yet")

    redeemable_units = float(row.get("redeemable_units") or 0)
    redeemable_amount_inr = float(row.get("redeemable_amount_inr") or row.get("current_value_inr") or 0)
    nav = float(row.get("nav") or 0)
    constraints = None
    try:
        constraints = extract_investment_constraints_from_scheme(await get_fund_scheme_by_isin(isin))
    except FpClientError:
        constraints = investment_details_for_fund(out_fund)

    fp_amount: float | None = None
    fp_units: float | None = None
    order_amount = Decimal("0")
    switch = (constraints or {}).get("switch") if isinstance(constraints, dict) else {}
    switch = switch if isinstance(switch, dict) else {}

    if switch_mode == "amount":
        if amount_inr is None:
            raise MfOrderError(code="invalid_amount", message="Amount is required")
        if float(amount_inr) > redeemable_amount_inr + 0.01:
            raise MfOrderError(code="above_holding", message="Amount exceeds redeemable holding value")
        min_out = switch.get("min_out_inr")
        if min_out is not None and float(amount_inr) < float(min_out):
            raise MfOrderError(code="below_minimum", message=f"Minimum switch amount is {min_out}")
        multiples = switch.get("out_multiples_inr")
        if multiples and float(multiples) > 0 and float(amount_inr) % float(multiples) != 0:
            raise MfOrderError(code="invalid_multiple", message="Amount must match switch multiples")
        fp_amount = float(amount_inr)
        order_amount = amount_inr
    elif switch_mode == "units":
        if units is None:
            raise MfOrderError(code="invalid_units", message="Units are required")
        if units > redeemable_units + 0.0001:
            raise MfOrderError(code="above_holding", message="Units exceed redeemable holding")
        min_units = switch.get("min_out_units")
        if min_units is not None and units < float(min_units):
            raise MfOrderError(code="below_minimum", message=f"Minimum switch units is {min_units}")
        unit_multiples = switch.get("out_unit_multiples")
        if unit_multiples is not None and not _units_matches_multiple(units, unit_multiples):
            raise MfOrderError(code="invalid_multiple", message="Units must match switch multiples")
        fp_units = units
        order_amount = Decimal(str(round(units * nav, 2))) if nav > 0 else Decimal("0")
    elif switch_mode == "all":
        order_amount = Decimal(str(round(redeemable_amount_inr, 2)))
    else:
        raise MfOrderError(code="invalid_switch_mode", message="Invalid switch mode")

    resumable = await find_resumable_switch_order(session, user_id=user_id, holding_id=holding_id)
    if resumable:
        return resumable

    order = MfOrder(
        user_id=user_id,
        product_id=out_product.id,
        fund_id=out_fund.id,
        mf_investment_account_id=mfia.id,
        checkout_id=None,
        line_index=0,
        order_type=MfOrderType.switch,
        amount_inr=order_amount,
        status=MfOrderStatus.pending,
        idempotency_key=idempotency_key,
        fp_scheme_id=out_scheme,
        metadata_={
            "holding_id": holding_id,
            "folio_number": folio_number,
            "isin": isin,
            "switch_mode": switch_mode,
            "amount": fp_amount,
            "units": fp_units,
            "user_ip": user_ip,
            "fp_mfia_id": fp_mfia_id,
            "consent_otp_sent": False,
            "switch_confirmed": False,
            "switch_out_scheme": out_scheme,
            "switch_in_scheme": in_scheme,
            "switch_in_product_id": str(in_product.id),
            "switch_in_fund_id": in_fund.id,
        },
    )
    session.add(order)
    await session.flush()
    await _record_order_event(session, order, from_status=None, to_status=order.status.value)
    await invalidate_user_portfolio_cache(user_id)
    return order


def _is_resumable_switch_order(order: MfOrder, *, holding_id: str) -> bool:
    if order.order_type != MfOrderType.switch or order.status in TERMINAL_STATUSES:
        return False
    meta = _order_meta(order)
    if meta.get("switch_confirmed"):
        return False
    order_holding = str(meta.get("holding_id") or "")
    if order_holding and order_holding == holding_id:
        return True
    parsed = parse_holding_id(holding_id)
    if parsed is None:
        return False
    folio_number, isin = parsed
    return str(meta.get("folio_number") or "") == folio_number and str(meta.get("isin") or "").upper() == isin


async def find_resumable_switch_order(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    holding_id: str,
) -> MfOrder | None:
    orders = list(
        (
            await session.execute(
                select(MfOrder)
                .where(
                    MfOrder.user_id == user_id,
                    MfOrder.order_type == MfOrderType.switch,
                    MfOrder.status.not_in(list(TERMINAL_STATUSES)),
                )
                .order_by(MfOrder.created_at.desc())
                .limit(50)
            )
        ).scalars()
    )
    for order in orders:
        if _is_resumable_switch_order(order, holding_id=holding_id):
            return order
    return None


async def get_switch_order(session: AsyncSession, *, user_id: uuid.UUID, order_id: uuid.UUID) -> MfOrder | None:
    order = await session.get(MfOrder, order_id)
    if not order or order.user_id != user_id or order.order_type != MfOrderType.switch:
        return None
    return order


async def get_switch_consent_context(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    order_id: uuid.UUID,
) -> dict[str, Any]:
    order = await get_switch_order(session, user_id=user_id, order_id=order_id)
    if not order:
        raise MfOrderError(code="order_not_found", message="Switch order not found", status_code=404)
    meta = _order_meta(order)
    folio_number = str(meta.get("folio_number") or "")
    if not folio_number:
        raise MfOrderError(code="order_not_ready", message="Switch order is missing folio details", status_code=409)
    mfia = await session.get(MfInvestmentAccount, order.mf_investment_account_id) if order.mf_investment_account_id else None
    fp_mfia_id = mfia.fp_mfia_id if mfia else None
    if not fp_mfia_id:
        raise MfOrderError(code="mfia_not_ready", message="Investment account is not ready yet", status_code=409)
    folio_payload = await list_mf_folios(fp_mfia_id=fp_mfia_id, folio_number=folio_number)
    email, mobile = _extract_folio_consent_contacts(folio_payload)
    if not email or not mobile:
        raise MfOrderError(
            code="consent_contact_missing",
            message="Folio registered email and mobile are required for switch consent",
            status_code=409,
        )
    return {
        "order_id": str(order.id),
        "fp_switch_id": _fp_switch_id(order) or "",
        "status": order.status.value,
        "fp_state": order.fp_state,
        "masked_email": _mask_email(email),
        "masked_mobile": _mask_mobile(mobile),
        "consent_otp_sent": bool(meta.get("consent_otp_sent")),
        "switch_confirmed": bool(meta.get("switch_confirmed")),
    }


async def send_switch_consent_otp(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    order_id: uuid.UUID,
    ip: str | None = None,
) -> dict[str, Any]:
    order = await get_switch_order(session, user_id=user_id, order_id=order_id)
    if not order:
        raise MfOrderError(code="order_not_found", message="Switch order not found", status_code=404)
    if order.status in TERMINAL_STATUSES:
        raise MfOrderError(code="order_terminal", message="This switch order is already closed", status_code=409)
    meta = _order_meta(order)
    folio_number = str(meta.get("folio_number") or "")
    mfia = await session.get(MfInvestmentAccount, order.mf_investment_account_id) if order.mf_investment_account_id else None
    fp_mfia_id = mfia.fp_mfia_id if mfia else None
    if not fp_mfia_id or not folio_number:
        raise MfOrderError(code="order_not_ready", message="Switch order is not ready for consent", status_code=409)
    folio_payload = await list_mf_folios(fp_mfia_id=fp_mfia_id, folio_number=folio_number)
    email, mobile = _extract_folio_consent_contacts(folio_payload)
    if not mobile:
        raise MfOrderError(code="consent_contact_missing", message="Folio registered mobile is unavailable", status_code=409)
    try:
        otp_meta = await request_otp(OtpPurpose.fund_confirmation, str(order.id), ip=ip, destination=mobile)
    except (OtpCooldownError, OtpRateLimitError) as exc:
        raise MfOrderError(code="otp_rate_limited", message=str(exc), status_code=429) from exc
    order.metadata_ = {**meta, "consent_otp_sent": True, "consent_email": email, "consent_mobile": mobile}
    await session.flush()
    return {"order_id": str(order.id), "masked_mobile": _mask_mobile(mobile), **otp_meta}


async def _create_fp_switch_after_otp(session: AsyncSession, order: MfOrder) -> str:
    meta = _order_meta(order)
    folio_number = str(meta.get("folio_number") or "")
    out_scheme = str(meta.get("switch_out_scheme") or order.fp_scheme_id or "")
    in_scheme = str(meta.get("switch_in_scheme") or "")
    mfia = await session.get(MfInvestmentAccount, order.mf_investment_account_id) if order.mf_investment_account_id else None
    fp_mfia_id = str(meta.get("fp_mfia_id") or (mfia.fp_mfia_id if mfia else "") or "")
    if not folio_number or not out_scheme or not in_scheme or not fp_mfia_id:
        raise MfOrderError(code="order_not_ready", message="Switch order is not ready to submit", status_code=409)

    switch_mode = str(meta.get("switch_mode") or "")
    amount = meta.get("amount")
    units = meta.get("units")
    fp_amount = float(amount) if amount is not None and switch_mode == "amount" else None
    fp_units = float(units) if units is not None and switch_mode == "units" else None
    user_ip = str(meta.get("user_ip") or "") or None

    try:
        fp_result = await create_mf_switch(
            fp_mfia_id=fp_mfia_id,
            folio_number=folio_number,
            switch_out_scheme=out_scheme,
            switch_in_scheme=in_scheme,
            source_ref_id=str(order.id),
            amount_inr=fp_amount,
            units=fp_units,
            user_ip=user_ip,
        )
    except FpClientError as exc:
        order.status = MfOrderStatus.failed
        order.failure_code = exc.code or "fp_switch_failed"
        order.failure_reason = exc.message
        await session.flush()
        raise MfOrderError(
            code=order.failure_code,
            message=exc.message,
            status_code=exc.status_code,
        ) from exc

    fp_switch_id = fp_result.get("fp_switch_id")
    if not fp_switch_id:
        order.status = MfOrderStatus.failed
        order.failure_code = "fp_switch_failed"
        order.failure_reason = "FinPrim did not return a switch id"
        await session.flush()
        raise MfOrderError(code="fp_switch_failed", message="FinPrim did not return a switch id", status_code=502)

    order.fp_state = str(fp_result.get("state") or "pending")
    order.metadata_ = {**meta, "fp_switch_id": fp_switch_id}
    await session.flush()
    return str(fp_switch_id)


async def confirm_switch_order(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    order_id: uuid.UUID,
    otp: str,
    ip: str | None = None,
) -> MfOrder:
    del ip
    order = await get_switch_order(session, user_id=user_id, order_id=order_id)
    if not order:
        raise MfOrderError(code="order_not_found", message="Switch order not found", status_code=404)
    if order.status in TERMINAL_STATUSES:
        raise MfOrderError(code="order_terminal", message="This switch order is already closed", status_code=409)
    meta = _order_meta(order)
    if not meta.get("consent_otp_sent"):
        raise MfOrderError(code="consent_otp_required", message="Send OTP before confirming switch", status_code=409)
    if not await verify_otp(OtpPurpose.fund_confirmation, str(order.id), otp.strip()):
        raise MfOrderError(code="invalid_otp", message="Invalid or expired OTP", status_code=400)
    email = meta.get("consent_email")
    mobile = meta.get("consent_mobile")
    if not email or not mobile:
        raise MfOrderError(code="order_not_ready", message="Switch consent details are incomplete", status_code=409)

    fp_switch_id = _fp_switch_id(order)
    if not fp_switch_id:
        fp_switch_id = await _create_fp_switch_after_otp(session, order)
        meta = _order_meta(order)

    try:
        result = await update_mf_switch(
            fp_switch_id,
            body={"state": "confirmed", "consent": {"email": email, "mobile": mobile, "isd_code": "91"}},
        )
    except FpClientError as exc:
        raise MfOrderError(code=exc.code or "fp_confirm_failed", message=exc.message, status_code=exc.status_code) from exc
    previous = order.status.value
    order.fp_state = str(result.get("state") or order.fp_state)
    order.status = map_fp_switch_state_to_order(order.fp_state)
    order.metadata_ = {**meta, "switch_confirmed": True}
    _maybe_mark_switch_submitted(order)
    await session.flush()
    await _record_order_event(
        session,
        order,
        from_status=previous,
        to_status=order.status.value,
        source="USER",
        payload={"stage": "confirmed", "fp_switch_id": fp_switch_id},
    )
    await invalidate_user_portfolio_cache(user_id)
    return order


async def apply_switch_fp_state(
    session: AsyncSession,
    order: MfOrder,
    *,
    fp_state: str | None,
    source: str,
    payload: dict[str, Any] | None = None,
) -> bool:
    if order.order_type != MfOrderType.switch:
        return False
    if order.status in TERMINAL_STATUSES:
        return False
    mapped = map_fp_switch_state_to_order(fp_state)
    if mapped == order.status and fp_state == order.fp_state:
        return False
    previous = order.status.value
    order.fp_state = str(fp_state) if fp_state is not None else order.fp_state
    order.status = mapped
    if mapped == MfOrderStatus.succeeded:
        order.settled_at = datetime.now(timezone.utc)
        order.failure_code = None
        order.failure_reason = None
    elif mapped in {MfOrderStatus.failed, MfOrderStatus.cancelled}:
        fp_code, fp_reason = extract_fp_redemption_failure(payload or {})
        order.failure_code = fp_code or order.failure_code
        order.failure_reason = fp_reason or order.failure_reason
    _maybe_mark_switch_submitted(order)
    await session.flush()
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


async def sync_switch_order_from_fp(session: AsyncSession, order: MfOrder) -> bool:
    fp_switch_id = _fp_switch_id(order)
    if not fp_switch_id:
        return False
    try:
        payload = await get_mf_switch(fp_switch_id)
    except FpClientError:
        logger.exception("Failed to refresh switch %s", fp_switch_id)
        return False
    return await apply_switch_fp_state(
        session,
        order,
        fp_state=extract_fp_state(payload),
        source="POLL",
        payload=payload if isinstance(payload, dict) else {},
    )


async def get_switch_journey(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    order_id: uuid.UUID,
) -> dict[str, Any]:
    order = await get_switch_order(session, user_id=user_id, order_id=order_id)
    if not order:
        return {"status": "not_found", "journey": None}
    events = (
        await session.execute(
            select(MfOrderEvent).where(MfOrderEvent.order_id == order.id).order_by(MfOrderEvent.created_at.asc())
        )
    ).scalars().all()
    meta = _order_meta(order)
    return {
        "status": "ok",
        "journey": {
            "order_id": str(order.id),
            "status": order.status.value,
            "amount_inr": float(order.amount_inr),
            "units": float(meta.get("units") or 0),
            "placed_at": order.created_at.isoformat() if order.created_at else "",
            "folio_number": meta.get("folio_number"),
            "isin": meta.get("isin"),
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


def serialize_switch_order(order: MfOrder, *, product_name: str | None = None) -> dict[str, Any]:
    meta = _order_meta(order)
    next_action = "complete"
    if not bool(meta.get("switch_confirmed")) and order.status not in TERMINAL_STATUSES:
        next_action = "confirm_consent"
    elif order.status in {MfOrderStatus.pending, MfOrderStatus.processing, MfOrderStatus.payment_pending}:
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
        "fp_switch_id": meta.get("fp_switch_id"),
        "fp_state": order.fp_state,
        "holding_id": meta.get("holding_id"),
        "folio_number": meta.get("folio_number"),
        "isin": meta.get("isin"),
        "switch_in_scheme": meta.get("switch_in_scheme"),
        "switch_in_product_id": meta.get("switch_in_product_id"),
        "units": meta.get("units"),
        "switch_mode": meta.get("switch_mode"),
        "next_action": next_action,
        "consent_otp_sent": bool(meta.get("consent_otp_sent")),
        "switch_confirmed": bool(meta.get("switch_confirmed")),
        "failure_code": order.failure_code,
        "failure_reason": order.failure_reason,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "submitted_at": order.submitted_at.isoformat() if order.submitted_at else None,
        "settled_at": order.settled_at.isoformat() if order.settled_at else None,
    }


async def list_fp_switches_for_mfia(*, fp_mfia_id: str) -> list[dict[str, Any]]:
    payload = await list_mf_switches(fp_mfia_id=fp_mfia_id, states="pending,confirmed,submitted")
    rows = payload.get("data") if isinstance(payload, dict) else None
    if isinstance(rows, list):
        return [row for row in rows if isinstance(row, dict)]
    return []
