"""ONDC lumpsum payment pipeline — consent, payment, confirm, UPI link."""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.mf_fp_state import map_fp_purchase_state, map_fp_purchase_state_to_checkout
from app.application.mf.mf_folio_defaults_service import ensure_mfia_folio_defaults
from app.application.mf.mf_order_service import TERMINAL_STATUSES, _record_order_event, get_or_create_mf_investment_account
from app.application.mf.mf_transaction_retry import bump_transient_retry, is_transient_error, should_skip_retry
from app.application.referral.referral_investment_service import record_referral_investment_activity
from app.core.config import get_settings
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.mf.fp_oms_client import (
    create_mf_investment_account,
    create_mf_purchase,
    create_mf_purchases_batch,
    extract_fp_old_id,
    extract_fp_state,
    get_mf_purchase,
    update_mf_purchase,
    update_mf_purchases_batch,
)
from app.infrastructure.mf.fp_payment_client import create_netbanking_payment, extract_payment_token_url, get_payment
from app.infrastructure.persistence.investor_models import (
    InvestorBankAccount,
    InvestorObjectSyncStatus,
    InvestorProfile,
    InvestorProfileStatus,
)
from app.infrastructure.persistence.mf_models import MutualFund
from app.infrastructure.persistence.mf_transaction_models import (
    MfCheckout,
    MfCheckoutStatus,
    MfCheckoutType,
    MfInvestmentAccount,
    MfInvestmentAccountStatus,
    MfOrder,
    MfOrderStatus,
)
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.referral_models import ReferralInvestmentProduct

logger = logging.getLogger(__name__)

_REVIEW_STATES = {"under_review", "review_completed"}
_PAYMENT_PIPELINE_STATES = {"pending", "confirmed"}


def _purchase_scheme(order: MfOrder, fund: MutualFund | None) -> str | None:
    scheme = (order.fp_scheme_id or "").strip()
    if scheme.upper().startswith("INF"):
        return scheme.upper()
    if fund and fund.isin_growth:
        return fund.isin_growth.upper()
    return scheme or None


def _order_metadata(order: MfOrder) -> dict[str, Any]:
    return dict(order.metadata_ or {})


def _ondc_metadata(order: MfOrder) -> dict[str, Any]:
    meta = _order_metadata(order)
    ondc = meta.get("ondc")
    return dict(ondc) if isinstance(ondc, dict) else {}


def _checkout_metadata(checkout: MfCheckout) -> dict[str, Any]:
    return dict(checkout.metadata_ or {})


def _ondc_checkout_metadata(checkout: MfCheckout) -> dict[str, Any]:
    meta = _checkout_metadata(checkout)
    ondc = meta.get("ondc")
    return dict(ondc) if isinstance(ondc, dict) else {}


async def _set_checkout_ondc_metadata(session: AsyncSession, checkout: MfCheckout, **updates: Any) -> None:
    meta = _checkout_metadata(checkout)
    ondc = _ondc_checkout_metadata(checkout)
    ondc.update(updates)
    checkout.metadata_ = {**meta, "ondc": ondc}
    await session.flush()


async def _load_checkout_orders(session: AsyncSession, checkout_id) -> list[MfOrder]:
    return list(
        (
            await session.execute(
                select(MfOrder)
                .where(MfOrder.checkout_id == checkout_id)
                .order_by(MfOrder.line_index, MfOrder.created_at)
            )
        ).scalars()
    )


async def _set_ondc_metadata(session: AsyncSession, order: MfOrder, **updates: Any) -> None:
    meta = _order_metadata(order)
    ondc = _ondc_metadata(order)
    ondc.update(updates)
    order.metadata_ = {**meta, "ondc": ondc}
    await session.flush()


def _normalize_mobile(phone: str | None) -> str | None:
    if not phone:
        return None
    raw = phone.strip()
    if raw.startswith("+91"):
        raw = raw[3:]
    raw = re.sub(r"\D", "", raw.lstrip("+"))
    return raw or None


async def _load_consent_contact(session: AsyncSession, *, user_id) -> tuple[str, str] | None:
    user = await session.get(User, user_id)
    if not user or not user.email:
        return None
    mobile = _normalize_mobile(user.phone)
    if not mobile:
        return None
    return user.email.lower(), mobile


