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
    MfCasQrRequest,
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
    PortfolioFamilyLinkResponse,
    UpsertPortfolioFamilyLinkRequest,
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
    validate_user_cas_qr,
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
from app.application.family_groups.family_holding_link_service import (
    remove_family_holding_link,
    serialize_family_holding_link,
    upsert_family_holding_link,
)
from app.application.goals.errors import GoalError
from app.application.mf.portfolio_holdings_service import (
    get_user_portfolio_holding_detail,
    parse_holding_id,
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

@router.get("/holdings/external", response_model=MfHoldingsResponse)
async def list_external_holdings(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfHoldingsResponse:
    holdings = await list_user_external_holdings(db, user_id=current_user.id)
    return MfHoldingsResponse(
        external_holdings=[MfExternalHoldingResponse(**item) for item in holdings]
    )


@router.get("/portfolio/summary", response_model=PortfolioSummaryResponse)
async def get_portfolio_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PortfolioSummaryResponse:
    payload = await get_user_portfolio_summary(db, user_id=current_user.id)
    return PortfolioSummaryResponse(
        status=payload["status"],
        has_pending_orders=payload["has_pending_orders"],
        current_value_inr=payload["current_value_inr"],
        invested_inr=payload["invested_inr"],
        total_return_inr=payload["total_return_inr"],
        total_return_pct=payload["total_return_pct"],
        day_change_inr=payload["day_change_inr"],
        day_change_pct=payload["day_change_pct"],
        xirr_pct=payload["xirr_pct"],
        holdings_count=payload["holdings_count"],
        active_sips_count=payload["active_sips_count"],
        monthly_sip_inr=payload["monthly_sip_inr"],
        upcoming_sips=[PortfolioUpcomingSipResponse(**item) for item in payload.get("upcoming_sips", [])],
        allocation=[PortfolioAllocationSliceResponse(**item) for item in payload["allocation"]],
        growth=[PortfolioGrowthPointResponse(**item) for item in payload["growth"]],
        as_on=payload["as_on"],
    )


@router.get("/portfolio/holdings", response_model=PortfolioHoldingsListResponse)
async def list_portfolio_holdings(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PortfolioHoldingsListResponse:
    payload = await list_user_portfolio_holdings(db, user_id=current_user.id)
    return PortfolioHoldingsListResponse(
        status=payload["status"],
        has_pending_orders=payload["has_pending_orders"],
        holdings=[PortfolioHoldingResponse(**item) for item in payload["holdings"]],
        as_on=payload["as_on"],
    )


@router.get("/portfolio/holdings/detail", response_model=PortfolioHoldingDetailEnvelopeResponse)
async def get_portfolio_holding_detail(
    holding_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PortfolioHoldingDetailEnvelopeResponse:
    payload = await get_user_portfolio_holding_detail(
        db,
        user_id=current_user.id,
        holding_id=holding_id,
    )
    holding_payload = payload.get("holding")
    if holding_payload:
        parsed = parse_holding_id(str(holding_payload.get("id") or holding_id))
        family_link = None
        if parsed:
            folio_number, isin = parsed
            family_link = await serialize_family_holding_link(
                db,
                user_id=current_user.id,
                folio_number=folio_number,
                isin=isin,
            )
        holding_payload = {**holding_payload, "family_link": family_link}
    holding = PortfolioHoldingDetailResponse(**holding_payload) if holding_payload else None
    return PortfolioHoldingDetailEnvelopeResponse(status=payload["status"], holding=holding)


def _family_link_http_error(exc: GoalError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail={"code": exc.code, "message": exc.message})


@router.put("/portfolio/holdings/family-link", response_model=PortfolioFamilyLinkResponse)
async def upsert_portfolio_holding_family_link(
    body: UpsertPortfolioFamilyLinkRequest,
    holding_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PortfolioFamilyLinkResponse:
    parsed = parse_holding_id(holding_id)
    if parsed is None:
        raise HTTPException(status_code=400, detail={"code": "invalid_holding", "message": "Invalid holding."})
    folio_number, isin = parsed
    try:
        await upsert_family_holding_link(
            db,
            user_id=current_user.id,
            folio_number=folio_number,
            isin=isin,
            family_group_id=body.family_group_id,
            goal_id=body.goal_id,
        )
        await db.commit()
    except GoalError as exc:
        await db.rollback()
        raise _family_link_http_error(exc) from exc
    payload = await serialize_family_holding_link(
        db,
        user_id=current_user.id,
        folio_number=folio_number,
        isin=isin,
    )
    if payload is None:
        raise HTTPException(status_code=404, detail={"code": "family_link_not_found", "message": "Family link not found."})
    return PortfolioFamilyLinkResponse(**payload)


@router.delete("/portfolio/holdings/family-link", status_code=204)
async def delete_portfolio_holding_family_link(
    holding_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Response:
    parsed = parse_holding_id(holding_id)
    if parsed is None:
        raise HTTPException(status_code=400, detail={"code": "invalid_holding", "message": "Invalid holding."})
    folio_number, isin = parsed
    await remove_family_holding_link(
        db,
        user_id=current_user.id,
        folio_number=folio_number,
        isin=isin,
    )
    await db.commit()
    return Response(status_code=204)


@router.get("/portfolio/redeem-units", response_model=PortfolioRedeemUnitsListResponse)
async def list_portfolio_redeem_units(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PortfolioRedeemUnitsListResponse:
    payload = await list_user_redeemable_holdings(db, user_id=current_user.id)
    return PortfolioRedeemUnitsListResponse(
        status=payload["status"],
        as_on=payload.get("as_on"),
        items=[
            PortfolioRedeemUnitsItemResponse(
                **{k: v for k, v in item.items() if k != "active_redemption"},
                active_redemption=(
                    PortfolioActiveRedemptionResponse(**item["active_redemption"])
                    if item.get("active_redemption")
                    else None
                ),
            )
            for item in payload["items"]
        ],
    )


@router.get("/redemptions/{fp_redemption_id}/journey", response_model=MfRedemptionJourneyEnvelopeResponse)
async def get_mf_redemption_journey_route(
    fp_redemption_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfRedemptionJourneyEnvelopeResponse:
    payload = await get_user_redemption_journey(
        db,
        user_id=current_user.id,
        fp_redemption_id=fp_redemption_id,
    )
    journey_payload = payload.get("journey")
    journey = MfRedemptionJourneyResponse(**journey_payload) if journey_payload else None
    return MfRedemptionJourneyEnvelopeResponse(status=payload["status"], journey=journey)



@router.post("/redemptions", response_model=MfRedemptionOrderResponse)
async def create_mf_redemption_route(
    body: CreateMfRedemptionRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfRedemptionOrderResponse:
    settings = get_settings()
    if not settings.zynd_mf_orders_enabled:
        raise HTTPException(status_code=503, detail="MF redemptions are temporarily unavailable")

    try:
        order = await create_redemption_order(
            db,
            user_id=current_user.id,
            holding_id=body.holding_id,
            idempotency_key=body.idempotency_key,
            redeem_mode=body.redeem_mode,
            amount_inr=Decimal(str(body.amount_inr)) if body.amount_inr is not None else None,
            units=body.units,
            user_ip=get_client_ip(request),
        )
        await db.commit()
    except MfOrderError:
        await db.rollback()
        raise

    return await mf_h._redemption_order_response(db, order)


@router.get("/redemptions/{order_id}/consent", response_model=MfRedemptionConsentResponse)
async def get_mf_redemption_consent_route(
    order_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfRedemptionConsentResponse:
    try:
        payload = await get_redemption_consent_context(db, user_id=current_user.id, order_id=order_id)
    except MfOrderError:
        raise
    return MfRedemptionConsentResponse(**payload)


@router.post("/redemptions/{order_id}/consent/send-otp", response_model=MfRedemptionOtpSendResponse)
async def send_mf_redemption_consent_otp_route(
    order_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfRedemptionOtpSendResponse:
    try:
        payload = await send_redemption_consent_otp(
            db,
            user_id=current_user.id,
            order_id=order_id,
            ip=get_client_ip(request),
        )
        await db.commit()
    except MfOrderError:
        await db.rollback()
        raise
    return MfRedemptionOtpSendResponse(**payload)


@router.post("/redemptions/{order_id}/confirm", response_model=MfRedemptionOrderResponse)
async def confirm_mf_redemption_route(
    order_id: UUID,
    body: ConfirmMfRedemptionRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfRedemptionOrderResponse:
    try:
        order = await confirm_redemption_order(
            db,
            user_id=current_user.id,
            order_id=order_id,
            otp=body.otp,
            ip=get_client_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
        await db.commit()
    except MfOrderError:
        await db.rollback()
        raise

    return await mf_h._redemption_order_response(db, order)


@router.post("/redemptions/{order_id}/cancel", response_model=MfRedemptionOrderResponse)
async def cancel_mf_redemption_route(
    order_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfRedemptionOrderResponse:
    try:
        order = await cancel_initiated_redemption_order(
            db,
            user_id=current_user.id,
            order_id=order_id,
        )
        await db.commit()
    except MfOrderError:
        await db.rollback()
        raise
    return await mf_h._redemption_order_response(db, order)


@router.get("/redemptions/{order_id}", response_model=MfRedemptionOrderResponse)
async def get_mf_redemption_order_route(
    order_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfRedemptionOrderResponse:
    order = await get_redemption_order(db, user_id=current_user.id, order_id=order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Redemption order not found")
    return await mf_h._redemption_order_response(db, order)



@router.get("/switches/destinations", response_model=MfSwitchDestinationListResponse)
async def list_mf_switch_destinations_route(
    holding_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfSwitchDestinationListResponse:
    try:
        rows = await list_switch_destinations(db, user_id=current_user.id, holding_id=holding_id)
    except MfOrderError:
        raise
    return MfSwitchDestinationListResponse(destinations=[MfSwitchDestinationResponse(**row) for row in rows])


@router.post("/switches", response_model=MfSwitchOrderResponse)
async def create_mf_switch_route(
    body: CreateMfSwitchRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfSwitchOrderResponse:
    settings = get_settings()
    if not settings.zynd_mf_orders_enabled:
        raise HTTPException(status_code=503, detail="MF switches are temporarily unavailable")
    try:
        order = await create_switch_order(
            db,
            user_id=current_user.id,
            holding_id=body.holding_id,
            switch_in_product_id=body.switch_in_product_id,
            idempotency_key=body.idempotency_key,
            switch_mode=body.switch_mode,
            amount_inr=Decimal(str(body.amount_inr)) if body.amount_inr is not None else None,
            units=body.units,
            user_ip=get_client_ip(request),
        )
        await db.commit()
    except MfOrderError:
        await db.rollback()
        raise
    return await mf_h._switch_order_response(db, order)


@router.get("/switches/{order_id}/consent", response_model=MfSwitchConsentResponse)
async def get_mf_switch_consent_route(
    order_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfSwitchConsentResponse:
    payload = await get_switch_consent_context(db, user_id=current_user.id, order_id=order_id)
    return MfSwitchConsentResponse(**payload)


@router.post("/switches/{order_id}/consent/send-otp", response_model=MfSwitchOtpSendResponse)
async def send_mf_switch_consent_otp_route(
    order_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfSwitchOtpSendResponse:
    try:
        payload = await send_switch_consent_otp(
            db, user_id=current_user.id, order_id=order_id, ip=get_client_ip(request)
        )
        await db.commit()
    except MfOrderError:
        await db.rollback()
        raise
    return MfSwitchOtpSendResponse(**payload)


@router.post("/switches/{order_id}/confirm", response_model=MfSwitchOrderResponse)
async def confirm_mf_switch_route(
    order_id: UUID,
    body: ConfirmMfSwitchRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfSwitchOrderResponse:
    try:
        order = await confirm_switch_order(
            db,
            user_id=current_user.id,
            order_id=order_id,
            otp=body.otp,
            ip=get_client_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
        await db.commit()
    except MfOrderError:
        await db.rollback()
        raise
    return await mf_h._switch_order_response(db, order)


@router.post("/switches/{order_id}/cancel", response_model=MfSwitchOrderResponse)
async def cancel_mf_switch_route(
    order_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfSwitchOrderResponse:
    try:
        order = await cancel_initiated_switch_order(
            db,
            user_id=current_user.id,
            order_id=order_id,
        )
        await db.commit()
    except MfOrderError:
        await db.rollback()
        raise
    return await mf_h._switch_order_response(db, order)


@router.get("/switches/{order_id}", response_model=MfSwitchOrderResponse)
async def get_mf_switch_order_route(
    order_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfSwitchOrderResponse:
    order = await get_switch_order(db, user_id=current_user.id, order_id=order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Switch order not found")
    return await mf_h._switch_order_response(db, order)


@router.get("/switches/{order_id}/journey", response_model=MfRedemptionJourneyEnvelopeResponse)
async def get_mf_switch_journey_route(
    order_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfRedemptionJourneyEnvelopeResponse:
    payload = await get_switch_journey(db, user_id=current_user.id, order_id=order_id)
    journey_payload = payload.get("journey")
    journey = MfRedemptionJourneyResponse(**journey_payload) if journey_payload else None
    return MfRedemptionJourneyEnvelopeResponse(status=payload["status"], journey=journey)



@router.get("/swp/plans", response_model=MfSystematicPlanListResponse)
async def list_mf_swp_plans_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfSystematicPlanListResponse:
    plans = await list_user_swp_plans(db, user_id=current_user.id)
    return MfSystematicPlanListResponse(
        plans=[await mf_h._systematic_plan_response(db, plan) for plan in plans]
    )


@router.post("/swp/plans", response_model=MfSystematicPlanResponse)
async def create_mf_swp_plan_route(
    body: CreateMfSwpPlanRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfSystematicPlanResponse:
    try:
        plan = await create_swp_plan(
            db,
            user_id=current_user.id,
            holding_id=body.holding_id,
            idempotency_key=body.idempotency_key,
            amount_inr=Decimal(str(body.amount_inr)),
            installment_day=body.installment_day,
            number_of_installments=body.number_of_installments,
            user_ip=get_client_ip(request),
        )
        await db.commit()
    except MfOrderError:
        await db.rollback()
        raise
    return await mf_h._systematic_plan_response(db, plan)


@router.get("/swp/plans/{plan_id}", response_model=MfSystematicPlanResponse)
async def get_mf_swp_plan_route(
    plan_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfSystematicPlanResponse:
    plan = await get_swp_plan(db, user_id=current_user.id, plan_id=plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="SWP plan not found")
    return await mf_h._systematic_plan_response(db, plan)


@router.get("/swp/plans/{plan_id}/journey", response_model=MfRedemptionJourneyEnvelopeResponse)
async def get_mf_swp_journey_route(
    plan_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfRedemptionJourneyEnvelopeResponse:
    plan = await get_swp_plan(db, user_id=current_user.id, plan_id=plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="SWP plan not found")
    payload = await get_plan_journey(db, plan)
    journey_payload = payload.get("journey")
    journey = MfRedemptionJourneyResponse(**journey_payload) if journey_payload else None
    return MfRedemptionJourneyEnvelopeResponse(status=payload["status"], journey=journey)


@router.get("/swp/plans/{plan_id}/consent", response_model=MfSystematicPlanConsentResponse)
async def get_mf_swp_consent_route(
    plan_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfSystematicPlanConsentResponse:
    plan = await get_swp_plan(db, user_id=current_user.id, plan_id=plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="SWP plan not found")
    return MfSystematicPlanConsentResponse(**await get_plan_consent_context(db, plan))


@router.post("/swp/plans/{plan_id}/consent/send-otp", response_model=MfSystematicPlanOtpSendResponse)
async def send_mf_swp_otp_route(
    plan_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfSystematicPlanOtpSendResponse:
    plan = await get_swp_plan(db, user_id=current_user.id, plan_id=plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="SWP plan not found")
    try:
        payload = await send_plan_consent_otp(db, plan, ip=get_client_ip(request))
        await db.commit()
    except MfOrderError:
        await db.rollback()
        raise
    return MfSystematicPlanOtpSendResponse(**payload)


@router.post("/swp/plans/{plan_id}/confirm", response_model=MfSystematicPlanResponse)
async def confirm_mf_swp_plan_route(
    plan_id: UUID,
    body: ConfirmMfSystematicPlanRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfSystematicPlanResponse:
    plan = await get_swp_plan(db, user_id=current_user.id, plan_id=plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="SWP plan not found")
    try:
        plan = await confirm_systematic_plan(
            db,
            plan,
            otp=body.otp,
            ip=get_client_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
        await db.commit()
    except MfOrderError:
        await db.rollback()
        raise
    return await mf_h._systematic_plan_response(db, plan)


@router.post("/swp/plans/{plan_id}/cancel", response_model=MfSystematicPlanResponse)
async def cancel_mf_swp_plan_route(
    plan_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfSystematicPlanResponse:
    plan = await get_swp_plan(db, user_id=current_user.id, plan_id=plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="SWP plan not found")
    try:
        plan = await cancel_systematic_plan(db, plan)
        await db.commit()
    except MfOrderError:
        await db.rollback()
        raise
    return await mf_h._systematic_plan_response(db, plan)


@router.get("/stp/plans", response_model=MfSystematicPlanListResponse)
async def list_mf_stp_plans_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfSystematicPlanListResponse:
    plans = await list_user_stp_plans(db, user_id=current_user.id)
    return MfSystematicPlanListResponse(
        plans=[await mf_h._systematic_plan_response(db, plan) for plan in plans]
    )


@router.post("/stp/plans", response_model=MfSystematicPlanResponse)
async def create_mf_stp_plan_route(
    body: CreateMfStpPlanRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfSystematicPlanResponse:
    try:
        plan = await create_stp_plan(
            db,
            user_id=current_user.id,
            holding_id=body.holding_id,
            switch_in_product_id=body.switch_in_product_id,
            idempotency_key=body.idempotency_key,
            amount_inr=Decimal(str(body.amount_inr)),
            installment_day=body.installment_day,
            number_of_installments=body.number_of_installments,
            user_ip=get_client_ip(request),
        )
        await db.commit()
    except MfOrderError:
        await db.rollback()
        raise
    return await mf_h._systematic_plan_response(db, plan)


@router.get("/stp/plans/{plan_id}", response_model=MfSystematicPlanResponse)
async def get_mf_stp_plan_route(
    plan_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfSystematicPlanResponse:
    plan = await get_stp_plan(db, user_id=current_user.id, plan_id=plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="STP plan not found")
    return await mf_h._systematic_plan_response(db, plan)


@router.get("/stp/plans/{plan_id}/journey", response_model=MfRedemptionJourneyEnvelopeResponse)
async def get_mf_stp_journey_route(
    plan_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfRedemptionJourneyEnvelopeResponse:
    plan = await get_stp_plan(db, user_id=current_user.id, plan_id=plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="STP plan not found")
    payload = await get_plan_journey(db, plan)
    journey_payload = payload.get("journey")
    journey = MfRedemptionJourneyResponse(**journey_payload) if journey_payload else None
    return MfRedemptionJourneyEnvelopeResponse(status=payload["status"], journey=journey)


@router.get("/stp/plans/{plan_id}/consent", response_model=MfSystematicPlanConsentResponse)
async def get_mf_stp_consent_route(
    plan_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfSystematicPlanConsentResponse:
    plan = await get_stp_plan(db, user_id=current_user.id, plan_id=plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="STP plan not found")
    return MfSystematicPlanConsentResponse(**await get_plan_consent_context(db, plan))


@router.post("/stp/plans/{plan_id}/consent/send-otp", response_model=MfSystematicPlanOtpSendResponse)
async def send_mf_stp_otp_route(
    plan_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfSystematicPlanOtpSendResponse:
    plan = await get_stp_plan(db, user_id=current_user.id, plan_id=plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="STP plan not found")
    try:
        payload = await send_plan_consent_otp(db, plan, ip=get_client_ip(request))
        await db.commit()
    except MfOrderError:
        await db.rollback()
        raise
    return MfSystematicPlanOtpSendResponse(**payload)


@router.post("/stp/plans/{plan_id}/confirm", response_model=MfSystematicPlanResponse)
async def confirm_mf_stp_plan_route(
    plan_id: UUID,
    body: ConfirmMfSystematicPlanRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfSystematicPlanResponse:
    plan = await get_stp_plan(db, user_id=current_user.id, plan_id=plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="STP plan not found")
    try:
        plan = await confirm_systematic_plan(
            db,
            plan,
            otp=body.otp,
            ip=get_client_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
        await db.commit()
    except MfOrderError:
        await db.rollback()
        raise
    return await mf_h._systematic_plan_response(db, plan)


@router.post("/stp/plans/{plan_id}/cancel", response_model=MfSystematicPlanResponse)
async def cancel_mf_stp_plan_route(
    plan_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfSystematicPlanResponse:
    plan = await get_stp_plan(db, user_id=current_user.id, plan_id=plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="STP plan not found")
    try:
        plan = await cancel_systematic_plan(db, plan)
        await db.commit()
    except MfOrderError:
        await db.rollback()
        raise
    return await mf_h._systematic_plan_response(db, plan)


def _cas_import_response(import_row) -> MfCasImportResponse:
    metadata = import_row.metadata_ or {}
    launch_url = metadata.get("launch_url")
    return MfCasImportResponse(
        import_id=str(import_row.id),
        status=import_row.status.value,
        external_request_id=import_row.external_request_id,
        launch_url=str(launch_url) if launch_url else None,
        holdings_count=import_row.holdings_count,
        failure_reason=import_row.failure_reason,
        requested_at=import_row.requested_at,
        completed_at=import_row.completed_at,
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
        response = _cas_import_response(import_row)
        await db.commit()
    except MfCasError:
        await db.rollback()
        raise

    return response


@router.post("/cas/imports/{import_id}/qr", response_model=MfCasImportResponse)
async def submit_cas_qr(
    import_id: UUID,
    body: MfCasQrRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfCasImportResponse:
    settings = get_settings()
    if not settings.zynd_mf_cas_enabled:
        raise HTTPException(status_code=503, detail="External holdings import is not enabled")

    try:
        import_row = await validate_user_cas_qr(
            db,
            user_id=current_user.id,
            import_id=import_id,
            qr_code=body.qr_code,
        )
        response = _cas_import_response(import_row)
        await db.commit()
    except MfCasError:
        await db.rollback()
        raise

    return response


@router.get("/cas/imports", response_model=MfCasImportListResponse)
async def list_cas_imports(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfCasImportListResponse:
    imports = await list_user_cas_imports(db, user_id=current_user.id)
    return MfCasImportListResponse(imports=[_cas_import_response(row) for row in imports])



@router.post("/reports", response_model=InvestorReportResponse)
async def post_investor_report(
    body: CreateInvestorReportRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> InvestorReportResponse:
    try:
        payload = await generate_investor_report(
            db,
            user=current_user,
            kind=MfGeneratedReportKind(body.kind),
        )
        await db.commit()
    except InvestorReportError as exc:
        await db.rollback()
        raise mf_h._investor_report_error(exc) from exc
    except Exception:
        await db.rollback()
        raise
    return InvestorReportResponse(**payload)


@router.get("/reports", response_model=InvestorReportListResponse)
async def get_investor_reports(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> InvestorReportListResponse:
    payload = await list_investor_reports_page(db, user_id=current_user.id)
    return InvestorReportListResponse(
        reports=[InvestorReportResponse(**item) for item in payload["reports"]],
        eligibility=payload["eligibility"],
    )


@router.get("/reports/{report_id}/download")
async def get_investor_report_download(
    report_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Response:
    try:
        pdf_bytes, filename = await download_investor_report(
            db,
            user_id=current_user.id,
            report_id=report_id,
        )
    except InvestorReportError as exc:
        raise mf_h._investor_report_error(exc) from exc

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


