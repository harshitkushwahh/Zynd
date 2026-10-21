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

from app.api.v1.mf.txn_recommendation_schemas import (
    ApplyMitraTxnRecommendationResponse,
    InvestorMitraTxnRecommendationResponse,
)
from app.application.distributor.mitra_txn_recommendation_service import (
    MitraTxnRecommendationError,
    apply_mitra_txn_recommendation_for_investor,
    get_mitra_txn_recommendation_for_investor,
)


def _invest_mitra_txn_recommendation_http_error(exc: MitraTxnRecommendationError) -> HTTPException:
    return HTTPException(
        status_code=exc.status_code,
        detail={"code": exc.code, "message": exc.message},
    )

@router.get("/txn-recommendations/{token}", response_model=InvestorMitraTxnRecommendationResponse)
async def get_investor_mitra_txn_recommendation_route(
    token: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> InvestorMitraTxnRecommendationResponse:
    try:
        payload = await get_mitra_txn_recommendation_for_investor(
            db,
            investor=current_user,
            token=token,
        )
    except MitraTxnRecommendationError as exc:
        raise _invest_mitra_txn_recommendation_http_error(exc) from exc
    await db.commit()
    return InvestorMitraTxnRecommendationResponse(**payload)


@router.post("/txn-recommendations/{token}/apply", response_model=ApplyMitraTxnRecommendationResponse)
async def apply_investor_mitra_txn_recommendation_route(
    token: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> ApplyMitraTxnRecommendationResponse:
    try:
        payload = await apply_mitra_txn_recommendation_for_investor(
            db,
            investor=current_user,
            token=token,
        )
    except MitraTxnRecommendationError as exc:
        raise _invest_mitra_txn_recommendation_http_error(exc) from exc
    await db.commit()
    rec = payload["recommendation"]
    return ApplyMitraTxnRecommendationResponse(
        applied=payload["applied"],
        status=payload["status"],
        redirect_path=payload["redirect_path"],
        recommendation=InvestorMitraTxnRecommendationResponse(
            **rec,
            cart_path=payload["redirect_path"],
            fund_path=f"/dashboard/mutual-funds/funds/{rec.get('fund_slug') or rec.get('product_id')}",
        ),
    )