async def _load_primary_bank_old_id(session: AsyncSession, *, user_id) -> int | None:
    bank = await session.scalar(
        select(InvestorBankAccount).where(
            InvestorBankAccount.investor_profile_id == user_id,
            InvestorBankAccount.is_primary.is_(True),
            InvestorBankAccount.sync_status == InvestorObjectSyncStatus.active,
        )
    )
    if not bank or bank.external_old_id is None:
        bank = await session.scalar(
            select(InvestorBankAccount).where(
                InvestorBankAccount.investor_profile_id == user_id,
                InvestorBankAccount.sync_status == InvestorObjectSyncStatus.active,
                InvestorBankAccount.external_old_id.is_not(None),
            )
        )
    return bank.external_old_id if bank else None


async def _load_checkout_bank_old_id(session: AsyncSession, checkout: MfCheckout) -> int | None:
    metadata = checkout.metadata_ if isinstance(checkout.metadata_, dict) else {}
    bank_id = metadata.get("investor_bank_account_id")
    if bank_id:
        try:
            parsed_bank_id = uuid.UUID(str(bank_id))
        except ValueError:
            parsed_bank_id = None
        if parsed_bank_id:
            bank = await session.scalar(
                select(InvestorBankAccount).where(
                    InvestorBankAccount.id == parsed_bank_id,
                    InvestorBankAccount.investor_profile_id == checkout.user_id,
                    InvestorBankAccount.sync_status == InvestorObjectSyncStatus.active,
                )
            )
            if bank and bank.external_old_id is not None:
                return int(bank.external_old_id)
    return await _load_primary_bank_old_id(session, user_id=checkout.user_id)


async def _load_order_bank_old_id(session: AsyncSession, order: MfOrder) -> int | None:
    if order.checkout_id:
        checkout = await session.get(MfCheckout, order.checkout_id)
        if checkout:
            return await _load_checkout_bank_old_id(session, checkout)
    return await _load_primary_bank_old_id(session, user_id=order.user_id)


async def _ensure_fp_mfia(session: AsyncSession, *, user_id, mfia) -> str | None:
    if mfia.fp_mfia_id and mfia.status == MfInvestmentAccountStatus.active:
        folio_ready = await ensure_mfia_folio_defaults(session, user_id=user_id, mfia=mfia)
        return mfia.fp_mfia_id if folio_ready else None

    profile = await session.get(InvestorProfile, user_id)
    if not profile or profile.status != InvestorProfileStatus.active or not profile.external_profile_id:
        return None

    settings = get_settings()
    if not settings.resolved_fp_enabled:
        logger.warning("Skipping MFIA creation for user=%s — Finprim is not enabled", user_id)
        return None

    result = await create_mf_investment_account(investor_profile_id=profile.external_profile_id)
    fp_mfia_id = result.get("fp_mfia_id")
    if not fp_mfia_id:
        mfia.status = MfInvestmentAccountStatus.failed
        mfia.failure_reason = "Cybrilla did not return mf_investment_account id"
        await session.flush()
        return None

    mfia.fp_mfia_id = fp_mfia_id
    mfia.fp_mfia_old_id = result.get("fp_mfia_old_id")
    mfia.status = MfInvestmentAccountStatus.active
    await session.flush()

    if not await ensure_mfia_folio_defaults(session, user_id=user_id, mfia=mfia):
        return None
    return fp_mfia_id


async def _apply_fp_state(
    session: AsyncSession,
    order: MfOrder,
    *,
    fp_state: str | None,
    source: str,
    payload: dict[str, Any] | None = None,
) -> bool:
    if order.status in TERMINAL_STATUSES:
        return False

    mapped = map_fp_purchase_state(fp_state)
    if mapped == order.status and fp_state == order.fp_state:
        return False

    previous = order.status.value
    order.fp_state = fp_state or order.fp_state
    order.status = mapped
    if mapped == MfOrderStatus.succeeded:
        order.settled_at = datetime.now(timezone.utc)
        user = await session.get(User, order.user_id)
        if user:
            await record_referral_investment_activity(
                session,
                user=user,
                product=ReferralInvestmentProduct.mutual_fund,
                amount_inr=int(order.amount_inr),
            )
        from app.application.goals.goal_funding_service import record_contribution_from_order

        await record_contribution_from_order(session, order)
    elif mapped == MfOrderStatus.failed:
        order.failure_code = order.failure_code or "fp_terminal_failed"
        order.failure_reason = order.failure_reason or str(fp_state)

    if order.checkout_id:
        checkout = await session.get(MfCheckout, order.checkout_id)
        if checkout:
            checkout.status = map_fp_purchase_state_to_checkout(fp_state)

    await _record_order_event(
        session,
        order,
        from_status=previous,
        to_status=order.status.value,
        source=source,
        payload={"fp_state": order.fp_state, **(payload or {})},
    )
    return True


