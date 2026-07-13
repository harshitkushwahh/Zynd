from __future__ import annotations

from typing import Annotated, Optional
from uuid import UUID

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.deps import get_current_user, require_invest_eligible_user
from app.api.v1.invest.schemas import (
    CreateMfOrderRequest,
    InvestCategoryListResponse,
    InvestCategoryResponse,
    InvestConfigResponse,
    InvestFundDetailResponse,
    InvestFundListResponse,
    InvestFundNavHistoryResponse,
    InvestFundSearchResponse,
    InvestFundSummaryResponse,
    InvestHomeResponse,
    InvestReturnCalculatorResponse,
    MfCasImportListResponse,
    MfCasImportResponse,
    MfExternalHoldingResponse,
    MfHoldingsResponse,
    MfOrderListResponse,
    MfOrderResponse,
)
from app.application.mf.cas_import_service import (
    list_user_cas_imports,
    list_user_external_holdings,
    request_user_cas_import,
)
from app.application.mf.invest_cached_read_service import (
    cached_get_invest_config,
    cached_get_invest_fund_detail,
    cached_get_invest_home,
    cached_list_invest_categories,
    cached_list_invest_collections,
    cached_list_invest_funds,
    cached_search_invest_funds,
)
from app.application.mf.invest_home_service import list_invest_fund_navs
from app.application.mf.return_calculator_service import cached_compute_return_calculator
from app.application.mf.mf_order_errors import MfCasError, MfOrderError
from app.application.mf.mf_order_service import (
    create_lumpsum_order,
    get_user_order,
    list_user_orders,
    serialize_order,
)
from app.core.config import get_settings
from app.core.database import get_db
from app.infrastructure.persistence.mf_models import Product
from app.infrastructure.persistence.models import User

router = APIRouter(prefix="/invest", tags=["invest"])


