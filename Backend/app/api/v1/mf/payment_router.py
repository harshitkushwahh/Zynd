from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.deps import get_client_ip, get_current_user, require_invest_eligible_user
from app.api.v1.mf.schemas import MfCheckoutResponse, MfOrderResponse, MfPaymentStatusResponse
from app.application.mf.mf_payment_status_service import (
    abandon_checkout_payment_for_user,
    abandon_order_payment_for_user,
    confirm_checkout_payment_return_for_user,
    confirm_order_payment_return_for_user,
    get_checkout_payment_status,
    get_order_payment_status,
)
from app.core.database import get_db
from app.infrastructure.persistence.models import User

router = APIRouter()


@router.get("/cart/checkout/{checkout_id}/payment-status", response_model=MfPaymentStatusResponse)
async def get_mf_cart_checkout_payment_status(
    checkout_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfPaymentStatusResponse:
    try:
        payload = await get_checkout_payment_status(
            db,
            user_id=current_user.id,
            checkout_id=checkout_id,
            user_ip=get_client_ip(request),
        )
    except LookupError:
        raise HTTPException(status_code=404, detail="Checkout not found") from None
    await db.commit()
    return payload


@router.post("/cart/checkout/{checkout_id}/confirm-payment-return", response_model=MfCheckoutResponse)
async def confirm_mf_cart_checkout_payment_return(
    checkout_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfCheckoutResponse:
    try:
        payload = await confirm_checkout_payment_return_for_user(
            db,
            user_id=current_user.id,
            checkout_id=checkout_id,
            user_ip=get_client_ip(request),
        )
    except LookupError:
        raise HTTPException(status_code=404, detail="Checkout not found") from None
    await db.commit()
    return payload


@router.post("/cart/checkout/{checkout_id}/abandon-payment", response_model=MfCheckoutResponse)
async def abandon_mf_cart_checkout_payment(
    checkout_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfCheckoutResponse:
    try:
        payload = await abandon_checkout_payment_for_user(
            db,
            user_id=current_user.id,
            checkout_id=checkout_id,
        )
    except LookupError:
        raise HTTPException(status_code=404, detail="Checkout not found") from None
    except ValueError:
        raise HTTPException(status_code=409, detail="Payment cannot be abandoned in its current state") from None
    await db.commit()
    return payload


@router.get("/orders/{order_id}/payment-status", response_model=MfPaymentStatusResponse)
async def get_mf_order_payment_status(
    order_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfPaymentStatusResponse:
    try:
        payload = await get_order_payment_status(
            db,
            user_id=current_user.id,
            order_id=order_id,
            user_ip=get_client_ip(request),
        )
    except LookupError:
        raise HTTPException(status_code=404, detail="Order not found") from None
    await db.commit()
    return payload


@router.post("/orders/{order_id}/confirm-payment-return", response_model=MfOrderResponse)
async def confirm_mf_order_payment_return(
    order_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfOrderResponse:
    try:
        payload = await confirm_order_payment_return_for_user(
            db,
            user_id=current_user.id,
            order_id=order_id,
            user_ip=get_client_ip(request),
        )
    except LookupError:
        raise HTTPException(status_code=404, detail="Order not found") from None
    await db.commit()
    return payload


@router.post("/orders/{order_id}/abandon-payment", response_model=MfOrderResponse)
async def abandon_mf_order_payment(
    order_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfOrderResponse:
    try:
        payload = await abandon_order_payment_for_user(
            db,
            user_id=current_user.id,
            order_id=order_id,
        )
    except LookupError:
        raise HTTPException(status_code=404, detail="Order not found") from None
    except ValueError:
        raise HTTPException(status_code=409, detail="Payment cannot be abandoned in its current state") from None
    await db.commit()
    return payload
