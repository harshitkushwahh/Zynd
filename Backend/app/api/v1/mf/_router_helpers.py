"""Shared helpers for MF invest API routers."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.mf.schemas import (
    InvestorBankAccountFailure,
    InvestorBankAccountResponse,
    MfOrderResponse,
    MfRedemptionOrderResponse,
    MfSipFirstInstallmentSummary,
    MfSipPlanBankSwitchSummary,
    MfSipPlanResponse,
    MfSwitchOrderResponse,
    MfSystematicPlanResponse,
)
from app.application.mf.invest_fund_slug import resolve_invest_fund_product_id
from app.application.mf.mf_order_service import (
    load_order_fund_metadata,
    load_order_product_slugs,
    serialize_order,
)
from app.application.mf.mf_purchase_consent_service import snapshot_purchase_consent_for_order
from app.application.mf.mf_redemption_service import serialize_redemption_order
from app.application.mf.mf_switch_service import serialize_switch_order
from app.application.mf.mf_systematic_plan_service import (
    product_name as systematic_product_name,
    serialize_systematic_plan,
)
from app.application.mf.mf_sip_plan_service import load_sip_plan_fund_metadata, serialize_sip_plan
from app.application.risk_profile.errors import RiskProfileError
from app.application.distributor.mitra_txn_recommendation_service import MitraTxnRecommendationError
from app.application.mf.investor_report_service import InvestorReportError
from app.infrastructure.persistence.mf_models import Product
from app.infrastructure.persistence.mf_transaction_models import MfCheckout

async def _resolve_fund_product_id(db: AsyncSession, fund_ref: str) -> UUID:
    product_id = await resolve_invest_fund_product_id(db, fund_ref)
    if not product_id:
        raise HTTPException(status_code=404, detail="Fund not found in catalog")
    return product_id


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
        is_payment_ready=bool(payload.get("is_payment_ready")),
        active_sip_count=int(payload.get("active_sip_count") or 0),
        blocks_removal=bool(payload.get("blocks_removal")),
        blocks_primary_switch=bool(payload.get("blocks_primary_switch")),
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
    amc_slug: str | None = None,
    product_slug: str | None = None,
    switch_in_product_name: str | None = None,
    include_transaction_consent: bool = False,
) -> MfOrderResponse:
    if amc_name is None and amc_logo_url is None and amc_slug is None:
        amc_names, amc_logos, amc_slugs = await load_order_fund_metadata(db, [order])
        amc_name = amc_names.get(order.fund_id)
        amc_logo_url = amc_logos.get(order.fund_id)
        amc_slug = amc_slugs.get(order.fund_id)
    if product_slug is None:
        product_slugs = await load_order_product_slugs(
            db,
            [order],
            product_names={order.product_id: product_name} if product_name else None,
        )
        product_slug = product_slugs.get(order.product_id)
    checkout = await db.get(MfCheckout, order.checkout_id) if order.checkout_id else None
    payload = serialize_order(
        order,
        product_name=product_name,
        checkout=checkout,
        amc_name=amc_name,
        amc_logo_url=amc_logo_url,
        amc_slug=amc_slug,
        product_slug=product_slug,
        switch_in_product_name=switch_in_product_name,
    )
    transaction_consent = None
    if include_transaction_consent:
        from app.application.mf.mf_purchase_consent_gates import (
            lumpsum_has_platform_consent,
            lumpsum_order_needs_platform_consent,
        )

        if lumpsum_order_needs_platform_consent(order) and not lumpsum_has_platform_consent(order):
            transaction_consent = await snapshot_purchase_consent_for_order(
                db,
                user_id=order.user_id,
                order_id=order.id,
            )
    return MfOrderResponse(**payload, transaction_consent=transaction_consent)


def _payment_status_message(outcome: str) -> str | None:
    if outcome == "success":
        return "Payment confirmed."
    if outcome == "failed":
        return "Payment was not completed."
    if outcome == "unclear":
        return "Payment confirmation is taking longer than expected. We will keep checking."
    return "Payment is being confirmed."


async def _sip_plan_response(
    db: AsyncSession,
    plan,
    *,
    product_name: str | None,
    amc_name: str | None = None,
    amc_logo_url: str | None = None,
    isin: str | None = None,
    user_id=None,
) -> MfSipPlanResponse:
    from app.application.investor.investor_bank_account_resolver import load_mandate_bank_account
    from app.application.mf.mf_sip_first_installment_service import resolve_sip_first_installment
    from app.application.mf.mf_sip_plan_service import sync_sip_plan_after_mandate_auth
    from app.application.mf.mf_sip_plan_mandate_switch_service import (
        build_bank_switch_response,
        resolve_switch_target_mandate,
    )
    from app.infrastructure.persistence.mf_transaction_models import MfMandate

    mandate_row = await db.get(MfMandate, plan.mf_mandate_id) if plan.mf_mandate_id else None
    await sync_sip_plan_after_mandate_auth(db, plan, mandate=mandate_row)
    first_installment = await resolve_sip_first_installment(db, plan, mandate=mandate_row)
    switch_target_mandate = await resolve_switch_target_mandate(db, plan)
    bank_switch = await build_bank_switch_response(db, plan, mandate=mandate_row)
    mandate_bank_account = None
    if mandate_row is not None and user_id is not None:
        mandate_bank_account = await load_mandate_bank_account(
            db,
            user_id=user_id,
            mandate=mandate_row,
        )
    if amc_name is None and amc_logo_url is None and isin is None:
        amc_names, amc_logos, isins = await load_sip_plan_fund_metadata(db, [plan])
        amc_name = amc_names.get(plan.fund_id)
        amc_logo_url = amc_logos.get(plan.fund_id)
        isin = isins.get(plan.fund_id)
    payload = serialize_sip_plan(
        plan,
        product_name=product_name,
        mandate=mandate_row,
        mandate_bank_account=mandate_bank_account,
        switch_target_mandate=switch_target_mandate,
        bank_switch=bank_switch,
        amc_name=amc_name,
        amc_logo_url=amc_logo_url,
        isin=isin,
        first_installment=first_installment,
    )
    bank_switch = payload.get("bank_switch")
    if isinstance(bank_switch, dict):
        payload["bank_switch"] = MfSipPlanBankSwitchSummary(**bank_switch)
    first_installment_payload = payload.get("first_installment")
    if isinstance(first_installment_payload, dict):
        payload["first_installment"] = MfSipFirstInstallmentSummary(**first_installment_payload)
    return MfSipPlanResponse(**payload)

async def _redemption_order_response(db: AsyncSession, order) -> MfRedemptionOrderResponse:
    product = await db.get(Product, order.product_id)
    return MfRedemptionOrderResponse(**serialize_redemption_order(order, product_name=product.name if product else None))

async def _switch_order_response(db: AsyncSession, order) -> MfSwitchOrderResponse:
    product = await db.get(Product, order.product_id)
    return MfSwitchOrderResponse(**serialize_switch_order(order, product_name=product.name if product else None))

async def _systematic_plan_response(db: AsyncSession, plan) -> MfSystematicPlanResponse:
    name = await systematic_product_name(db, plan.product_id)
    switch_in_name = None
    if getattr(plan, "switch_in_product_id", None):
        switch_in_name = await systematic_product_name(db, plan.switch_in_product_id)
    return MfSystematicPlanResponse(**serialize_systematic_plan(plan, product_name=name, switch_in_name=switch_in_name))

def _investor_report_error(exc: InvestorReportError) -> HTTPException:
    return HTTPException(
        status_code=exc.status_code,
        detail={"code": exc.code, "message": exc.message},
    )

async def _order_response_with_product(db: AsyncSession, order) -> MfOrderResponse:
    product = await db.get(Product, order.product_id)
    product_name = product.name if product else None
    from app.application.mf.mf_switch_service import load_switch_order_leg_names

    switch_leg_names = await load_switch_order_leg_names(
        db,
        [order],
        switch_out_product_names={order.id: product_name},
    )
    _resolved_out, switch_in_name = switch_leg_names.get(order.id, (product_name, None))
    return await _order_response(
        db,
        order,
        product_name=product_name,
        switch_in_product_name=switch_in_name,
    )

def _handle_risk_profile_error(exc: RiskProfileError) -> HTTPException:
    return HTTPException(
        status_code=exc.status_code,
        detail={"code": exc.code, "message": exc.message},
    )

def _invest_mitra_txn_recommendation_http_error(exc: MitraTxnRecommendationError) -> HTTPException:
    return HTTPException(
        status_code=exc.status_code,
        detail={"code": exc.code, "message": exc.message},
    )