async def _sync_checkout_payment_url(session: AsyncSession, order: MfOrder, *, token_url: str | None) -> None:
    if not order.checkout_id or not token_url:
        return
    checkout = await session.get(MfCheckout, order.checkout_id)
    if checkout and not checkout.token_url:
        checkout.token_url = token_url
        checkout.status = MfCheckoutStatus.submitted
        await session.flush()


async def submit_pending_order(session: AsyncSession, order: MfOrder, *, user_ip: str | None = None) -> bool:
    if order.status != MfOrderStatus.pending:
        return False
    if should_skip_retry(order.metadata_):
        return False

    if order.checkout_id:
        checkout = await session.get(MfCheckout, order.checkout_id)
        if checkout and checkout.checkout_type == MfCheckoutType.cart:
            return False

    mfia = await get_or_create_mf_investment_account(session, user_id=order.user_id)
    order.mf_investment_account_id = mfia.id
    fp_mfia_id = await _ensure_fp_mfia(session, user_id=order.user_id, mfia=mfia)
    fund = await session.get(MutualFund, order.fund_id)
    scheme = _purchase_scheme(order, fund)
    if not fp_mfia_id or not scheme:
        return False

    try:
        result = await create_mf_purchase(
            fp_mfia_id=fp_mfia_id,
            scheme=scheme,
            amount_inr=float(order.amount_inr),
            source_ref_id=str(order.id),
            user_ip=user_ip or (_order_metadata(order).get("user_ip")),
            gateway=get_settings().zynd_mf_order_payment_gateway,
        )
    except Exception as exc:
        logger.exception("MF purchase submit failed order=%s", order.id)
        if is_transient_error(exc):
            order.metadata_, terminal = bump_transient_retry(
                order.metadata_,
                error_code="fp_submit_failed",
                error_message=str(exc),
            )
            await session.flush()
            return not terminal
        previous = order.status.value
        order.status = MfOrderStatus.failed
        order.failure_code = "fp_submit_failed"
        order.failure_reason = str(exc)
        await _record_order_event(
            session,
            order,
            from_status=previous,
            to_status=order.status.value,
            source="WORKER",
            payload={"error": str(exc)},
        )
        return True

    from datetime import datetime, timezone

    previous = order.status.value
    order.fp_purchase_id = result.get("fp_purchase_id")
    order.fp_purchase_old_id = result.get("fp_purchase_old_id")
    order.fp_state = result.get("state")
    order.status = map_fp_purchase_state(order.fp_state)
    if order.status not in TERMINAL_STATUSES:
        order.submitted_at = datetime.now(timezone.utc)
    if order.checkout_id:
        checkout = await session.get(MfCheckout, order.checkout_id)
        if checkout:
            checkout.status = map_fp_purchase_state_to_checkout(order.fp_state)
    await _record_order_event(
        session,
        order,
        from_status=previous,
        to_status=order.status.value,
        source="WORKER",
        payload={
            "fp_purchase_id": order.fp_purchase_id,
            "fp_purchase_old_id": order.fp_purchase_old_id,
            "fp_state": order.fp_state,
        },
    )
    return True


