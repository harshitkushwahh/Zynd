"""Unified MF transaction consent flows for HTTP routers (purchase, redemption, switch, SWP, STP)."""

from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.mf_order_errors import MfOrderError
from app.application.mf.mf_purchase_consent_service import (
    confirm_purchase_consent_and_advance,
    get_purchase_consent_context,
    send_purchase_consent_otp,
)
from app.application.mf.mf_redemption_service import (
    get_redemption_consent_context,
    send_redemption_consent_otp,
)
from app.application.mf.mf_switch_service import get_switch_consent_context, send_switch_consent_otp
MfConsentKind = Literal["lumpsum", "redemption", "switch"]


async def get_transaction_consent_context(
    db: AsyncSession,
    *,
    kind: MfConsentKind,
    user_id: UUID,
    order_id: UUID,
) -> dict[str, Any]:
    if kind == "lumpsum":
        return await get_purchase_consent_context(db, user_id=user_id, order_id=order_id)
    if kind == "redemption":
        return await get_redemption_consent_context(db, user_id=user_id, order_id=order_id)
    if kind == "switch":
        return await get_switch_consent_context(db, user_id=user_id, order_id=order_id)
    raise MfOrderError(code="invalid_consent_kind", message="Unknown consent kind", status_code=400)


async def send_transaction_consent_otp(
    db: AsyncSession,
    *,
    kind: MfConsentKind,
    user_id: UUID,
    order_id: UUID,
    ip: str | None,
) -> dict[str, Any]:
    if kind == "lumpsum":
        return await send_purchase_consent_otp(db, user_id=user_id, order_id=order_id, ip=ip)
    if kind == "redemption":
        return await send_redemption_consent_otp(db, user_id=user_id, order_id=order_id, ip=ip)
    if kind == "switch":
        return await send_switch_consent_otp(db, user_id=user_id, order_id=order_id, ip=ip)
    raise MfOrderError(code="invalid_consent_kind", message="Unknown consent kind", status_code=400)


async def confirm_lumpsum_consent(
    db: AsyncSession,
    *,
    user_id: UUID,
    order_id: UUID,
    otp: str,
    ip: str | None,
    user_agent: str | None,
):
    return await confirm_purchase_consent_and_advance(
        db,
        user_id=user_id,
        order_id=order_id,
        otp=otp,
        ip=ip,
        user_agent=user_agent,
    )
