from __future__ import annotations

from typing import Annotated, Literal, Optional
from uuid import UUID

from decimal import Decimal

from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.deps import get_client_ip, get_current_user, require_invest_eligible_user
from app.api.v1.mf.schemas import (
    CheckoutMfCartRequest,
    BulkUpsertMfCartItemsRequest,
    CreateMfMandateRequest,
    CreateMfOrderRequest,
    CreateMfSipPlanRequest,
    ValidateMfSipPlanRequest,
    ValidateMfSipPlanResponse,
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
    CreateInvestorReportRequest,
    InvestorReportListResponse,
    InvestorReportResponse,
    MfCheckoutResponse,
    MfExternalHoldingResponse,
    MfHoldingsResponse,
    MfMandateListResponse,
    MfMandateResponse,
    MfOrderListResponse,
    MfOrderJourneyResponse,
    MfOrderResponse,
    MfPaymentStatusResponse,
    MfSipCartCheckoutResponse,
    MfSipPlanBankSwitchRequest,
    MfSipPlanBankSwitchSummary,
    MfSipFirstInstallmentSummary,
    MfSipPlanJourneyResponse,
    MfSipPlanListResponse,
    MfSipPlanResponse,
    PortfolioHoldingsListResponse,
    PortfolioHoldingResponse,
    PortfolioHoldingDetailEnvelopeResponse,
    PortfolioHoldingDetailResponse,
    PortfolioHoldingTransactionResponse,
    PortfolioRedeemUnitsListResponse,
    PortfolioRedeemUnitsItemResponse,
    PortfolioActiveRedemptionResponse,
    MfRedemptionJourneyEnvelopeResponse,
    MfRedemptionJourneyResponse,
    MfRedemptionJourneyEventResponse,
    CreateMfRedemptionRequest,
    ConfirmMfPurchaseConsentRequest,
    ConfirmMfRedemptionRequest,
    MfRedemptionOrderResponse,
    MfRedemptionConsentResponse,
    MfRedemptionOtpSendResponse,
    MfPurchaseConsentResponse,
    MfPurchaseOtpSendResponse,
    CreateMfSwitchRequest,
    ConfirmMfSwitchRequest,
    MfSwitchOrderResponse,
    MfSwitchConsentResponse,
    MfSwitchOtpSendResponse,
    MfSwitchDestinationListResponse,
    MfSwitchDestinationResponse,
    CreateMfSwpPlanRequest,
    CreateMfStpPlanRequest,
    ConfirmMfSystematicPlanRequest,
    MfSystematicPlanResponse,
    MfSystematicPlanListResponse,
    MfSystematicPlanConsentResponse,
    MfSystematicPlanOtpSendResponse,
    PortfolioSummaryResponse,
    PortfolioUpcomingSipResponse,
    PortfolioAllocationSliceResponse,
    PortfolioGrowthPointResponse,
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
from app.application.mf.investor_report_service import (
    InvestorReportError,
    download_investor_report,
    generate_investor_report,
    list_investor_reports_page,
)
from app.infrastructure.persistence.mf_transaction_models import MfGeneratedReportKind
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
from app.application.mf.portfolio_holdings_service import (
    get_user_portfolio_holding_detail,
    get_user_portfolio_summary,
    get_user_redemption_journey,
    list_user_portfolio_holdings,
    list_user_redeemable_holdings,
)
from app.application.mf.mf_redemption_service import (
    cancel_initiated_redemption_order,
    confirm_redemption_order,
    create_redemption_order,
    get_redemption_consent_context,
    get_redemption_order,
    send_redemption_consent_otp,
    serialize_redemption_order,
    sync_redemption_order_from_fp,
)
from app.application.mf.mf_switch_service import (
    cancel_initiated_switch_order,
    confirm_switch_order,
    create_switch_order,
    get_switch_consent_context,
    get_switch_journey,
    get_switch_order,
    list_switch_destinations,
    send_switch_consent_otp,
    serialize_switch_order,
)
from app.application.mf.mf_systematic_plan_service import (
    cancel_systematic_plan,
    confirm_systematic_plan,
    create_stp_plan,
    create_swp_plan,
    get_plan_consent_context,
    get_plan_journey,
    get_stp_plan,
    get_swp_plan,
    list_user_stp_plans,
    list_user_swp_plans,
    product_name as systematic_product_name,
    send_plan_consent_otp,
    serialize_systematic_plan,
)
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
    abandon_unfinished_mandate_auth,
    confirm_mandate_return,
    cancel_sip_plan,
    create_sip_plan,
    validate_sip_plan_inputs,
    get_user_sip_plan,
    get_user_sip_plan_journey,
    list_user_sip_plans,
    load_sip_plan_fund_metadata,
    serialize_sip_plan,
)
from app.application.mf.mf_purchase_consent_service import (
    confirm_purchase_consent_and_advance,
    get_purchase_consent_context,
    send_purchase_consent_otp,
    snapshot_purchase_consent_for_order,
)
from app.application.mf.mf_order_service import (
    TERMINAL_STATUSES,
    create_lumpsum_order,
    get_user_order,
    get_user_order_journey,
    list_user_orders,
    load_order_fund_metadata,
    load_order_product_slugs,
    serialize_order,
)
from app.application.mf.mf_lumpsum_reconciliation_service import (
    reconcile_checkout_payment,
    reconcile_order_payment,
)
from app.application.mf.mf_payment_flow_service import (
    abandon_unpaid_checkout_payment,
    abandon_unpaid_order_payment,
    advance_checkout_for_payment,
    advance_order_for_payment,
    confirm_checkout_payment_return,
    confirm_order_payment_return,
)
from app.core.config import get_settings
from app.core.database import get_db
from app.infrastructure.persistence.mf_models import Product
from app.infrastructure.persistence.mf_transaction_models import MfCheckout, MfMandate, MfOrderType
from app.infrastructure.persistence.models import User