async def submit_pending_cart_checkout(
    session: AsyncSession,
    checkout: MfCheckout,
    orders: list[MfOrder],
    *,
    user_ip: str | None = None,
) -> bool:
    if checkout.checkout_type != MfCheckoutType.cart:
        return False
    if not orders or not all(order.status == MfOrderStatus.pending for order in orders):
        return False
    if should_skip_retry(checkout.metadata_):
        return False

    user_id = checkout.user_id
    mfia = await get_or_create_mf_investment_account(session, user_id=user_id)
    fp_mfia_id = await _ensure_fp_mfia(session, user_id=user_id, mfia=mfia)
    if not fp_mfia_id:
        return False

    resolved_ip = user_ip or _checkout_metadata(checkout).get("user_ip")
    if resolved_ip is None and orders:
        resolved_ip = _order_metadata(orders[0]).get("user_ip")

    fund_ids = {order.fund_id for order in orders}
    funds = {
        row.id: row
        for row in (await session.execute(select(MutualFund).where(MutualFund.id.in_(fund_ids)))).scalars()
    } if fund_ids else {}

    purchases = []
    for order in orders:
        scheme = _purchase_scheme(order, funds.get(order.fund_id))
        if not scheme:
            continue
        purchases.append(
            {
                "fp_mfia_id": fp_mfia_id,
                "scheme": scheme,
                "amount_inr": float(order.amount_inr),
                "source_ref_id": str(order.id),
            }
        )
    if len(purchases) != len(orders):
        return False

    try:
        results = await create_mf_purchases_batch(purchases=purchases, user_ip=resolved_ip)
    except Exception as exc:
        logger.exception("MF cart batch submit failed checkout=%s", checkout.id)
        if is_transient_error(exc):
            checkout.metadata_, terminal = bump_transient_retry(
                checkout.metadata_,
                error_code="fp_batch_submit_failed",
                error_message=str(exc),
            )
            await session.flush()
            return not terminal
        for order in orders:
            previous = order.status.value
            order.status = MfOrderStatus.failed
            order.failure_code = "fp_batch_submit_failed"
            order.failure_reason = str(exc)
            await _record_order_event(
                session,
                order,
                from_status=previous,
                to_status=order.status.value,
                source="WORKER",
                payload={"error": str(exc)},
            )
        checkout.status = MfCheckoutStatus.failed
        checkout.failure_code = "fp_batch_submit_failed"
        checkout.failure_reason = str(exc)
        await session.flush()
        return True

    by_source_ref = {
        str(result.get("source_ref_id")): result
        for result in results
        if result.get("source_ref_id")
    }
    from datetime import datetime, timezone

    for order in orders:
        result = by_source_ref.get(str(order.id))
        if not result:
            previous = order.status.value
            order.status = MfOrderStatus.failed
            order.failure_code = "fp_batch_result_missing"
            order.failure_reason = "Batch purchase result missing for cart line"
            await _record_order_event(
                session,
                order,
                from_status=previous,
                to_status=order.status.value,
                source="WORKER",
                payload={"error": order.failure_reason},
            )
            continue

        order.mf_investment_account_id = mfia.id
        previous = order.status.value
        order.fp_purchase_id = result.get("fp_purchase_id")
        order.fp_purchase_old_id = result.get("fp_purchase_old_id")
        order.fp_state = result.get("state")
        order.status = map_fp_purchase_state(order.fp_state)
        if order.status not in TERMINAL_STATUSES:
            order.submitted_at = datetime.now(timezone.utc)
        await _record_order_event(
            session,
            order,
            from_status=previous,
            to_status=order.status.value,
            source="WORKER",
            payload={
                "fp_purchase_id": order.fp_purchase_id,
                "fp_purchase_old_id": order.fp_purchase_old_id,
                "fp_state": order.fp_state,
                "batch": True,
            },
        )

    if orders:
        checkout.status = map_fp_purchase_state_to_checkout(orders[0].fp_state)
    await session.flush()
    return True


async def _apply_purchase_consent(session: AsyncSession, order: MfOrder) -> None:
    contact = await _load_consent_contact(session, user_id=order.user_id)
    if not contact or not order.fp_purchase_id:
        raise FpClientError("Consent contact unavailable", "consent_contact_missing", 400)
    email, mobile = contact
    await update_mf_purchase(
        order.fp_purchase_id,
        body={
            "consent": {
                "email": email,
                "mobile": mobile,
                "isd_code": "91",
            }
        },
    )
    await _set_ondc_metadata(session, order, consent_applied=True)


