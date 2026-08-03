from __future__ import annotations

from typing import Annotated, Literal, Optional
from uuid import UUID

from decimal import Decimal

from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.deps import get_client_ip, get_current_user, require_invest_eligible_user
from app.api.v1.invest.schemas import (
    CheckoutMfCartRequest,
    BulkUpsertMfCartItemsRequest,
    CreateMfMandateRequest,
    CreateMfOrderRequest,
    CreateMfSipPlanRequest,
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
    InvestorBankAccountListResponse,
    InvestorBankAccountManualVerifyResponse,
    InvestorBankAccountPreverifyStatusResponse,
    InvestorBankAccountProofUploadResponse,
    InvestorBankAccountFailure,
    InvestorBankAccountResponse,
    InvestorBankAccountVerifyRequest,
    InvestorBankAccountVerifyResponse,
    InvestRiskProfileCurrentResponse,
    InvestRiskProfileAssessmentResponse,
    InvestRiskProfileAssessmentAnswersResponse,
    InvestRiskProfileAssessmentAnswerResponse,
    InvestRiskProfileAssessmentHistoryItemResponse,
    InvestRiskProfileAssessmentHistoryResponse,
    InvestRiskProfileReportResponse,
    InvestRiskProfileAttemptStateResponse,
    InvestRiskProfileDraftResponse,
    InvestRiskProfileDraftUpsertRequest,
    InvestRiskProfileQuestionResponse,
    InvestRiskProfileTemplateSummaryResponse,
    InvestRiskProfileResultResponse,
    InvestRiskProfileSessionResponse,
    InvestRiskProfileSubmitRequest,
    InvestRiskProfileTierResponse,
    InvestRiskProfileTierListResponse,
    InvestRiskProfileConfigResponse,
    MfCompareRequest,
    MfCompareResponse,
    MfLumpsumCalculatorResponse,
    MfSipCalculatorResponse,
    MfSwpCalculatorResponse,
    MfCartResponse,
    MfCasImportListResponse,
    MfCasImportResponse,
    MfCheckoutResponse,
    MfExternalHoldingResponse,
    MfHoldingsResponse,
    MfMandateListResponse,
    MfMandateResponse,
    MfOrderListResponse,
    MfOrderJourneyResponse,
    MfOrderResponse,
    MfSipCartCheckoutResponse,
    MfSipPlanListResponse,
    MfSipPlanResponse,
    UpsertMfCartItemRequest,
)
from app.application.investor.investor_bank_account_errors import InvestorBankAccountError
from app.application.investor.investor_bank_account_service import (
    disable_bank_account,
    get_bank_account_preverify_status,
    list_user_bank_accounts,
    set_primary_bank_account,
    upload_bank_account_proof,
    verify_and_add_bank_account,
    verify_bank_account_manual,
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
from app.application.mf.invest_fund_slug import resolve_invest_fund_product_id
from app.application.mf.invest_home_service import list_invest_fund_navs
from app.application.mf.mf_calculator_errors import MfCalculatorError
from app.application.mf.mf_compare_service import compare_invest_funds
from app.application.mf.return_calculator_service import (
    cached_compute_lumpsum_calculator,
    cached_compute_return_calculator,
    cached_compute_sip_calculator,
    cached_compute_swp_calculator,
)
from app.application.risk_profile.config_service import serialize_risk_profile_config
from app.application.risk_profile.draft_service import delete_draft, get_draft, upsert_draft
from app.application.risk_profile.errors import RiskProfileError
from app.application.risk_profile.report_service import get_or_create_report_pdf, get_report_metadata
from app.application.risk_profile.scoring_service import (
    get_assessment_answers,
    get_user_risk_profile,
    list_user_assessments,
    submit_assessment,
)
from app.application.risk_profile.attempt_service import ensure_can_take_assessment, get_attempt_state
from app.application.risk_profile.template_service import auto_select_template, resolve_template_questions
from app.application.risk_profile.tier_service import list_tiers
from app.application.mf.mf_order_errors import MfCasError, MfOrderError
from app.application.mf.mf_cart_service import (
    bulk_upsert_cart_items,
    checkout_cart,
    checkout_sip_cart,
    clear_lumpsum_cart,
    clear_sip_cart,
    get_cart_summary,
    get_user_checkout,
    remove_cart_item,
    serialize_checkout,
    upsert_cart_item,
)
from app.application.mf.mf_mandate_service import (
    cancel_user_mandate,
    create_mandate_for_user,
    get_user_mandate,
    initiate_mandate_auth,
    list_user_mandates,
    serialize_mandate,
)
from app.application.mf.mf_sip_plan_service import (
    cancel_sip_plan,
    create_sip_plan,
    get_user_sip_plan,
    list_user_sip_plans,
    load_sip_plan_fund_metadata,
    serialize_sip_plan,
)
from app.application.mf.mf_order_service import (
    create_lumpsum_order,
    get_user_order,
    get_user_order_journey,
    list_user_orders,
    load_order_fund_metadata,
    serialize_order,
)
from app.application.mf.mf_payment_flow_service import (
    abandon_unpaid_checkout_payment,
    abandon_unpaid_order_payment,
    advance_checkout_for_payment,
    advance_order_for_payment,
)
from app.core.config import get_settings
from app.core.database import get_db
from app.infrastructure.persistence.mf_models import Product
from app.infrastructure.persistence.mf_transaction_models import MfCheckout, MfMandate
from app.infrastructure.persistence.models import User

router = APIRouter(prefix="/invest", tags=["invest"])


async def _resolve_fund_product_id(db: AsyncSession, fund_ref: str) -> UUID:
    product_id = await resolve_invest_fund_product_id(db, fund_ref)
    if not product_id:
        raise HTTPException(status_code=404, detail="Fund not found in catalog")
    return product_id


def _handle_mf_order_error(exc: MfOrderError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": {"code": exc.code, "message": exc.message}})


def _handle_mf_cas_error(exc: MfCasError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": {"code": exc.code, "message": exc.message}})


def _handle_mf_calculator_error(exc: MfCalculatorError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": {"code": exc.code, "message": exc.message}})


def _handle_investor_bank_account_error(exc: InvestorBankAccountError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": {"code": exc.code, "message": exc.message}})


def _bank_account_response(payload: dict) -> InvestorBankAccountResponse:
    failure = payload.get("failure")
    failure_model = None
    if isinstance(failure, dict) and failure.get("field"):
        failure_model = InvestorBankAccountFailure(**failure)
    return InvestorBankAccountResponse(
        id=payload["id"],
        account_number_masked=payload["account_number_masked"],
        account_number_last4=payload["account_number_last4"],
        ifsc_code=payload["ifsc_code"],
        account_type=payload["account_type"],
        account_holder_name=payload["account_holder_name"],
        pan_account_holder_name=payload.get("pan_account_holder_name"),
        bank_name=payload.get("bank_name"),
        branch_name=payload.get("branch_name"),
        is_primary=payload["is_primary"],
        source=payload["source"],
        verification_status=payload["verification_status"],
        sync_status=payload["sync_status"],
        requires_manual_verification=bool(payload.get("requires_manual_verification")),
        requires_proof_upload=bool(payload.get("requires_proof_upload")),
        proof_uploaded=bool(payload.get("proof_uploaded")),
        preverify_id=payload.get("preverify_id"),
        failure=failure_model,
        readiness_verified=bool(payload.get("readiness_verified")),
        external_bank_account_id=payload.get("external_bank_account_id"),
        created_at=payload.get("created_at"),
        updated_at=payload.get("updated_at"),
    )


async def _order_response(
    db: AsyncSession,
    order,
    *,
    product_name: str | None,
    amc_name: str | None = None,
    amc_logo_url: str | None = None,
) -> MfOrderResponse:
    if amc_name is None and amc_logo_url is None:
        amc_names, amc_logos = await load_order_fund_metadata(db, [order])
        amc_name = amc_names.get(order.fund_id)
        amc_logo_url = amc_logos.get(order.fund_id)
    checkout = await db.get(MfCheckout, order.checkout_id) if order.checkout_id else None
    return MfOrderResponse(
        **serialize_order(
            order,
            product_name=product_name,
            checkout=checkout,
            amc_name=amc_name,
            amc_logo_url=amc_logo_url,
        )
    )


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


@router.post("/funds/compare", response_model=MfCompareResponse)
async def invest_compare_funds(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    body: MfCompareRequest = Body(...),
) -> MfCompareResponse:
    try:
        payload = await compare_invest_funds(db, product_ids=body.product_ids)
    except MfCalculatorError as exc:
        return _handle_mf_calculator_error(exc)  # type: ignore[return-value]
    return MfCompareResponse(
        funds=[InvestFundDetailResponse(**item) for item in payload["funds"]],
        disclaimer=payload["disclaimer"],
    )


@router.get("/funds/{fund_ref}/navs", response_model=InvestFundNavHistoryResponse)
async def invest_fund_navs(
    fund_ref: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    limit: int = Query(default=365, ge=1, le=2000),
) -> InvestFundNavHistoryResponse:
    product_id = await _resolve_fund_product_id(db, fund_ref)
    payload = await list_invest_fund_navs(db, product_id, limit=limit)
    if not payload:
        raise HTTPException(status_code=404, detail="Fund not found in catalog")
    return InvestFundNavHistoryResponse(**payload)


@router.get("/funds/{fund_ref}", response_model=InvestFundDetailResponse)
async def invest_fund_detail(
    fund_ref: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> InvestFundDetailResponse:
    product_id = await _resolve_fund_product_id(db, fund_ref)
    payload = await cached_get_invest_fund_detail(db, product_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Fund not found in catalog")
    return InvestFundDetailResponse(**payload)


@router.get("/funds/{fund_ref}/return-calculator", response_model=InvestReturnCalculatorResponse)
async def invest_return_calculator(
    fund_ref: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    amount_inr: float = Query(default=1000, gt=0, le=100_000_000),
    mode: str = Query(default="lumpsum", pattern="^(lumpsum|sip)$"),
    horizons: Optional[str] = Query(default=None, description="Comma-separated: 3m,6m,1y,3y,5y"),
    duration_months: int = Query(default=12, ge=1, le=999),
    sip_day: int = Query(default=5, ge=1, le=28),
) -> InvestReturnCalculatorResponse:
    product_id = await _resolve_fund_product_id(db, fund_ref)
    horizon_list = [part.strip() for part in (horizons or "").split(",") if part.strip()] or None
    try:
        payload = await cached_compute_return_calculator(
            db,
            product_id=product_id,
            amount_inr=amount_inr,
            mode=mode,
            horizons=horizon_list,
            duration_months=duration_months,
            sip_day=sip_day,
        )
    except MfCalculatorError as exc:
        return _handle_mf_calculator_error(exc)  # type: ignore[return-value]
    if not payload:
        raise HTTPException(status_code=404, detail="Fund not found in catalog")
    return InvestReturnCalculatorResponse(**payload)


@router.get("/funds/{fund_ref}/calculators/lumpsum", response_model=MfLumpsumCalculatorResponse)
async def invest_lumpsum_calculator(
    fund_ref: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    amount_inr: float = Query(default=1000, gt=0, le=100_000_000),
    horizons: Optional[str] = Query(default=None, description="Comma-separated: 3m,6m,1y,3y,5y"),
) -> MfLumpsumCalculatorResponse:
    product_id = await _resolve_fund_product_id(db, fund_ref)
    horizon_list = [part.strip() for part in (horizons or "").split(",") if part.strip()] or None
    try:
        payload = await cached_compute_lumpsum_calculator(
            db,
            product_id=product_id,
            amount_inr=amount_inr,
            horizons=horizon_list,
        )
    except MfCalculatorError as exc:
        return _handle_mf_calculator_error(exc)  # type: ignore[return-value]
    if not payload:
        raise HTTPException(status_code=404, detail="Fund not found in catalog")
    return MfLumpsumCalculatorResponse(**payload)


@router.get("/funds/{fund_ref}/calculators/sip", response_model=MfSipCalculatorResponse)
async def invest_sip_calculator(
    fund_ref: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    monthly_amount_inr: float = Query(default=5000, gt=0, le=100_000),
    duration_months: int = Query(default=60, ge=1, le=999),
    sip_day: int = Query(default=5, ge=1, le=28),
) -> MfSipCalculatorResponse:
    product_id = await _resolve_fund_product_id(db, fund_ref)
    try:
        payload = await cached_compute_sip_calculator(
            db,
            product_id=product_id,
            monthly_amount_inr=monthly_amount_inr,
            duration_months=duration_months,
            sip_day=sip_day,
        )
    except MfCalculatorError as exc:
        return _handle_mf_calculator_error(exc)  # type: ignore[return-value]
    if not payload:
        raise HTTPException(status_code=404, detail="Fund not found in catalog")
    return MfSipCalculatorResponse(**payload)


@router.get("/funds/{fund_ref}/calculators/swp", response_model=MfSwpCalculatorResponse)
async def invest_swp_calculator(
    fund_ref: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    corpus_inr: float = Query(default=1_000_000, gt=0, le=10_000_000),
    monthly_withdrawal_inr: float = Query(default=10_000, gt=0, le=10_000_000),
    duration_months: int = Query(default=60, ge=1, le=999),
    withdrawal_day: int = Query(default=5, ge=1, le=28),
) -> MfSwpCalculatorResponse:
    product_id = await _resolve_fund_product_id(db, fund_ref)
    try:
        payload = await cached_compute_swp_calculator(
            db,
            product_id=product_id,
            corpus_inr=corpus_inr,
            monthly_withdrawal_inr=monthly_withdrawal_inr,
            duration_months=duration_months,
            withdrawal_day=withdrawal_day,
        )
    except MfCalculatorError as exc:
        return _handle_mf_calculator_error(exc)  # type: ignore[return-value]
    if not payload:
        raise HTTPException(status_code=404, detail="Fund not found in catalog")
    return MfSwpCalculatorResponse(**payload)


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
    request: Request,
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
            user_ip=get_client_ip(request),
            bank_account_id=body.bank_account_id,
            family_goal_id=body.family_goal_id,
        )
        product = await db.get(Product, order.product_id)
        await db.commit()
    except MfOrderError as exc:
        await db.rollback()
        raise _handle_mf_order_error(exc) from exc

    return await _order_response(db, order, product_name=product.name if product else None)


@router.get("/cart", response_model=MfCartResponse)
async def get_mf_cart(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfCartResponse:
    payload = await get_cart_summary(db, user_id=current_user.id)
    return MfCartResponse(**payload)


@router.post("/cart/items", response_model=MfCartResponse)
async def upsert_mf_cart_item(
    body: UpsertMfCartItemRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfCartResponse:
    settings = get_settings()
    if not settings.zynd_mf_orders_enabled:
        raise HTTPException(status_code=503, detail="MF orders are temporarily unavailable")

    try:
        if body.investment_type == "sip" and not settings.zynd_mf_sip_enabled:
            raise HTTPException(status_code=503, detail="SIP is temporarily unavailable")
        await upsert_cart_item(
            db,
            user_id=current_user.id,
            product_id=body.product_id,
            amount_inr=Decimal(str(body.amount_inr)),
            investment_type=body.investment_type,
            installment_day=body.installment_day,
            frequency=body.frequency,
        )
        payload = await get_cart_summary(db, user_id=current_user.id)
        await db.commit()
    except MfOrderError as exc:
        await db.rollback()
        raise _handle_mf_order_error(exc) from exc

    return MfCartResponse(**payload)


@router.post("/cart/items/bulk", response_model=MfCartResponse)
async def bulk_upsert_mf_cart_items(
    body: BulkUpsertMfCartItemsRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfCartResponse:
    settings = get_settings()
    if not settings.zynd_mf_orders_enabled:
        raise HTTPException(status_code=503, detail="MF orders are temporarily unavailable")

    try:
        await bulk_upsert_cart_items(
            db,
            user_id=current_user.id,
            items=[(line.product_id, Decimal(str(line.amount_inr))) for line in body.items],
        )
        payload = await get_cart_summary(db, user_id=current_user.id)
        await db.commit()
    except MfOrderError as exc:
        await db.rollback()
        raise _handle_mf_order_error(exc) from exc

    return MfCartResponse(**payload)


@router.delete("/cart/items/{product_id}", response_model=MfCartResponse)
async def delete_mf_cart_item(
    product_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
    investment_type: Literal["lumpsum", "sip"] = Query(default="lumpsum"),
) -> MfCartResponse:
    try:
        await remove_cart_item(
            db,
            user_id=current_user.id,
            product_id=product_id,
            investment_type=investment_type,
        )
        payload = await get_cart_summary(db, user_id=current_user.id)
        await db.commit()
    except MfOrderError as exc:
        await db.rollback()
        raise _handle_mf_order_error(exc) from exc

    return MfCartResponse(**payload)


@router.delete("/cart/clear", response_model=MfCartResponse)
async def clear_mf_cart_tab(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
    investment_type: Literal["lumpsum", "sip"] = Query(...),
) -> MfCartResponse:
    try:
        if investment_type == "lumpsum":
            await clear_lumpsum_cart(db, user_id=current_user.id)
        else:
            await clear_sip_cart(db, user_id=current_user.id)
        payload = await get_cart_summary(db, user_id=current_user.id)
        await db.commit()
    except MfOrderError as exc:
        await db.rollback()
        raise _handle_mf_order_error(exc) from exc

    return MfCartResponse(**payload)


@router.post("/cart/checkout", response_model=MfCheckoutResponse)
async def checkout_mf_cart(
    body: CheckoutMfCartRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfCheckoutResponse:
    settings = get_settings()
    if not settings.zynd_mf_orders_enabled:
        raise HTTPException(status_code=503, detail="MF orders are temporarily unavailable")

    try:
        checkout, orders = await checkout_cart(
            db,
            user_id=current_user.id,
            idempotency_key=body.idempotency_key,
            user_ip=get_client_ip(request),
            bank_account_id=body.bank_account_id,
            family_goal_id=body.family_goal_id,
        )
        product_ids = {order.product_id for order in orders}
        products = {
            row.id: row.name
            for row in (
                await db.execute(select(Product).where(Product.id.in_(product_ids)))
            ).scalars()
        } if product_ids else {}
        await db.commit()
    except MfOrderError as exc:
        await db.rollback()
        raise _handle_mf_order_error(exc) from exc

    return MfCheckoutResponse(**serialize_checkout(checkout, orders, product_names=products))


@router.post("/cart/sip/checkout", response_model=MfSipCartCheckoutResponse)
async def checkout_mf_sip_cart(
    body: CheckoutMfCartRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfSipCartCheckoutResponse:
    settings = get_settings()
    if not settings.zynd_mf_orders_enabled or not settings.zynd_mf_sip_enabled:
        raise HTTPException(status_code=503, detail="SIP is temporarily unavailable")

    try:
        plans = await checkout_sip_cart(
            db,
            user_id=current_user.id,
            idempotency_key=body.idempotency_key,
            user_ip=get_client_ip(request),
            bank_account_id=body.bank_account_id,
            family_goal_id=body.family_goal_id,
        )
        product_ids = {plan.product_id for plan in plans}
        products = {
            row.id: row.name
            for row in (
                await db.execute(select(Product).where(Product.id.in_(product_ids)))
            ).scalars()
        } if product_ids else {}
        await db.commit()
    except MfOrderError as exc:
        await db.rollback()
        raise _handle_mf_order_error(exc) from exc

    amc_names, amc_logos, isins = await load_sip_plan_fund_metadata(db, plans)
    responses: list[MfSipPlanResponse] = []
    for plan in plans:
        mandate_row = await db.get(MfMandate, plan.mf_mandate_id) if plan.mf_mandate_id else None
        responses.append(
            MfSipPlanResponse(
                **serialize_sip_plan(
                    plan,
                    product_name=products.get(plan.product_id),
                    mandate=mandate_row,
                    amc_name=amc_names.get(plan.fund_id),
                    amc_logo_url=amc_logos.get(plan.fund_id),
                    isin=isins.get(plan.fund_id),
                )
            )
        )
    return MfSipCartCheckoutResponse(plans=responses)


@router.get("/cart/checkout/{checkout_id}", response_model=MfCheckoutResponse)
async def get_mf_cart_checkout(
    checkout_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfCheckoutResponse:
    result = await get_user_checkout(db, user_id=current_user.id, checkout_id=checkout_id)
    if not result:
        raise HTTPException(status_code=404, detail="Checkout not found")
    checkout, orders = result
    if await advance_checkout_for_payment(db, checkout, user_ip=get_client_ip(request)):
        await db.commit()
    product_ids = {order.product_id for order in orders}
    products = {
        row.id: row.name
        for row in (
            await db.execute(select(Product).where(Product.id.in_(product_ids)))
        ).scalars()
    } if product_ids else {}
    return MfCheckoutResponse(**serialize_checkout(checkout, orders, product_names=products))


@router.post("/cart/checkout/{checkout_id}/abandon-payment", response_model=MfCheckoutResponse)
async def abandon_mf_cart_checkout_payment(
    checkout_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfCheckoutResponse:
    result = await get_user_checkout(db, user_id=current_user.id, checkout_id=checkout_id)
    if not result:
        raise HTTPException(status_code=404, detail="Checkout not found")
    checkout, orders = result
    if not await abandon_unpaid_checkout_payment(db, checkout_id):
        raise HTTPException(status_code=409, detail="Payment cannot be abandoned in its current state")
    await db.commit()
    product_ids = {order.product_id for order in orders}
    products = {
        row.id: row.name
        for row in (
            await db.execute(select(Product).where(Product.id.in_(product_ids)))
        ).scalars()
    } if product_ids else {}
    return MfCheckoutResponse(**serialize_checkout(checkout, orders, product_names=products))


async def _sip_plan_response(
    db: AsyncSession,
    plan,
    *,
    product_name: str | None,
    amc_name: str | None = None,
    amc_logo_url: str | None = None,
    isin: str | None = None,
) -> MfSipPlanResponse:
    from app.application.mf.mf_mandate_service import refresh_mandate_status_from_fp
    from app.infrastructure.persistence.mf_transaction_models import MfMandate

    mandate_row = await db.get(MfMandate, plan.mf_mandate_id) if plan.mf_mandate_id else None
    if mandate_row is not None:
        await refresh_mandate_status_from_fp(db, mandate_row, force=True)
    if amc_name is None and amc_logo_url is None and isin is None:
        amc_names, amc_logos, isins = await load_sip_plan_fund_metadata(db, [plan])
        amc_name = amc_names.get(plan.fund_id)
        amc_logo_url = amc_logos.get(plan.fund_id)
        isin = isins.get(plan.fund_id)
    return MfSipPlanResponse(
        **serialize_sip_plan(
            plan,
            product_name=product_name,
            mandate=mandate_row,
            amc_name=amc_name,
            amc_logo_url=amc_logo_url,
            isin=isin,
        )
    )


@router.get("/mandates", response_model=MfMandateListResponse)
async def list_mf_mandates(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfMandateListResponse:
    mandates = await list_user_mandates(db, user_id=current_user.id)
    return MfMandateListResponse(mandates=[MfMandateResponse(**serialize_mandate(row)) for row in mandates])


@router.post("/mandates", response_model=MfMandateResponse)
async def create_mf_mandate(
    body: CreateMfMandateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfMandateResponse:
    settings = get_settings()
    if not settings.zynd_mf_orders_enabled or not settings.zynd_mf_sip_enabled:
        raise HTTPException(status_code=503, detail="SIP is temporarily unavailable")

    try:
        amount = Decimal(str(body.installment_amount_inr)) if body.installment_amount_inr else None
        mandate = await create_mandate_for_user(
            db,
            user_id=current_user.id,
            idempotency_key=body.idempotency_key,
            installment_amount_inr=amount,
            bank_account_id=body.bank_account_id,
        )
        await db.commit()
    except MfOrderError as exc:
        await db.rollback()
        raise _handle_mf_order_error(exc) from exc

    return MfMandateResponse(**serialize_mandate(mandate))


@router.get("/mandates/{mandate_id}", response_model=MfMandateResponse)
async def get_mf_mandate(
    mandate_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfMandateResponse:
    mandate = await get_user_mandate(db, user_id=current_user.id, mandate_id=mandate_id)
    if not mandate:
        raise HTTPException(status_code=404, detail="Mandate not found")
    return MfMandateResponse(**serialize_mandate(mandate))


@router.post("/mandates/{mandate_id}/auth", response_model=MfMandateResponse)
async def auth_mf_mandate(
    mandate_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfMandateResponse:
    mandate = await get_user_mandate(db, user_id=current_user.id, mandate_id=mandate_id)
    if not mandate:
        raise HTTPException(status_code=404, detail="Mandate not found")
    try:
        mandate = await initiate_mandate_auth(db, mandate)
        await db.commit()
    except MfOrderError as exc:
        await db.rollback()
        raise _handle_mf_order_error(exc) from exc
    return MfMandateResponse(**serialize_mandate(mandate))


@router.post("/mandates/{mandate_id}/cancel", response_model=MfMandateResponse)
async def cancel_mf_mandate(
    mandate_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfMandateResponse:
    mandate = await get_user_mandate(db, user_id=current_user.id, mandate_id=mandate_id)
    if not mandate:
        raise HTTPException(status_code=404, detail="Mandate not found")
    try:
        mandate = await cancel_user_mandate(db, mandate)
        await db.commit()
    except MfOrderError as exc:
        await db.rollback()
        raise _handle_mf_order_error(exc) from exc
    return MfMandateResponse(**serialize_mandate(mandate))


@router.post("/sip/plans", response_model=MfSipPlanResponse)
async def create_mf_sip_plan(
    body: CreateMfSipPlanRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfSipPlanResponse:
    settings = get_settings()
    if not settings.zynd_mf_orders_enabled or not settings.zynd_mf_sip_enabled:
        raise HTTPException(status_code=503, detail="SIP is temporarily unavailable")

    try:
        plan = await create_sip_plan(
            db,
            user_id=current_user.id,
            product_id=body.product_id,
            amount_inr=Decimal(str(body.amount_inr)),
            frequency=body.frequency,
            installment_day=body.installment_day,
            number_of_installments=body.number_of_installments,
            mandate_id=body.mandate_id,
            idempotency_key=body.idempotency_key,
            user_ip=get_client_ip(request),
            bank_account_id=body.bank_account_id,
            family_goal_id=body.family_goal_id,
        )
        product = await db.get(Product, plan.product_id)
        await db.commit()
    except MfOrderError as exc:
        await db.rollback()
        raise _handle_mf_order_error(exc) from exc

    return await _sip_plan_response(db, plan, product_name=product.name if product else None)


@router.get("/sip/plans", response_model=MfSipPlanListResponse)
async def list_mf_sip_plans(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(default=50, ge=1, le=100),
) -> MfSipPlanListResponse:
    plans = await list_user_sip_plans(db, user_id=current_user.id, limit=limit)
    product_ids = {plan.product_id for plan in plans}
    products = {
        row.id: row.name
        for row in (
            await db.execute(select(Product).where(Product.id.in_(product_ids)))
        ).scalars()
    } if product_ids else {}
    amc_names, amc_logos, isins = await load_sip_plan_fund_metadata(db, plans)
    responses = [
        await _sip_plan_response(
            db,
            plan,
            product_name=products.get(plan.product_id),
            amc_name=amc_names.get(plan.fund_id),
            amc_logo_url=amc_logos.get(plan.fund_id),
            isin=isins.get(plan.fund_id),
        )
        for plan in plans
    ]
    return MfSipPlanListResponse(plans=responses)


@router.get("/sip/plans/{plan_id}", response_model=MfSipPlanResponse)
async def get_mf_sip_plan(
    plan_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfSipPlanResponse:
    plan = await get_user_sip_plan(db, user_id=current_user.id, plan_id=plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="SIP plan not found")
    product = await db.get(Product, plan.product_id)
    return await _sip_plan_response(db, plan, product_name=product.name if product else None)


@router.post("/sip/plans/{plan_id}/cancel", response_model=MfSipPlanResponse)
async def cancel_mf_sip_plan(
    plan_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfSipPlanResponse:
    plan = await get_user_sip_plan(db, user_id=current_user.id, plan_id=plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="SIP plan not found")
    try:
        plan = await cancel_sip_plan(db, plan)
        product = await db.get(Product, plan.product_id)
        await db.commit()
    except MfOrderError as exc:
        await db.rollback()
        raise _handle_mf_order_error(exc) from exc
    return await _sip_plan_response(db, plan, product_name=product.name if product else None)


@router.get("/orders", response_model=MfOrderListResponse)
async def list_mf_orders(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
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
    amc_names, amc_logos = await load_order_fund_metadata(db, orders)
    responses: list[MfOrderResponse] = []
    for order in orders:
        responses.append(
            await _order_response(
                db,
                order,
                product_name=products.get(order.product_id),
                amc_name=amc_names.get(order.fund_id),
                amc_logo_url=amc_logos.get(order.fund_id),
            )
        )
    return MfOrderListResponse(orders=responses)


@router.get("/orders/{order_id}/journey", response_model=MfOrderJourneyResponse)
async def get_mf_order_journey(
    order_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfOrderJourneyResponse:
    payload = await get_user_order_journey(db, user_id=current_user.id, order_id=order_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Order not found")
    return MfOrderJourneyResponse(**payload)


@router.get("/orders/{order_id}", response_model=MfOrderResponse)
async def get_mf_order(
    order_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfOrderResponse:
    order = await get_user_order(db, user_id=current_user.id, order_id=order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if await advance_order_for_payment(db, order, user_ip=get_client_ip(request)):
        await db.commit()
    product = await db.get(Product, order.product_id)
    return await _order_response(db, order, product_name=product.name if product else None)


@router.post("/orders/{order_id}/abandon-payment", response_model=MfOrderResponse)
async def abandon_mf_order_payment(
    order_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfOrderResponse:
    order = await get_user_order(db, user_id=current_user.id, order_id=order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not await abandon_unpaid_order_payment(db, order):
        raise HTTPException(status_code=409, detail="Payment cannot be abandoned in its current state")
    await db.commit()
    product = await db.get(Product, order.product_id)
    return await _order_response(db, order, product_name=product.name if product else None)


@router.get("/holdings/external", response_model=MfHoldingsResponse)
async def list_external_holdings(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
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
    current_user: Annotated[User, Depends(get_current_user)],
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


@router.get("/bank-accounts", response_model=InvestorBankAccountListResponse)
async def get_investor_bank_accounts(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> InvestorBankAccountListResponse:
    try:
        accounts = await list_user_bank_accounts(db, user_id=current_user.id)
    except InvestorBankAccountError as exc:
        return _handle_investor_bank_account_error(exc)  # type: ignore[return-value]
    return InvestorBankAccountListResponse(
        bank_accounts=[_bank_account_response(account) for account in accounts]
    )


@router.post("/bank-accounts/verify", response_model=InvestorBankAccountVerifyResponse)
async def post_investor_bank_account_verify(
    body: InvestorBankAccountVerifyRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> InvestorBankAccountVerifyResponse:
    try:
        result = await verify_and_add_bank_account(
            db,
            user=current_user,
            account_number=body.account_number,
            account_type=body.account_type,
            ifsc_code=body.ifsc_code,
        )
    except InvestorBankAccountError as exc:
        return _handle_investor_bank_account_error(exc)  # type: ignore[return-value]
    await db.commit()
    base = _bank_account_response(result)
    return InvestorBankAccountVerifyResponse(
        **base.model_dump(),
        success=bool(result.get("success")),
        pan_verified=bool(result.get("pan_verified")),
        bank_verified=bool(result.get("bank_verified")),
    )


@router.post("/bank-accounts/{bank_account_id}/upload-proof", response_model=InvestorBankAccountProofUploadResponse)
async def post_investor_bank_account_upload_proof(
    bank_account_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    file: UploadFile = File(...),
) -> InvestorBankAccountProofUploadResponse:
    content = await file.read()
    try:
        result = await upload_bank_account_proof(
            db,
            user=current_user,
            bank_account_id=bank_account_id,
            file_bytes=content,
            filename=file.filename or "bank-proof.pdf",
            content_type=file.content_type or "application/octet-stream",
        )
    except InvestorBankAccountError as exc:
        return _handle_investor_bank_account_error(exc)  # type: ignore[return-value]
    await db.commit()
    return InvestorBankAccountProofUploadResponse(
        file_id=result["file_id"],
        bank_account=_bank_account_response(result["bank_account"]),
    )


@router.post(
    "/bank-accounts/{bank_account_id}/verify-manual",
    response_model=InvestorBankAccountManualVerifyResponse,
)
async def post_investor_bank_account_verify_manual(
    bank_account_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> InvestorBankAccountManualVerifyResponse:
    try:
        result = await verify_bank_account_manual(
            db,
            user=current_user,
            bank_account_id=bank_account_id,
        )
    except InvestorBankAccountError as exc:
        return _handle_investor_bank_account_error(exc)  # type: ignore[return-value]
    await db.commit()
    base = _bank_account_response(result)
    return InvestorBankAccountManualVerifyResponse(
        **base.model_dump(),
        success=bool(result.get("success")),
        bank_verified=bool(result.get("bank_verified")),
        readiness_verified=bool(result.get("readiness_verified")),
    )


@router.get(
    "/bank-accounts/{bank_account_id}/preverify-status",
    response_model=InvestorBankAccountPreverifyStatusResponse,
)
async def get_investor_bank_account_preverify_status(
    bank_account_id: UUID,
    preverify_id: Annotated[str, Query(min_length=1)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> InvestorBankAccountPreverifyStatusResponse:
    try:
        result = await get_bank_account_preverify_status(
            db,
            user_id=current_user.id,
            bank_account_id=bank_account_id,
            preverify_id=preverify_id,
        )
    except InvestorBankAccountError as exc:
        return _handle_investor_bank_account_error(exc)  # type: ignore[return-value]
    return InvestorBankAccountPreverifyStatusResponse(**result)


@router.patch("/bank-accounts/{bank_account_id}/set-primary", response_model=InvestorBankAccountResponse)
async def patch_investor_bank_account_set_primary(
    bank_account_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> InvestorBankAccountResponse:
    try:
        result = await set_primary_bank_account(
            db,
            user_id=current_user.id,
            bank_account_id=bank_account_id,
        )
    except InvestorBankAccountError as exc:
        return _handle_investor_bank_account_error(exc)  # type: ignore[return-value]
    await db.commit()
    return _bank_account_response(result)


@router.delete("/bank-accounts/{bank_account_id}", status_code=204)
async def delete_investor_bank_account(
    bank_account_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    try:
        await disable_bank_account(
            db,
            user_id=current_user.id,
            bank_account_id=bank_account_id,
        )
    except InvestorBankAccountError as exc:
        return _handle_investor_bank_account_error(exc)  # type: ignore[return-value]
    await db.commit()


def _handle_risk_profile_error(exc: RiskProfileError) -> HTTPException:
    return HTTPException(
        status_code=exc.status_code,
        detail={"code": exc.code, "message": exc.message},
    )


@router.get("/risk-profile/tiers", response_model=InvestRiskProfileTierListResponse)
async def get_invest_risk_profile_tiers(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> InvestRiskProfileTierListResponse:
    del current_user
    tiers = await list_tiers(db)
    return InvestRiskProfileTierListResponse(
        items=[InvestRiskProfileTierResponse(**item) for item in tiers],
    )


@router.get("/risk-profile/config", response_model=InvestRiskProfileConfigResponse)
async def get_invest_risk_profile_config(
    current_user: Annotated[User, Depends(get_current_user)],
) -> InvestRiskProfileConfigResponse:
    del current_user
    return InvestRiskProfileConfigResponse(**serialize_risk_profile_config())


@router.get("/risk-profile/assessment", response_model=InvestRiskProfileAssessmentResponse)
async def get_invest_risk_profile_assessment(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    template_id: Optional[UUID] = Query(default=None),
    auto: bool = Query(default=True),
) -> InvestRiskProfileAssessmentResponse:
    try:
        await ensure_can_take_assessment(db, current_user.id)
        if template_id is not None:
            result = await resolve_template_questions(db, template_id=template_id)
            return InvestRiskProfileAssessmentResponse(
                template=InvestRiskProfileTemplateSummaryResponse(
                    id=result["template"]["id"],
                    name=result["template"]["name"],
                    description=result["template"].get("description"),
                    is_default=result["template"]["is_default"],
                    selection_mode=result["template"]["selection_mode"],
                    total_questions=result["total_questions"],
                ),
                questions=[InvestRiskProfileQuestionResponse(**item) for item in result["questions"]],
                total_questions=result["total_questions"],
            )
        if auto:
            result = await auto_select_template(db, user_id=current_user.id)
            return InvestRiskProfileAssessmentResponse(
                selection_reason=result["selection_reason"],
                preferred_question_count=result["preferred_question_count"],
                template=InvestRiskProfileTemplateSummaryResponse(
                    id=result["template"]["id"],
                    name=result["template"]["name"],
                    description=result["template"].get("description"),
                    is_default=result["template"]["is_default"],
                    selection_mode=result["template"]["selection_mode"],
                    total_questions=result["total_questions"],
                ),
                questions=[InvestRiskProfileQuestionResponse(**item) for item in result["questions"]],
                total_questions=result["total_questions"],
            )
        raise RiskProfileError("template_required", "template_id is required when auto-select is disabled.")
    except RiskProfileError as exc:
        raise _handle_risk_profile_error(exc) from exc


@router.post("/risk-profile/assessment/submit", response_model=InvestRiskProfileResultResponse)
async def post_invest_risk_profile_submit(
    body: InvestRiskProfileSubmitRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> InvestRiskProfileResultResponse:
    try:
        result = await submit_assessment(
            db,
            user=current_user,
            answers=[answer.model_dump() for answer in body.answers],
            ip=get_client_ip(request),
            template_id=body.template_id,
        )
    except RiskProfileError as exc:
        raise _handle_risk_profile_error(exc) from exc
    await db.commit()
    return InvestRiskProfileResultResponse(
        assessment_id=result["assessment_id"],
        score=result["score"],
        display_score=result["display_score"],
        tier=result["tier"],
        tier_config=InvestRiskProfileTierResponse(**result["tier_config"]),
        category_scores=result["category_scores"],
        attempt_state=InvestRiskProfileAttemptStateResponse(**result["attempt_state"]),
    )


@router.get("/risk-profile/session", response_model=InvestRiskProfileSessionResponse)
async def get_invest_risk_profile_session(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> InvestRiskProfileSessionResponse:
    attempt_state = await get_attempt_state(db, current_user.id)
    draft = await get_draft(db, current_user.id)
    return InvestRiskProfileSessionResponse(
        attempt_state=InvestRiskProfileAttemptStateResponse(**attempt_state),
        draft=InvestRiskProfileDraftResponse(**draft) if draft else None,
    )


@router.put("/risk-profile/assessment/draft", response_model=InvestRiskProfileDraftResponse)
async def put_invest_risk_profile_draft(
    body: InvestRiskProfileDraftUpsertRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> InvestRiskProfileDraftResponse:
    try:
        await ensure_can_take_assessment(db, current_user.id)
        draft = await upsert_draft(
            db,
            user_id=current_user.id,
            template_id=body.template_id,
            question_ids=body.question_ids,
            answers=body.answers,
            step_index=body.step_index,
        )
    except RiskProfileError as exc:
        raise _handle_risk_profile_error(exc) from exc
    await db.commit()
    return InvestRiskProfileDraftResponse(**draft)


@router.delete("/risk-profile/assessment/draft", status_code=204)
async def delete_invest_risk_profile_draft(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    await delete_draft(db, current_user.id)
    await db.commit()


@router.get(
    "/risk-profile/assessments",
    response_model=InvestRiskProfileAssessmentHistoryResponse,
)
async def get_invest_risk_profile_assessments(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> InvestRiskProfileAssessmentHistoryResponse:
    result = await list_user_assessments(
        db,
        user_id=current_user.id,
        limit=limit,
        offset=offset,
    )
    return InvestRiskProfileAssessmentHistoryResponse(
        items=[InvestRiskProfileAssessmentHistoryItemResponse(**item) for item in result["items"]],
        limit=result["limit"],
        offset=result["offset"],
    )


@router.get(
    "/risk-profile/assessments/{assessment_id}/answers",
    response_model=InvestRiskProfileAssessmentAnswersResponse,
)
async def get_invest_risk_profile_assessment_answers(
    assessment_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> InvestRiskProfileAssessmentAnswersResponse:
    try:
        result = await get_assessment_answers(
            db,
            user_id=current_user.id,
            assessment_id=assessment_id,
        )
    except RiskProfileError as exc:
        raise _handle_risk_profile_error(exc) from exc
    return InvestRiskProfileAssessmentAnswersResponse(
        assessment_id=result["assessment_id"],
        completed_at=result["completed_at"],
        answers=[InvestRiskProfileAssessmentAnswerResponse(**item) for item in result["answers"]],
    )


@router.get("/risk-profile/result", response_model=InvestRiskProfileCurrentResponse)
async def get_invest_risk_profile_result(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> InvestRiskProfileCurrentResponse:
    result = await get_user_risk_profile(db, current_user.id)
    if not result:
        raise HTTPException(
            status_code=404,
            detail={"code": "risk_profile_not_found", "message": "Risk profile not completed yet."},
        )
    return InvestRiskProfileCurrentResponse(
        user_id=result["user_id"],
        score=result["score"],
        display_score=result["display_score"],
        tier=result["tier"],
        tier_config=InvestRiskProfileTierResponse(**result["tier_config"]),
        assessment_id=result["assessment_id"],
        questions_answered=result["questions_answered"],
        total_questions=result["total_questions"],
        computed_at=result["computed_at"],
        updated_at=result["updated_at"],
        attempt_state=InvestRiskProfileAttemptStateResponse(**result["attempt_state"]),
    )


@router.get("/risk-profile/report", response_model=InvestRiskProfileReportResponse)
async def get_invest_risk_profile_report(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    assessment_id: UUID | None = Query(default=None),
) -> InvestRiskProfileReportResponse:
    try:
        result = await get_report_metadata(
            db,
            user_id=current_user.id,
            assessment_id=assessment_id,
        )
    except RiskProfileError as exc:
        raise _handle_risk_profile_error(exc) from exc
    return InvestRiskProfileReportResponse(**result)


@router.get("/risk-profile/report/download")
async def download_invest_risk_profile_report(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    assessment_id: UUID | None = Query(default=None),
) -> Response:
    try:
        pdf_bytes, filename, from_cache = await get_or_create_report_pdf(
            db,
            user=current_user,
            assessment_id=assessment_id,
        )
        await db.commit()
    except RiskProfileError as exc:
        await db.rollback()
        raise _handle_risk_profile_error(exc) from exc
    except FileNotFoundError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail={"code": "report_asset_missing", "message": "Report branding assets are unavailable."},
        ) from exc
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail={"code": "report_generation_failed", "message": "Could not generate the risk profile report."},
        ) from exc

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Report-Cached": "true" if from_cache else "false",
        },
    )