router = APIRouter()

from app.api.v1.mf import _router_helpers as mf_h

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
        nfo_carousel=[InvestFundSummaryResponse(**item) for item in payload.get("nfo_carousel", [])],
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


@router.get("/nfo", response_model=InvestFundListResponse)
async def invest_nfo_list(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    status: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> InvestFundListResponse:
    from app.application.mf.nfo_list_service import list_invest_nfo

    from app.application.mf.public_asset_service import enrich_fund_list_payload
    from app.core.config import get_settings

    try:
        payload = await list_invest_nfo(db, status=status, page=page, page_size=page_size)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    payload = enrich_fund_list_payload(payload, get_settings())
    return InvestFundListResponse(**payload)


@router.get("/nfo/{product_id}", response_model=InvestFundDetailResponse)
async def invest_nfo_detail(
    product_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> InvestFundDetailResponse:
    from app.application.mf.nfo_list_service import get_invest_nfo_detail

    payload = await get_invest_nfo_detail(db, product_id)
    if not payload:
        raise HTTPException(status_code=404, detail="NFO not found")
    return InvestFundDetailResponse(**payload)


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
    max_min_sip_inr: Optional[float] = Query(default=None, ge=1, le=10_000_000),
) -> InvestFundSearchResponse:
    payload = await cached_search_invest_funds(
        db,
        query=q,
        page=page,
        page_size=page_size,
        max_min_sip_inr=max_min_sip_inr,
    )
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
    except MfCalculatorError:
        raise
    return MfCompareResponse(
        funds=[InvestFundDetailResponse(**item) for item in payload["funds"]],
        disclaimer=payload["disclaimer"],
    )


@router.get("/funds/{fund_ref}/navs", response_model=InvestFundNavHistoryResponse)
async def invest_fund_navs(
    fund_ref: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    limit: int = Query(default=2000, ge=1, le=2000),
) -> InvestFundNavHistoryResponse:
    product_id = await mf_h._resolve_fund_product_id(db, fund_ref)
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
    product_id = await mf_h._resolve_fund_product_id(db, fund_ref)
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
    product_id = await mf_h._resolve_fund_product_id(db, fund_ref)
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
    except MfCalculatorError:
        raise
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
    product_id = await mf_h._resolve_fund_product_id(db, fund_ref)
    horizon_list = [part.strip() for part in (horizons or "").split(",") if part.strip()] or None
    try:
        payload = await cached_compute_lumpsum_calculator(
            db,
            product_id=product_id,
            amount_inr=amount_inr,
            horizons=horizon_list,
        )
    except MfCalculatorError:
        raise
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
    product_id = await mf_h._resolve_fund_product_id(db, fund_ref)
    try:
        payload = await cached_compute_sip_calculator(
            db,
            product_id=product_id,
            monthly_amount_inr=monthly_amount_inr,
            duration_months=duration_months,
            sip_day=sip_day,
        )
    except MfCalculatorError:
        raise
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
    product_id = await mf_h._resolve_fund_product_id(db, fund_ref)
    try:
        payload = await cached_compute_swp_calculator(
            db,
            product_id=product_id,
            corpus_inr=corpus_inr,
            monthly_withdrawal_inr=monthly_withdrawal_inr,
            duration_months=duration_months,
            withdrawal_day=withdrawal_day,
        )
    except MfCalculatorError:
        raise
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