async def _create_checkout_payment(session: AsyncSession, order: MfOrder) -> None:
    if not order.fp_purchase_old_id:
        raise FpClientError("Purchase old_id missing", "purchase_old_id_missing", 400)
    bank_old_id = await _load_order_bank_old_id(session, order)
    if bank_old_id is None:
        raise FpClientError("Bank old_id missing", "bank_old_id_missing", 400)

    settings = get_settings()
    payment = await create_netbanking_payment(
        amc_order_ids=[int(order.fp_purchase_old_id)],
        bank_account_id=int(bank_old_id),
        method="UPI",
        provider_name="ONDC" if settings.zynd_mf_order_payment_gateway == "ondc" else "CYBRILLAPOA",
    )
    payment_id = payment.get("id")
    token_url = payment.get("token_url")

    if order.checkout_id:
        checkout = await session.get(MfCheckout, order.checkout_id)
        if checkout:
            if payment_id is not None:
                checkout.fp_payment_id = int(payment_id)
            if token_url:
                checkout.token_url = token_url
            checkout.status = MfCheckoutStatus.payment_pending
            await session.flush()

    await _set_ondc_metadata(session, order, payment_created=True, fp_payment_id=payment_id)


async def _create_cart_checkout_payment(
    session: AsyncSession,
    checkout: MfCheckout,
    orders: list[MfOrder],
) -> None:
    amc_order_ids = [order.fp_purchase_old_id for order in orders]
    if not amc_order_ids or any(value is None for value in amc_order_ids):
        raise FpClientError("Purchase old_id missing", "purchase_old_id_missing", 400)

    bank_old_id = await _load_checkout_bank_old_id(session, checkout)
    if bank_old_id is None:
        raise FpClientError("Bank old_id missing", "bank_old_id_missing", 400)

    settings = get_settings()
    payment = await create_netbanking_payment(
        amc_order_ids=[int(value) for value in amc_order_ids if value is not None],
        bank_account_id=int(bank_old_id),
        method="UPI",
        provider_name="ONDC" if settings.zynd_mf_order_payment_gateway == "ondc" else "CYBRILLAPOA",
    )
    payment_id = payment.get("id")
    token_url = payment.get("token_url")

    if payment_id is not None:
        checkout.fp_payment_id = int(payment_id)
    if token_url:
        checkout.token_url = token_url
    checkout.status = MfCheckoutStatus.payment_pending
    await session.flush()

    await _set_checkout_ondc_metadata(session, checkout, payment_created=True, fp_payment_id=payment_id)
    for order in orders:
        await _set_ondc_metadata(session, order, payment_created=True, fp_payment_id=payment_id)


async def _confirm_cart_purchases(session: AsyncSession, checkout: MfCheckout, orders: list[MfOrder]) -> None:
    updates = [{"id": order.fp_purchase_id, "state": "confirmed"} for order in orders if order.fp_purchase_id]
    if not updates:
        raise FpClientError("Purchase id missing", "purchase_id_missing", 400)

    results = await update_mf_purchases_batch(updates=updates)
    by_purchase_id = {str(result.get("fp_purchase_id")): result for result in results if result.get("fp_purchase_id")}

    for order in orders:
        result = by_purchase_id.get(order.fp_purchase_id or "")
        if result:
            order.fp_state = result.get("state") or order.fp_state
            await _set_ondc_metadata(session, order, purchase_confirmed=True)
        payload = await get_mf_purchase(order.fp_purchase_id) if order.fp_purchase_id else {}
        fp_state = (extract_fp_state(payload) or order.fp_state or "").lower()
        await _apply_fp_state(session, order, fp_state=fp_state, source="WORKER", payload={"stage": "confirm_batch"})

    await _set_checkout_ondc_metadata(session, checkout, purchases_confirmed=True)


async def _confirm_purchase(session: AsyncSession, order: MfOrder) -> None:
    if not order.fp_purchase_id:
        raise FpClientError("Purchase id missing", "purchase_id_missing", 400)
    result = await update_mf_purchase(order.fp_purchase_id, body={"state": "confirmed"})
    order.fp_state = result.get("state") or order.fp_state
    await _set_ondc_metadata(session, order, purchase_confirmed=True)


