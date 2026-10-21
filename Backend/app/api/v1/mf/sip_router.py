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

@router.post("/sip/plans/validate", response_model=ValidateMfSipPlanResponse)
async def validate_mf_sip_plan(
    body: ValidateMfSipPlanRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> ValidateMfSipPlanResponse:
    settings = get_settings()
    if not settings.zynd_mf_orders_enabled or not settings.zynd_mf_sip_enabled:
        raise HTTPException(status_code=503, detail="SIP is temporarily unavailable")

    try:
        payload = await validate_sip_plan_inputs(
            db,
            product_id=body.product_id,
            amount_inr=Decimal(str(body.amount_inr)),
            frequency=body.frequency,
            installment_day=body.installment_day,
            number_of_installments=body.number_of_installments,
        )
    except MfOrderError:
        await db.rollback()
        raise

    return ValidateMfSipPlanResponse(**payload)


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
            family_group_id=body.family_group_id,
            mandate_type=body.mandate_type,
            folio_number=body.folio_number,
        )
        product = await db.get(Product, plan.product_id)
        await db.commit()
    except MfOrderError:
        await db.rollback()
        raise

    return await mf_h._sip_plan_response(
        db, plan, product_name=product.name if product else None, user_id=current_user.id
    )


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
        await mf_h._sip_plan_response(
            db,
            plan,
            product_name=products.get(plan.product_id),
            amc_name=amc_names.get(plan.fund_id),
            amc_logo_url=amc_logos.get(plan.fund_id),
            isin=isins.get(plan.fund_id),
            user_id=current_user.id,
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
    return await mf_h._sip_plan_response(
        db, plan, product_name=product.name if product else None, user_id=current_user.id
    )


@router.get("/sip/plans/{plan_id}/journey", response_model=MfSipPlanJourneyResponse)
async def get_mf_sip_plan_journey(
    plan_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfSipPlanJourneyResponse:
    payload = await get_user_sip_plan_journey(db, user_id=current_user.id, plan_id=plan_id)
    if not payload:
        raise HTTPException(status_code=404, detail="SIP plan not found")
    await db.commit()
    return MfSipPlanJourneyResponse(**payload)


@router.get("/sip/plans/{plan_id}/bank-switch", response_model=MfSipPlanBankSwitchSummary)
async def get_mf_sip_plan_bank_switch(
    plan_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfSipPlanBankSwitchSummary:
    from app.application.mf.mf_sip_plan_mandate_switch_service import build_bank_switch_response
    from app.infrastructure.persistence.mf_transaction_models import MfMandate

    plan = await get_user_sip_plan(db, user_id=current_user.id, plan_id=plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="SIP plan not found")
    mandate_row = await db.get(MfMandate, plan.mf_mandate_id) if plan.mf_mandate_id else None
    payload = await build_bank_switch_response(db, plan, mandate=mandate_row)
    return MfSipPlanBankSwitchSummary(**payload)


@router.post("/sip/plans/{plan_id}/bank-switch", response_model=MfSipPlanResponse)
async def post_mf_sip_plan_bank_switch(
    plan_id: UUID,
    body: MfSipPlanBankSwitchRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfSipPlanResponse:
    from app.application.mf.mf_sip_plan_mandate_switch_service import switch_sip_plan_mandate

    settings = get_settings()
    if not settings.zynd_mf_orders_enabled or not settings.zynd_mf_sip_enabled:
        raise HTTPException(status_code=503, detail="SIP is temporarily unavailable")

    plan = await get_user_sip_plan(db, user_id=current_user.id, plan_id=plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="SIP plan not found")
    try:
        plan = await switch_sip_plan_mandate(
            db,
            plan,
            user_id=current_user.id,
            bank_account_id=body.bank_account_id,
            mandate_type=body.mandate_type,
            idempotency_key=body.idempotency_key,
        )
        product = await db.get(Product, plan.product_id)
        await db.commit()
    except MfOrderError:
        await db.rollback()
        raise
    return await mf_h._sip_plan_response(
        db, plan, product_name=product.name if product else None, user_id=current_user.id
    )


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
    except MfOrderError:
        await db.rollback()
        raise
    return await mf_h._sip_plan_response(
        db, plan, product_name=product.name if product else None, user_id=current_user.id
    )


@router.post("/sip/plans/{plan_id}/first-installment/pay", response_model=MfSipFirstInstallmentSummary)
async def pay_mf_sip_first_installment(
    plan_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfSipFirstInstallmentSummary:
    from app.application.mf.mf_sip_first_installment_service import initiate_sip_first_installment_payment
    from app.application.core.facade import FpClientError
    from app.infrastructure.persistence.mf_transaction_models import MfMandate

    plan = await get_user_sip_plan(db, user_id=current_user.id, plan_id=plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="SIP plan not found")
    mandate_row = await db.get(MfMandate, plan.mf_mandate_id) if plan.mf_mandate_id else None
    try:
        payload = await initiate_sip_first_installment_payment(db, plan, mandate=mandate_row)
        await db.commit()
    except FpClientError as exc:
        await db.rollback()
        raise HTTPException(status_code=exc.status_code or 502, detail=exc.message) from exc
    return MfSipFirstInstallmentSummary(**payload)


@router.post("/sip/plans/{plan_id}/confirm-first-installment-return", response_model=MfSipPlanResponse)
async def confirm_mf_sip_first_installment_return(
    plan_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfSipPlanResponse:
    from app.application.mf.mf_sip_first_installment_service import confirm_sip_first_installment_return
    from app.infrastructure.persistence.mf_transaction_models import MfMandate

    plan = await get_user_sip_plan(db, user_id=current_user.id, plan_id=plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="SIP plan not found")
    mandate_row = await db.get(MfMandate, plan.mf_mandate_id) if plan.mf_mandate_id else None
    await confirm_sip_first_installment_return(db, plan, mandate=mandate_row)
    product = await db.get(Product, plan.product_id)
    await db.commit()
    return await mf_h._sip_plan_response(
        db, plan, product_name=product.name if product else None, user_id=current_user.id
    )


@router.post("/sip/plans/{plan_id}/confirm-mandate-return", response_model=MfSipPlanResponse)
async def confirm_mf_sip_mandate_return(
    plan_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfSipPlanResponse:
    plan = await get_user_sip_plan(db, user_id=current_user.id, plan_id=plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="SIP plan not found")
    try:
        await confirm_mandate_return(db, plan)
        product = await db.get(Product, plan.product_id)
        await db.commit()
    except MfOrderError:
        await db.rollback()
        raise
    return await mf_h._sip_plan_response(
        db, plan, product_name=product.name if product else None, user_id=current_user.id
    )


@router.post("/sip/plans/{plan_id}/abandon-mandate", response_model=MfSipPlanResponse)
async def abandon_mf_sip_mandate(
    plan_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfSipPlanResponse:
    plan = await get_user_sip_plan(db, user_id=current_user.id, plan_id=plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="SIP plan not found")
    try:
        await abandon_unfinished_mandate_auth(db, plan)
        product = await db.get(Product, plan.product_id)
        await db.commit()
    except MfOrderError:
        await db.rollback()
        raise
    return await mf_h._sip_plan_response(
        db, plan, product_name=product.name if product else None, user_id=current_user.id
    )


