"""Lumpsum purchase OTP — Zynd platform consent before ONDC payment advance."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.mf_consent_contact_mask import mask_mf_consent_email, mask_mf_consent_mobile
from app.application.mf.mf_order_errors import MfOrderError
from app.application.mf.mf_order_service import TERMINAL_STATUSES, get_user_order
from app.application.mf.mf_ondc_order_service import _load_consent_contact
from app.application.mf.mf_purchase_consent_gates import (
    lumpsum_has_platform_consent,
    lumpsum_order_needs_platform_consent,
    order_is_lumpsum_purchase,
)
from app.application.mf.mf_redemption_service import _extract_folio_consent_contacts
from app.application.mf.mf_transaction_consent_service import (
    merge_platform_consent_metadata,
    send_mf_transaction_consent_otp,
    verify_mf_transaction_consent_otp,
)
from app.infrastructure.mf.fp_oms_client import list_mf_folios
from app.infrastructure.persistence.mf_transaction_models import MfOrder
from app.infrastructure.persistence.models import User


def _order_meta(order: MfOrder) -> dict[str, Any]:
    return dict(order.metadata_ or {})


async def _load_purchase_order(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    order_id: uuid.UUID,
) -> MfOrder:
    order = await get_user_order(session, user_id=user_id, order_id=order_id)
    if not order or not order_is_lumpsum_purchase(order):
        raise MfOrderError(code="order_not_found", message="Order not found", status_code=404)
    if order.status in TERMINAL_STATUSES:
        raise MfOrderError(code="order_terminal", message="This order is already closed", status_code=409)
    return order


async def _resolve_purchase_consent_contacts(
    session: AsyncSession,
    order: MfOrder,
) -> tuple[str | None, str | None]:
    meta = _order_meta(order)
    folio_number = str(meta.get("folio_number") or "").strip()
    mfia_id = order.mf_investment_account_id
    if folio_number and mfia_id:
        from app.infrastructure.persistence.mf_transaction_models import MfInvestmentAccount

        mfia = await session.get(MfInvestmentAccount, mfia_id)
        fp_mfia_id = mfia.fp_mfia_id if mfia else None
        if fp_mfia_id:
            folio_payload = await list_mf_folios(fp_mfia_id=fp_mfia_id, folio_number=folio_number)
            email, mobile = _extract_folio_consent_contacts(folio_payload)
            if mobile:
                return email, mobile

    contact = await _load_consent_contact(session, user_id=order.user_id)
    if contact:
        return contact[0], contact[1]
    return None, None


async def snapshot_purchase_consent_for_order(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    order_id: uuid.UUID,
) -> dict[str, Any] | None:
    """Best-effort consent mask for POST /orders; never raises."""
    try:
        return await get_purchase_consent_context(session, user_id=user_id, order_id=order_id)
    except MfOrderError:
        order = await get_user_order(session, user_id=user_id, order_id=order_id)
        if not order or not order_is_lumpsum_purchase(order):
            return None
        email, mobile = await _resolve_purchase_consent_contacts(session, order)
        if not mobile:
            return None
        meta = _order_meta(order)
        return {
            "order_id": str(order.id),
            "status": order.status.value,
            "masked_email": mask_mf_consent_email(email) if email else "",
            "masked_mobile": mask_mf_consent_mobile(mobile),
            "consent_otp_sent": bool(meta.get("consent_otp_sent")),
            "platform_consent_accepted": bool(meta.get("platform_consent_record_id")),
        }


async def get_purchase_consent_context(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    order_id: uuid.UUID,
) -> dict[str, Any]:
    order = await _load_purchase_order(session, user_id=user_id, order_id=order_id)
    meta = _order_meta(order)
    email, mobile = await _resolve_purchase_consent_contacts(session, order)
    if not mobile:
        raise MfOrderError(
            code="consent_contact_missing",
            message="Registered mobile is unavailable for transaction OTP",
            status_code=409,
        )
    return {
        "order_id": str(order.id),
        "status": order.status.value,
        "masked_email": mask_mf_consent_email(email) if email else "",
        "masked_mobile": mask_mf_consent_mobile(mobile),
        "consent_otp_sent": bool(meta.get("consent_otp_sent")),
        "platform_consent_accepted": bool(meta.get("platform_consent_record_id")),
    }


async def send_purchase_consent_otp(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    order_id: uuid.UUID,
    ip: str | None = None,
) -> dict[str, Any]:
    order = await _load_purchase_order(session, user_id=user_id, order_id=order_id)
    email, mobile = await _resolve_purchase_consent_contacts(session, order)
    if not mobile:
        raise MfOrderError(
            code="consent_contact_missing",
            message="Registered mobile is unavailable for transaction OTP",
            status_code=409,
        )

    otp_payload = await send_mf_transaction_consent_otp(
        identifier=str(order.id),
        email=email,
        mobile=mobile,
        ip=ip,
    )
    meta = _order_meta(order)
    order.metadata_ = {
        **meta,
        "consent_otp_sent": True,
        "consent_email": email,
        "consent_mobile": mobile,
    }
    await session.flush()
    return {"order_id": str(order.id), **otp_payload}


async def confirm_purchase_consent_and_advance(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    order_id: uuid.UUID,
    otp: str,
    ip: str | None = None,
    user_agent: str | None = None,
) -> MfOrder:
    order = await _load_purchase_order(session, user_id=user_id, order_id=order_id)
    meta = _order_meta(order)
    if not meta.get("consent_otp_sent"):
        raise MfOrderError(code="consent_otp_required", message="Send OTP before confirming", status_code=409)

    user = await session.get(User, user_id)
    if not user:
        raise MfOrderError(code="order_not_found", message="Order not found", status_code=404)

    consent_record_id = await verify_mf_transaction_consent_otp(
        session,
        user=user,
        identifier=str(order.id),
        otp=otp,
        transaction_kind="lumpsum",
        subject_id=order.id,
        ip=ip,
        user_agent=user_agent,
        extra_metadata={"order_type": order.order_type.value, "amount_inr": float(order.amount_inr)},
    )
    order.metadata_ = merge_platform_consent_metadata(meta, consent_record_id=consent_record_id)
    await session.flush()

    from app.application.mf.mf_payment_flow_service import advance_order_for_payment

    await advance_order_for_payment(session, order, user_ip=ip)
    await session.refresh(order)
    return order