async def _refresh_payment_link(session: AsyncSession, order: MfOrder) -> None:
    ondc = _ondc_metadata(order)
    payment_id = ondc.get("fp_payment_id")
    if payment_id is None and order.checkout_id:
        checkout = await session.get(MfCheckout, order.checkout_id)
        payment_id = checkout.fp_payment_id if checkout else None
    if payment_id is None:
        return

    payload = await get_payment(int(payment_id))
    token_url = extract_payment_token_url(payload)
    await _sync_checkout_payment_url(session, order, token_url=token_url)
    if order.checkout_id and token_url:
        checkout = await session.get(MfCheckout, order.checkout_id)
        if checkout:
            checkout.status = MfCheckoutStatus.submitted


async def _refresh_cart_payment_link(session: AsyncSession, checkout: MfCheckout) -> None:
    payment_id = checkout.fp_payment_id
    if payment_id is None:
        ondc = _ondc_checkout_metadata(checkout)
        payment_id = ondc.get("fp_payment_id")
    if payment_id is None:
        return

    payload = await get_payment(int(payment_id))
    token_url = extract_payment_token_url(payload)
    if token_url and not checkout.token_url:
        checkout.token_url = token_url
        checkout.status = MfCheckoutStatus.submitted
        await session.flush()


async def advance_ondc_cart_checkout(session: AsyncSession, checkout: MfCheckout) -> bool:
    if checkout.checkout_type != MfCheckoutType.cart:
        return False

    orders = await _load_checkout_orders(session, checkout.id)
    open_orders = [order for order in orders if order.status not in TERMINAL_STATUSES and order.fp_purchase_id]
    if not open_orders:
        return False

    changed = False
    for order in open_orders:
        payload = await get_mf_purchase(order.fp_purchase_id)
        fp_state = (extract_fp_state(payload) or order.fp_state or "").lower()
        old_id = extract_fp_old_id(payload)
        if old_id is not None and order.fp_purchase_old_id is None:
            order.fp_purchase_old_id = old_id
            changed = True
        if await _apply_fp_state(session, order, fp_state=fp_state, source="WORKER", payload={"stage": "poll"}):
            changed = True

    open_orders = [order for order in orders if order.status not in TERMINAL_STATUSES and order.fp_purchase_id]
    if not open_orders:
        return changed

    ondc_checkout = _ondc_checkout_metadata(checkout)

    try:
        if any((order.fp_state or "").lower() in _REVIEW_STATES for order in open_orders):
            return changed

        all_pending = all((order.fp_state or "").lower() == "pending" for order in open_orders)
        if all_pending:
            for order in open_orders:
                ondc = _ondc_metadata(order)
                if not ondc.get("consent_applied"):
                    await _apply_purchase_consent(session, order)
                    changed = True
                    payload = await get_mf_purchase(order.fp_purchase_id)
                    fp_state = (extract_fp_state(payload) or order.fp_state or "").lower()
                    if await _apply_fp_state(
                        session,
                        order,
                        fp_state=fp_state,
                        source="WORKER",
                        payload={"stage": "consent"},
                    ):
                        changed = True

            open_orders = [
                order
                for order in orders
                if order.status not in TERMINAL_STATUSES and order.fp_purchase_id
            ]
            all_pending = all((order.fp_state or "").lower() == "pending" for order in open_orders)
            all_consented = all(_ondc_metadata(order).get("consent_applied") for order in open_orders)

            ondc_checkout = _ondc_checkout_metadata(checkout)
            if all_pending and all_consented and not ondc_checkout.get("payment_created"):
                await _create_cart_checkout_payment(session, checkout, open_orders)
                changed = True

            ondc_checkout = _ondc_checkout_metadata(checkout)
            if (
                all_pending
                and ondc_checkout.get("payment_created")
                and not ondc_checkout.get("purchases_confirmed")
            ):
                await _confirm_cart_purchases(session, checkout, open_orders)
                changed = True

        if any(
            order.status == MfOrderStatus.submitted or (order.fp_state or "").lower() == "submitted"
            for order in orders
        ):
            await _refresh_cart_payment_link(session, checkout)
            changed = True
    except FpClientError as exc:
        logger.exception("ONDc cart advance failed checkout=%s", checkout.id)
        if is_transient_error(exc):
            meta, terminal = bump_transient_retry(checkout.metadata_, error_code=exc.code, error_message=exc.message)
            checkout.metadata_ = meta
            await session.flush()
            return not terminal
        checkout.status = MfCheckoutStatus.failed
        checkout.failure_code = exc.code
        checkout.failure_reason = exc.message
        for order in open_orders:
            if order.status in TERMINAL_STATUSES:
                continue
            previous = order.status.value
            order.status = MfOrderStatus.failed
            order.failure_code = exc.code
            order.failure_reason = exc.message
            await _record_order_event(
                session,
                order,
                from_status=previous,
                to_status=order.status.value,
                source="WORKER",
                payload={"error": exc.message, "code": exc.code, "batch": True},
            )
        return True

    return changed


