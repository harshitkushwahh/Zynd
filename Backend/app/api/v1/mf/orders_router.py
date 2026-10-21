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
            family_group_id=body.family_group_id,
            payment_method=body.payment_method,
            folio_number=body.folio_number,
        )
        product = await db.get(Product, order.product_id)
        product_name = product.name if product else None
        await db.commit()
    except MfOrderError:
        await db.rollback()
        raise

    return await mf_h._order_response(
        db,
        order,
        product_name=product_name,
        include_transaction_consent=True,
    )


@router.get("/orders/{order_id}/consent", response_model=MfPurchaseConsentResponse)
async def get_mf_purchase_consent_route(
    order_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfPurchaseConsentResponse:
    payload = await get_purchase_consent_context(db, user_id=current_user.id, order_id=order_id)
    return MfPurchaseConsentResponse(**payload)


@router.post("/orders/{order_id}/consent/send-otp", response_model=MfPurchaseOtpSendResponse)
async def send_mf_purchase_consent_otp_route(
    order_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfPurchaseOtpSendResponse:
    try:
        payload = await send_purchase_consent_otp(
            db,
            user_id=current_user.id,
            order_id=order_id,
            ip=get_client_ip(request),
        )
        await db.commit()
    except MfOrderError:
        await db.rollback()
        raise
    return MfPurchaseOtpSendResponse(**payload)


@router.post("/orders/{order_id}/consent/confirm", response_model=MfOrderResponse)
async def confirm_mf_purchase_consent_route(
    order_id: UUID,
    body: ConfirmMfPurchaseConsentRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_invest_eligible_user)],
) -> MfOrderResponse:
    try:
        order = await confirm_purchase_consent_and_advance(
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
    return await mf_h._order_response_with_product(db, order)


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
            number_of_installments=body.number_of_installments,
        )
        payload = await get_cart_summary(db, user_id=current_user.id)
        await db.commit()
    except MfOrderError:
        await db.rollback()
        raise

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
    except MfOrderError:
        await db.rollback()
        raise

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
    except MfOrderError:
        await db.rollback()
        raise

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
    except MfOrderError:
        await db.rollback()
        raise

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
            family_group_id=body.family_group_id,
            payment_method=body.payment_method,
        )
        product_ids = {order.product_id for order in orders}
        products = {
            row.id: row.name
            for row in (
                await db.execute(select(Product).where(Product.id.in_(product_ids)))
            ).scalars()
        } if product_ids else {}
        await db.commit()
    except MfOrderError:
        await db.rollback()
        raise

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
            family_group_id=body.family_group_id,
            mandate_type=body.mandate_type,
        )
        product_ids = {plan.product_id for plan in plans}
        products = {
            row.id: row.name
            for row in (
                await db.execute(select(Product).where(Product.id.in_(product_ids)))
            ).scalars()
        } if product_ids else {}
        await db.commit()
    except MfOrderError:
        await db.rollback()
        raise

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


@router.get("/orders", response_model=MfOrderListResponse)
async def list_mf_orders(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(default=50, ge=1, le=100),
) -> MfOrderListResponse:
    from app.application.mf.mf_sip_installment_order_service import sync_user_sip_installment_orders

    synced = await sync_user_sip_installment_orders(db, user_id=current_user.id)
    orders = await list_user_orders(db, user_id=current_user.id, limit=limit)
    redemption_synced = False
    for order in orders:
        if order.order_type == MfOrderType.redemption and order.status not in TERMINAL_STATUSES:
            await sync_redemption_order_from_fp(db, order)
            redemption_synced = True
    if synced or redemption_synced:
        await db.commit()
        orders = await list_user_orders(db, user_id=current_user.id, limit=limit)
    product_ids = {order.product_id for order in orders}
    products = {
        row.id: row.name
        for row in (
            await db.execute(select(Product).where(Product.id.in_(product_ids)))
        ).scalars()
    } if product_ids else {}
    amc_names, amc_logos, amc_slugs = await load_order_fund_metadata(db, orders)
    product_slugs = await load_order_product_slugs(db, orders, product_names=products)
    from app.application.mf.mf_switch_service import load_switch_order_leg_names

    switch_out_names = {order.id: products.get(order.product_id) for order in orders}
    switch_leg_names = await load_switch_order_leg_names(db, orders, switch_out_product_names=switch_out_names)
    responses: list[MfOrderResponse] = []
    for order in orders:
        _resolved_out, switch_in_name = switch_leg_names.get(order.id, (products.get(order.product_id), None))
        responses.append(
            await mf_h._order_response(
                db,
                order,
                product_name=products.get(order.product_id),
                amc_name=amc_names.get(order.fund_id),
                amc_logo_url=amc_logos.get(order.fund_id),
                amc_slug=amc_slugs.get(order.fund_id),
                product_slug=product_slugs.get(order.product_id),
                switch_in_product_name=switch_in_name,
            )
        )
    return MfOrderListResponse(orders=responses)


@router.get("/orders/{order_id}/journey", response_model=MfOrderJourneyResponse)
async def get_mf_order_journey(
    order_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MfOrderJourneyResponse:
    order = await get_user_order(db, user_id=current_user.id, order_id=order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if await advance_order_for_payment(db, order, user_ip=get_client_ip(request)):
        await db.commit()
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
    return await mf_h._order_response_with_product(db, order)


