from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.admin.schemas import (
    MfTransactionCheckoutListResponse,
    MfTransactionMandateListResponse,
    MfTransactionOrderDetailResponse,
    MfTransactionOrderListResponse,
    MfTransactionOverviewResponse,
    MfTransactionReplayResponse,
    MfTransactionReconcileResponse,
    MfTransactionSipBatchListResponse,
    MfTransactionSipPlanListResponse,
    MfTransactionWebhookListResponse,
    MfTransactionWebhookReplayResponse,
)
from app.api.v1.auth.deps import require_permission
from app.application.mf.mf_transaction_ops_service import (
    expire_stale_checkouts,
    get_checkout_admin,
    get_mandate_admin,
    get_order_admin,
    get_sip_plan_admin,
    get_transaction_overview,
    list_checkouts_admin,
    list_mandates_admin,
    list_orders_admin,
    list_sip_batches_admin,
    list_sip_plans_admin,
    list_webhook_events_admin,
    reconcile_mandate_admin,
    reconcile_order_admin,
    reconcile_sip_plan_admin,
    replay_webhook_admin,
)
from app.core.database import get_db
from app.infrastructure.persistence.models import User

router = APIRouter(prefix="/mf/transactions", tags=["admin-mf-transactions"])


@router.get("/overview", response_model=MfTransactionOverviewResponse)
async def mf_transactions_overview(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("mf.transactions.read")),
) -> MfTransactionOverviewResponse:
    return MfTransactionOverviewResponse(**await get_transaction_overview(db))


@router.get("/orders", response_model=MfTransactionOrderListResponse)
async def mf_transactions_orders(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("mf.transactions.read")),
    status: Optional[str] = Query(default=None),
    order_type: Optional[str] = Query(default=None),
    checkout_type: Optional[str] = Query(default=None),
    user_id: Optional[UUID] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> MfTransactionOrderListResponse:
    orders = await list_orders_admin(
        db,
        status=status,
        order_type=order_type,
        checkout_type=checkout_type,
        user_id=user_id,
        limit=limit,
    )
    return MfTransactionOrderListResponse(orders=orders)


@router.get("/checkouts", response_model=MfTransactionCheckoutListResponse)
async def mf_transactions_checkouts(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("mf.transactions.read")),
    checkout_type: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    user_id: Optional[UUID] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> MfTransactionCheckoutListResponse:
    checkouts = await list_checkouts_admin(
        db,
        checkout_type=checkout_type,
        status=status,
        user_id=user_id,
        limit=limit,
    )
    return MfTransactionCheckoutListResponse(checkouts=checkouts)


@router.get("/sip-batches", response_model=MfTransactionSipBatchListResponse)
async def mf_transactions_sip_batches(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("mf.transactions.read")),
    status: Optional[str] = Query(default=None),
    user_id: Optional[UUID] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> MfTransactionSipBatchListResponse:
    batches = await list_sip_batches_admin(db, status=status, user_id=user_id, limit=limit)
    return MfTransactionSipBatchListResponse(batches=batches)


@router.get("/sip-plans", response_model=MfTransactionSipPlanListResponse)
async def mf_transactions_sip_plans(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("mf.transactions.read")),
    status: Optional[str] = Query(default=None),
    user_id: Optional[UUID] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> MfTransactionSipPlanListResponse:
    plans = await list_sip_plans_admin(db, status=status, user_id=user_id, limit=limit)
    return MfTransactionSipPlanListResponse(plans=plans)


@router.get("/mandates", response_model=MfTransactionMandateListResponse)
async def mf_transactions_mandates(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("mf.transactions.read")),
    status: Optional[str] = Query(default=None),
    user_id: Optional[UUID] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> MfTransactionMandateListResponse:
    payload = await list_mandates_admin(db, status=status, user_id=user_id, limit=limit)
    return MfTransactionMandateListResponse(**payload)


@router.get("/orders/{order_id}", response_model=MfTransactionOrderDetailResponse)
async def mf_transactions_order_detail(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("mf.transactions.read")),
) -> MfTransactionOrderDetailResponse:
    payload = await get_order_admin(db, order_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Order not found")
    return MfTransactionOrderDetailResponse(**payload)


@router.get("/checkouts/{checkout_id}")
async def mf_transactions_checkout_detail(
    checkout_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("mf.transactions.read")),
) -> dict[str, Any]:
    payload = await get_checkout_admin(db, checkout_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Checkout not found")
    return payload


@router.get("/sip-plans/{plan_id}")
async def mf_transactions_sip_plan_detail(
    plan_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("mf.transactions.read")),
) -> dict[str, Any]:
    payload = await get_sip_plan_admin(db, plan_id)
    if not payload:
        raise HTTPException(status_code=404, detail="SIP plan not found")
    return payload


@router.get("/mandates/{mandate_id}")
async def mf_transactions_mandate_detail(
    mandate_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("mf.transactions.read")),
) -> dict[str, Any]:
    payload = await get_mandate_admin(db, mandate_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Mandate not found")
    return payload


@router.get("/webhooks", response_model=MfTransactionWebhookListResponse)
async def mf_transactions_webhooks(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("mf.transactions.read")),
    processing_status: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> MfTransactionWebhookListResponse:
    events = await list_webhook_events_admin(db, processing_status=processing_status, limit=limit)
    return MfTransactionWebhookListResponse(events=events)


@router.post("/orders/{order_id}/sync", response_model=MfTransactionReconcileResponse)
async def mf_transactions_sync_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("mf.transactions.manage")),
) -> MfTransactionReconcileResponse:
    try:
        payload = await reconcile_order_admin(db, order_id)
        await db.commit()
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return MfTransactionReconcileResponse(**payload)


@router.post("/sip-plans/{plan_id}/sync", response_model=MfTransactionReconcileResponse)
async def mf_transactions_sync_sip_plan(
    plan_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("mf.transactions.manage")),
) -> MfTransactionReconcileResponse:
    try:
        payload = await reconcile_sip_plan_admin(db, plan_id)
        await db.commit()
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return MfTransactionReconcileResponse(**payload)


@router.post("/mandates/{mandate_id}/sync", response_model=MfTransactionReconcileResponse)
async def mf_transactions_sync_mandate(
    mandate_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("mf.transactions.manage")),
) -> MfTransactionReconcileResponse:
    try:
        payload = await reconcile_mandate_admin(db, mandate_id)
        await db.commit()
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return MfTransactionReconcileResponse(**payload)


@router.post("/webhooks/{event_id}/replay", response_model=MfTransactionWebhookReplayResponse)
async def mf_transactions_replay_webhook(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("mf.transactions.manage")),
) -> MfTransactionWebhookReplayResponse:
    try:
        payload = await replay_webhook_admin(db, event_id)
        await db.commit()
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return MfTransactionWebhookReplayResponse(**payload)


@router.post("/expire-stale", response_model=MfTransactionReplayResponse)
async def mf_transactions_expire_stale(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("mf.transactions.manage")),
) -> MfTransactionReplayResponse:
    payload = await expire_stale_checkouts(db)
    await db.commit()
    return MfTransactionReplayResponse(**payload)