async def advance_ondc_order(session: AsyncSession, order: MfOrder) -> bool:
    if order.status in TERMINAL_STATUSES or not order.fp_purchase_id:
        return False
    if should_skip_retry(order.metadata_):
        return False

    if order.checkout_id:
        checkout = await session.get(MfCheckout, order.checkout_id)
        if checkout and checkout.checkout_type == MfCheckoutType.cart:
            return False

    changed = False
    payload = await get_mf_purchase(order.fp_purchase_id)
    fp_state = (extract_fp_state(payload) or order.fp_state or "").lower()
    old_id = extract_fp_old_id(payload)
    if old_id is not None and order.fp_purchase_old_id is None:
        order.fp_purchase_old_id = old_id
        changed = True

    if await _apply_fp_state(session, order, fp_state=fp_state, source="WORKER", payload={"stage": "poll"}):
        changed = True

    if order.status in TERMINAL_STATUSES:
        return changed

    ondc = _ondc_metadata(order)

    try:
        if fp_state in _REVIEW_STATES:
            return changed

        if fp_state == "pending":
            if not ondc.get("consent_applied"):
                await _apply_purchase_consent(session, order)
                changed = True
                payload = await get_mf_purchase(order.fp_purchase_id)
                fp_state = (extract_fp_state(payload) or fp_state).lower()

            if fp_state == "pending" and not ondc.get("payment_created"):
                await _create_checkout_payment(session, order)
                changed = True

            ondc = _ondc_metadata(order)
            if fp_state == "pending" and ondc.get("payment_created") and not ondc.get("purchase_confirmed"):
                await _confirm_purchase(session, order)
                changed = True
                payload = await get_mf_purchase(order.fp_purchase_id)
                fp_state = (extract_fp_state(payload) or fp_state).lower()
                if await _apply_fp_state(session, order, fp_state=fp_state, source="WORKER", payload={"stage": "confirm"}):
                    changed = True

        if fp_state == "submitted" or order.status == MfOrderStatus.submitted:
            await _refresh_payment_link(session, order)
            changed = True
    except FpClientError as exc:
        logger.exception("ONDc advance failed order=%s", order.id)
        if is_transient_error(exc):
            order.metadata_, terminal = bump_transient_retry(
                order.metadata_,
                error_code=exc.code,
                error_message=exc.message,
            )
            await session.flush()
            return not terminal
        previous = order.status.value
        order.status = MfOrderStatus.failed
        order.failure_code = exc.code
        order.failure_reason = exc.message
        await _record_order_event(
            session,
            order,
            from_status=previous,
            to_status=order.status.value,
            source="WORKER",
            payload={"error": exc.message, "code": exc.code},
        )
        return True

    return changed


async def sync_order_from_fp(session: AsyncSession, order: MfOrder) -> bool:
    if order.status in TERMINAL_STATUSES or not order.fp_purchase_id:
        return False

    payload = await get_mf_purchase(order.fp_purchase_id)
    fp_state = extract_fp_state(payload)
    old_id = extract_fp_old_id(payload)
    if old_id is not None and order.fp_purchase_old_id is None:
        order.fp_purchase_old_id = old_id

    return await _apply_fp_state(session, order, fp_state=fp_state, source="WORKER", payload={"stage": "sync"})


