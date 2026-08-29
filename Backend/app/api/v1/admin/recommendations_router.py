from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.admin.recommendation_schemas import (
    AddRecommendationBasketFundRequest,
    CreateRecommendationBasketRequest,
    RecommendationAuditLogListResponse,
    RecommendationAuditLogResponse,
    RecommendationBasketDetailResponse,
    RecommendationBasketListResponse,
    RecommendationConfigResponse,
    RecommendationMetricsResponse,
    RecommendationPreviewResponse,
    RecommendationPublishReadinessResponse,
    ReplaceRecommendationBasketFundsRequest,
    UpdateRecommendationBasketRequest,
)
from app.api.v1.auth.deps import require_permission
from app.application.recommendations.basket_admin_service import (
    add_basket_fund,
    create_basket,
    delete_basket,
    get_basket,
    get_config,
    list_baskets,
    preview_selection,
    publish_config,
    remove_basket_fund,
    replace_basket_funds,
    update_basket,
)
from app.application.recommendations.errors import RecommendationError
from app.application.recommendations.publish_readiness import get_publish_readiness
from app.application.recommendations.recommendation_audit_service import list_recommendation_audit_logs
from app.application.recommendations.recommendation_metrics import get_recommendation_metrics
from app.core.database import get_db
from app.infrastructure.persistence.models import AuditEventType, User
from app.infrastructure.persistence.risk_profile_models import RiskTier

router = APIRouter(prefix="/recommendations", tags=["admin-recommendations"])


def _handle_recommendation_error(exc: RecommendationError) -> HTTPException:
    return HTTPException(
        status_code=exc.status_code,
        detail={"code": exc.code, "message": exc.message},
    )


@router.get("/config", response_model=RecommendationConfigResponse)
async def get_recommendation_config(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("recommendations.read"))],
) -> RecommendationConfigResponse:
    return RecommendationConfigResponse.model_validate(await get_config(db))


@router.get("/baskets", response_model=RecommendationBasketListResponse)
async def get_recommendation_baskets(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("recommendations.read"))],
    tier: str | None = Query(default=None),
) -> RecommendationBasketListResponse:
    parsed_tier = RiskTier(tier) if tier else None
    items = await list_baskets(db, tier=parsed_tier)
    return RecommendationBasketListResponse(items=items)


@router.get("/baskets/{basket_id}", response_model=RecommendationBasketDetailResponse)
async def get_recommendation_basket(
    basket_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("recommendations.read"))],
) -> RecommendationBasketDetailResponse:
    detail = await get_basket(db, basket_id)
    if not detail:
        raise HTTPException(status_code=404, detail={"code": "basket_not_found", "message": "Basket not found."})
    return RecommendationBasketDetailResponse.model_validate(detail)


@router.post("/baskets", response_model=RecommendationBasketDetailResponse)
async def post_recommendation_basket(
    body: CreateRecommendationBasketRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("recommendations.manage"))],
) -> RecommendationBasketDetailResponse:
    try:
        created = await create_basket(
            db,
            admin_user_id=admin.id,
            tier=RiskTier(body.tier),
            name=body.name,
            slug=body.slug,
            description=body.description,
            objective_summary=body.objective_summary,
            portfolio_display_name=body.portfolio_display_name or body.name,
            target_allocation=body.target_allocation,
            sort_order=body.sort_order,
        )
        await db.commit()
    except RecommendationError as exc:
        raise _handle_recommendation_error(exc) from exc
    detail = await get_basket(db, UUID(created["id"]))
    assert detail is not None
    return RecommendationBasketDetailResponse.model_validate(detail)


@router.patch("/baskets/{basket_id}", response_model=RecommendationBasketDetailResponse)
async def patch_recommendation_basket(
    basket_id: UUID,
    body: UpdateRecommendationBasketRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("recommendations.manage"))],
) -> RecommendationBasketDetailResponse:
    try:
        await update_basket(
            db,
            basket_id,
            admin_user_id=admin.id,
            name=body.name,
            description=body.description,
            objective_summary=body.objective_summary,
            portfolio_display_name=body.portfolio_display_name,
            target_allocation=body.target_allocation,
            is_active=body.is_active,
            sort_order=body.sort_order,
        )
        await db.commit()
    except RecommendationError as exc:
        raise _handle_recommendation_error(exc) from exc
    detail = await get_basket(db, basket_id)
    assert detail is not None
    return RecommendationBasketDetailResponse.model_validate(detail)