def _handle_mf_order_error(exc: MfOrderError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": {"code": exc.code, "message": exc.message}})


def _handle_mf_cas_error(exc: MfCasError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": {"code": exc.code, "message": exc.message}})


@router.get("/home", response_model=InvestHomeResponse)
async def invest_home(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> InvestHomeResponse:
    payload = await cached_get_invest_home(db)
    return InvestHomeResponse(
        categories=[InvestCategoryResponse(**item) for item in payload["categories"]],
        collections=[InvestCategoryResponse(**item) for item in payload.get("collections", [])],
        popular_funds=[InvestFundSummaryResponse(**item) for item in payload.get("popular_funds", [])],
        featured_funds=[InvestFundSummaryResponse(**item) for item in payload["featured_funds"]],
        total_active_funds=payload["total_active_funds"],
    )


@router.get("/categories", response_model=InvestCategoryListResponse)
async def invest_categories(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> InvestCategoryListResponse:
    categories = await cached_list_invest_categories(db)
    return InvestCategoryListResponse(categories=[InvestCategoryResponse(**item) for item in categories])


@router.get("/collections", response_model=InvestCategoryListResponse)
async def invest_collections(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> InvestCategoryListResponse:
    collections = await cached_list_invest_collections(db)
    return InvestCategoryListResponse(categories=[InvestCategoryResponse(**item) for item in collections])


@router.get("/funds", response_model=InvestFundListResponse)
async def invest_funds(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    category: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    sort: str = Query(default="rank", pattern="^(rank|return_3y|name)$"),
) -> InvestFundListResponse:
    payload = await cached_list_invest_funds(
        db,
        category_slug=category,
        page=page,
        page_size=page_size,
        sort=sort,
    )
    return InvestFundListResponse(
        items=[InvestFundSummaryResponse(**item) for item in payload["items"]],
        page=payload["page"],
        page_size=payload["page_size"],
        total=payload["total"],
        has_more=payload["has_more"],
    )


@router.get("/config", response_model=InvestConfigResponse)
async def invest_config(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> InvestConfigResponse:
    return InvestConfigResponse(**await cached_get_invest_config(db))


@router.get("/search", response_model=InvestFundSearchResponse)
async def invest_search(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    q: str = Query(min_length=0, max_length=120),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
) -> InvestFundSearchResponse:
    payload = await cached_search_invest_funds(db, query=q, page=page, page_size=page_size)
    return InvestFundSearchResponse(
        query=payload["query"],
        items=[InvestFundSummaryResponse(**item) for item in payload["items"]],
        page=payload["page"],
        page_size=payload["page_size"],
        total=payload["total"],
        has_more=payload["has_more"],
    )


@router.get("/funds/{product_id}/navs", response_model=InvestFundNavHistoryResponse)
async def invest_fund_navs(
    product_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    limit: int = Query(default=365, ge=1, le=2000),
) -> InvestFundNavHistoryResponse:
    payload = await list_invest_fund_navs(db, product_id, limit=limit)
    if not payload:
        raise HTTPException(status_code=404, detail="Fund not found in catalog")
    return InvestFundNavHistoryResponse(**payload)


@router.get("/funds/{product_id}", response_model=InvestFundDetailResponse)
async def invest_fund_detail(
    product_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> InvestFundDetailResponse:
    payload = await cached_get_invest_fund_detail(db, product_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Fund not found in catalog")
    return InvestFundDetailResponse(**payload)


@router.get("/funds/{product_id}/return-calculator", response_model=InvestReturnCalculatorResponse)
async def invest_return_calculator(
    product_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    amount_inr: float = Query(default=1000, gt=0, le=10_000_000),
    mode: str = Query(default="lumpsum", pattern="^(lumpsum|sip)$"),
    horizons: Optional[str] = Query(default=None, description="Comma-separated: 3m,6m,1y,3y,5y"),
) -> InvestReturnCalculatorResponse:
    horizon_list = [part.strip() for part in (horizons or "").split(",") if part.strip()] or None
    payload = await cached_compute_return_calculator(
        db,
        product_id=product_id,
        amount_inr=amount_inr,
        mode=mode,
        horizons=horizon_list,
    )
    if not payload:
        raise HTTPException(status_code=404, detail="Fund not found in catalog")
    return InvestReturnCalculatorResponse(**payload)


@router.get("/assets/{asset_path:path}")
async def serve_public_asset(asset_path: str) -> FileResponse:
    settings = get_settings()
    if settings.document_storage_provider != "local":
        raise HTTPException(status_code=404, detail="Asset not available")
    if ".." in asset_path or asset_path.startswith("/"):
        raise HTTPException(status_code=400, detail="Invalid asset path")

    file_path = settings.resolved_documents_root / settings.public_assets_bucket / asset_path
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Asset not found")

    media_type = "application/octet-stream"
    if asset_path.endswith(".png"):
        media_type = "image/png"
    elif asset_path.endswith(".jpg") or asset_path.endswith(".jpeg"):
        media_type = "image/jpeg"
    elif asset_path.endswith(".svg"):
        media_type = "image/svg+xml"

    return FileResponse(file_path, media_type=media_type)


@router.post("/orders", response_model=MfOrderResponse)
async def create_mf_order(
    body: CreateMfOrderRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfOrderResponse:
    settings = get_settings()
    if not settings.zynd_mf_orders_enabled:
        raise HTTPException(status_code=503, detail="MF orders are temporarily unavailable")

    try:
        order = await create_lumpsum_order(
            db,
            user_id=current_user.id,
            product_id=body.product_id,
            amount_inr=Decimal(str(body.amount_inr)),
            idempotency_key=body.idempotency_key,
        )
        product = await db.get(Product, order.product_id)
        await db.commit()
    except MfOrderError as exc:
        await db.rollback()
        raise _handle_mf_order_error(exc) from exc

    return MfOrderResponse(**serialize_order(order, product_name=product.name if product else None))


@router.get("/orders", response_model=MfOrderListResponse)
async def list_mf_orders(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
    limit: int = Query(default=50, ge=1, le=100),
) -> MfOrderListResponse:
    orders = await list_user_orders(db, user_id=current_user.id, limit=limit)
    product_ids = {order.product_id for order in orders}
    products = {
        row.id: row.name
        for row in (
            await db.execute(select(Product).where(Product.id.in_(product_ids)))
        ).scalars()
    } if product_ids else {}
    return MfOrderListResponse(
        orders=[
            MfOrderResponse(**serialize_order(order, product_name=products.get(order.product_id)))
            for order in orders
        ]
    )


@router.get("/orders/{order_id}", response_model=MfOrderResponse)
async def get_mf_order(
    order_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfOrderResponse:
    order = await get_user_order(db, user_id=current_user.id, order_id=order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    product = await db.get(Product, order.product_id)
    return MfOrderResponse(**serialize_order(order, product_name=product.name if product else None))


@router.get("/holdings/external", response_model=MfHoldingsResponse)
async def list_external_holdings(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfHoldingsResponse:
    holdings = await list_user_external_holdings(db, user_id=current_user.id)
    return MfHoldingsResponse(
        external_holdings=[MfExternalHoldingResponse(**item) for item in holdings]
    )


@router.post("/cas/imports", response_model=MfCasImportResponse)
async def request_cas_import(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfCasImportResponse:
    settings = get_settings()
    if not settings.zynd_mf_cas_enabled:
        raise HTTPException(status_code=503, detail="External holdings import is not enabled")

    try:
        import_row = await request_user_cas_import(db, user=current_user)
        await db.commit()
    except MfCasError as exc:
        await db.rollback()
        raise _handle_mf_cas_error(exc) from exc

    return MfCasImportResponse(
        import_id=str(import_row.id),
        status=import_row.status.value,
        external_request_id=import_row.external_request_id,
        holdings_count=import_row.holdings_count,
        failure_reason=import_row.failure_reason,
        requested_at=import_row.requested_at,
        completed_at=import_row.completed_at,
    )


@router.get("/cas/imports", response_model=MfCasImportListResponse)
async def list_cas_imports(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfCasImportListResponse:
    imports = await list_user_cas_imports(db, user_id=current_user.id)
    return MfCasImportListResponse(
        imports=[
            MfCasImportResponse(
                import_id=str(row.id),
                status=row.status.value,
                external_request_id=row.external_request_id,
                holdings_count=row.holdings_count,
                failure_reason=row.failure_reason,
                requested_at=row.requested_at,
                completed_at=row.completed_at,
            )
            for row in imports
        ]
    )