async def process_pending_orders(session: AsyncSession, *, batch_size: int = 20) -> dict[str, int]:
    submitted = skipped = 0

    cart_checkout_ids = list(
        (
            await session.execute(
                select(MfCheckout.id)
                .where(
                    MfCheckout.checkout_type == MfCheckoutType.cart,
                    MfCheckout.status == MfCheckoutStatus.pending,
                )
                .order_by(MfCheckout.created_at)
                .limit(batch_size)
            )
        ).scalars()
    )

    processed = 0
    for checkout_id in cart_checkout_ids:
        checkout = await session.get(MfCheckout, checkout_id)
        if not checkout:
            continue
        orders = await _load_checkout_orders(session, checkout_id)
        if not orders or not all(order.status == MfOrderStatus.pending for order in orders):
            skipped += 1
            processed += 1
            continue
        if await submit_pending_cart_checkout(session, checkout, orders):
            submitted += 1
        else:
            skipped += 1
        processed += 1

    remaining = max(batch_size - processed, 0)
    if remaining:
        single_orders = list(
            (
                await session.execute(
                    select(MfOrder)
                    .join(MfCheckout, MfCheckout.id == MfOrder.checkout_id)
                    .where(
                        MfOrder.status == MfOrderStatus.pending,
                        MfCheckout.checkout_type == MfCheckoutType.single,
                    )
                    .order_by(MfOrder.created_at)
                    .limit(remaining)
                )
            ).scalars()
        )
        for order in single_orders:
            if await submit_pending_order(session, order):
                submitted += 1
            else:
                skipped += 1
            processed += 1

    return {"processed": processed, "submitted": submitted, "skipped": skipped}


async def advance_ondc_orders(session: AsyncSession, *, batch_size: int = 20) -> dict[str, int]:
    cart_checkout_ids = list(
        (
            await session.execute(
                select(MfCheckout.id)
                .join(MfOrder, MfOrder.checkout_id == MfCheckout.id)
                .where(
                    MfCheckout.checkout_type == MfCheckoutType.cart,
                    MfOrder.fp_purchase_id.is_not(None),
                    MfOrder.status.not_in(list(TERMINAL_STATUSES)),
                )
                .group_by(MfCheckout.id)
                .order_by(func.max(MfCheckout.updated_at))
                .limit(batch_size)
            )
        ).scalars()
    )

    advanced = 0
    processed_cart_order_ids: set = set()

    for checkout_id in cart_checkout_ids:
        checkout = await session.get(MfCheckout, checkout_id)
        if not checkout:
            continue
        orders = await _load_checkout_orders(session, checkout_id)
        processed_cart_order_ids.update(order.id for order in orders)
        if await advance_ondc_cart_checkout(session, checkout):
            advanced += 1

    remaining = max(batch_size - len(cart_checkout_ids), 0)
    processed = len(cart_checkout_ids)
    if remaining:
        orders = list(
            (
                await session.execute(
                    select(MfOrder)
                    .where(
                        MfOrder.fp_purchase_id.is_not(None),
                        MfOrder.status.not_in(list(TERMINAL_STATUSES)),
                    )
                    .order_by(MfOrder.updated_at)
                    .limit(remaining * 3)
                )
            ).scalars()
        )
        for order in orders:
            if order.id in processed_cart_order_ids:
                continue
            if order.checkout_id:
                checkout = await session.get(MfCheckout, order.checkout_id)
                if checkout and checkout.checkout_type == MfCheckoutType.cart:
                    continue
            if await advance_ondc_order(session, order):
                advanced += 1
            processed += 1
            if processed >= batch_size:
                break
    else:
        processed = len(cart_checkout_ids)

    return {"processed": processed, "advanced": advanced}


async def sync_open_orders(session: AsyncSession, *, batch_size: int = 50) -> dict[str, int]:
    orders = list(
        (
            await session.execute(
                select(MfOrder)
                .where(
                    MfOrder.fp_purchase_id.is_not(None),
                    MfOrder.status.not_in(list(TERMINAL_STATUSES)),
                )
                .order_by(MfOrder.updated_at)
                .limit(batch_size)
            )
        ).scalars()
    )
    updated = 0
    for order in orders:
        if await sync_order_from_fp(session, order):
            updated += 1
    return {"processed": len(orders), "updated": updated}