@router.delete("/baskets/{basket_id}")
async def delete_recommendation_basket(
    basket_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("recommendations.manage"))],
) -> dict[str, str]:
    try:
        await delete_basket(db, basket_id, admin_user_id=admin.id)
        await db.commit()
    except RecommendationError as exc:
        raise _handle_recommendation_error(exc) from exc
    return {"status": "ok"}


@router.put("/baskets/{basket_id}/funds", response_model=RecommendationBasketDetailResponse)
async def put_recommendation_basket_funds(
    basket_id: UUID,
    body: ReplaceRecommendationBasketFundsRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("recommendations.manage"))],
) -> RecommendationBasketDetailResponse:
    try:
        detail = await replace_basket_funds(
            db,
            basket_id,
            admin_user_id=admin.id,
            funds=body.funds,
        )
        await db.commit()
    except RecommendationError as exc:
        raise _handle_recommendation_error(exc) from exc
    return RecommendationBasketDetailResponse.model_validate(detail)


@router.post("/baskets/{basket_id}/funds", response_model=RecommendationBasketDetailResponse)
async def post_recommendation_basket_fund(
    basket_id: UUID,
    body: AddRecommendationBasketFundRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("recommendations.manage"))],
) -> RecommendationBasketDetailResponse:
    try:
        detail = await add_basket_fund(
            db,
            basket_id,
            admin_user_id=admin.id,
            product_id=UUID(body.product_id),
            sort_order=body.sort_order,
        )
        await db.commit()
    except RecommendationError as exc:
        raise _handle_recommendation_error(exc) from exc
    return RecommendationBasketDetailResponse.model_validate(detail)


@router.delete("/baskets/{basket_id}/funds/{product_id}", response_model=RecommendationBasketDetailResponse)
async def delete_recommendation_basket_fund(
    basket_id: UUID,
    product_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("recommendations.manage"))],
) -> RecommendationBasketDetailResponse:
    try:
        detail = await remove_basket_fund(
            db,
            basket_id,
            product_id,
            admin_user_id=admin.id,
        )
        await db.commit()
    except RecommendationError as exc:
        raise _handle_recommendation_error(exc) from exc
    return RecommendationBasketDetailResponse.model_validate(detail)


@router.get("/preview", response_model=RecommendationPreviewResponse)
async def get_recommendation_preview(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("recommendations.read"))],
    tier: str = Query(...),
    sample_user_id: UUID = Query(...),
) -> RecommendationPreviewResponse:
    payload = await preview_selection(
        db,
        tier=RiskTier(tier),
        sample_user_id=sample_user_id,
    )
    return RecommendationPreviewResponse.model_validate(payload)


@router.get("/publish-readiness", response_model=RecommendationPublishReadinessResponse)
async def get_recommendation_publish_readiness(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("recommendations.read"))],
) -> RecommendationPublishReadinessResponse:
    return RecommendationPublishReadinessResponse.model_validate(await get_publish_readiness(db))


@router.get("/metrics", response_model=RecommendationMetricsResponse)
async def get_recommendation_metrics_endpoint(
    _: Annotated[User, Depends(require_permission("recommendations.read"))],
) -> RecommendationMetricsResponse:
    return RecommendationMetricsResponse.model_validate(get_recommendation_metrics())


@router.get("/audit", response_model=RecommendationAuditLogListResponse)
async def get_recommendation_audit_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("recommendations.read"))],
    event_type: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> RecommendationAuditLogListResponse:
    parsed_event: AuditEventType | None = None
    if event_type:
        try:
            parsed_event = AuditEventType(event_type)
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail={"code": "invalid_event_type", "message": "Invalid audit event type."},
            ) from exc

    items = await list_recommendation_audit_logs(
        db,
        event_type=parsed_event,
        limit=limit,
        offset=offset,
    )
    return RecommendationAuditLogListResponse(
        items=[
            RecommendationAuditLogResponse(
                id=str(item["id"]),
                user_id=str(item["user_id"]) if item.get("user_id") else None,
                event_type=item["event_type"],
                ip_address=item.get("ip_address"),
                metadata=item.get("metadata") or {},
                created_at=item["created_at"].isoformat() if item.get("created_at") else "",
            )
            for item in items
        ]
    )


@router.post("/publish", response_model=RecommendationConfigResponse)
async def post_recommendation_publish(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("recommendations.publish"))],
) -> RecommendationConfigResponse:
    try:
        payload = await publish_config(db, admin_user_id=admin.id)
        await db.commit()
    except RecommendationError as exc:
        raise _handle_recommendation_error(exc) from exc
    return RecommendationConfigResponse.model_validate(payload)
