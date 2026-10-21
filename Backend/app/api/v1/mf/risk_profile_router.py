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
        raise mf_h._handle_risk_profile_error(exc) from exc


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
        raise mf_h._handle_risk_profile_error(exc) from exc
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
        raise mf_h._handle_risk_profile_error(exc) from exc
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
        raise mf_h._handle_risk_profile_error(exc) from exc
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
        raise mf_h._handle_risk_profile_error(exc) from exc
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
        raise mf_h._handle_risk_profile_error(exc) from exc
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

