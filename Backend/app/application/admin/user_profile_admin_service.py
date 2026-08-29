from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.document_kyc_service import get_user_kyc_review
from app.application.admin.kyc_admin_detail_helpers import (
    KRA_SKIPPED_STEP_KEYS,
    apply_kra_skipped_step_statuses,
    build_compliance_issues,
    build_kyc_audit_log,
    derive_esign_step_status,
)
from app.application.investor.investor_bank_account_service import serialize_bank_account
from app.application.kyc.journey_state_service import journey_to_bootstrap_dict
from app.application.mf.mf_cart_service import get_cart_summary
from app.application.mf.portfolio_holdings_service import list_user_portfolio_holdings
from app.application.mf.mf_order_service import list_user_orders, load_order_fund_metadata, serialize_order
from app.application.mf.mf_sip_plan_service import list_user_sip_plans, serialize_sip_plan
from app.application.mf.mf_transaction_ops_service import list_orders_admin
from app.application.mf.public_asset_service import resolve_amc_logo_url
from app.core.config import get_settings
from app.infrastructure.persistence.investor_models import (
    InvestorAddress,
    InvestorBankAccount,
    InvestorProfile,
    InvestorRelatedParty,
)
from app.infrastructure.persistence.mf_models import FundAmc, MutualFund, Product
from app.infrastructure.persistence.models import KycJourneyState, User, UserKycStatus
from app.infrastructure.persistence.mf_transaction_models import MfInvestmentAccount, MfMandate

logger = logging.getLogger(__name__)

KYC_STEP_LABELS: dict[str, str] = {
    "pan": "PAN verification",
    "digilocker": "DigiLocker",
    "address": "Address",
    "personal": "Personal details",
    "nominee": "Nominee",
    "bank": "Bank account",
    "signature": "Signature",
    "review": "Review & submit",
}

INCOMPLETE_STEP_STATUSES = {"pending", "saved", "failed"}


def _mask_pan_last4(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.strip().upper()
    if len(normalized) < 4:
        return None
    return normalized[-4:]


def _mask_document_number(value: str | None) -> str | None:
    return _mask_pan_last4(value)


def _mask_account_last4(value: str | None) -> str | None:
    if not value:
        return None
    digits = "".join(char for char in value if char.isdigit())
    if len(digits) < 4:
        return None
    return digits[-4:]


def _serialize_address_lines(payload: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(payload, dict):
        return None
    return {
        "line1": payload.get("line1"),
        "line2": payload.get("line2"),
        "city": payload.get("city"),
        "state": payload.get("state"),
        "pincode": payload.get("pincode"),
        "country": payload.get("country"),
    }


def _serialize_contact_draft(contact_draft: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(contact_draft, dict):
        return None
    permanent = _serialize_address_lines(contact_draft.get("permanent"))
    correspondence = _serialize_address_lines(contact_draft.get("correspondence"))
    if not permanent and not correspondence:
        return None
    return {
        "permanent": permanent,
        "correspondence": correspondence,
        "same_as_permanent": bool(contact_draft.get("sameAsPermanent")),
    }


def _serialize_personal_draft(personal_draft: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(personal_draft, dict):
        return None
    return {
        "fathers_name": personal_draft.get("fathersName"),
        "gender": personal_draft.get("gender"),
        "income_slab": personal_draft.get("incomeSlab"),
        "occupation": personal_draft.get("occupation"),
        "marital_status": personal_draft.get("maritalStatus"),
        "pep_exposed": personal_draft.get("pepExposed"),
        "place_of_birth": personal_draft.get("placeOfBirth"),
        "nationality": personal_draft.get("nationality"),
    }


def _serialize_pan_draft(pan_draft: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(pan_draft, dict):
        return None
    full_name = pan_draft.get("fullName")
    if not full_name:
        parts = [pan_draft.get("firstName"), pan_draft.get("middleName"), pan_draft.get("lastName")]
        full_name = " ".join(part for part in parts if part)
    pan_number = pan_draft.get("panNumber")
    pan_last4 = pan_draft.get("panLast4") or _mask_pan_last4(pan_number if isinstance(pan_number, str) else None)
    return {
        "pan_last4": pan_last4,
        "full_name": full_name or None,
        "first_name": pan_draft.get("firstName"),
        "last_name": pan_draft.get("lastName"),
        "date_of_birth": pan_draft.get("dateOfBirth"),
        "pan_category": pan_draft.get("panCategory"),
    }


def _serialize_bank_draft(bank_draft: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(bank_draft, dict):
        return None
    account_number = bank_draft.get("accountNumber")
    account_last4 = bank_draft.get("accountNumberLast4") or _mask_account_last4(
        account_number if isinstance(account_number, str) else None
    )
    return {
        "account_number_last4": account_last4,
        "ifsc_code": bank_draft.get("ifscCode"),
        "account_type": bank_draft.get("accountType"),
        "account_holder_name": bank_draft.get("accountHolderName"),
        "bank_name": bank_draft.get("bankName"),
        "branch": bank_draft.get("branch"),
        "readiness_verified": bool(bank_draft.get("readinessVerified")),
    }


def _serialize_nominee_draft(nominee_draft: Any) -> list[dict[str, Any]]:
    if not isinstance(nominee_draft, list):
        return []
    nominees: list[dict[str, Any]] = []
    for entry in nominee_draft:
        if not isinstance(entry, dict):
            continue
        core = entry.get("core") if isinstance(entry.get("core"), dict) else {}
        identity = entry.get("identity") if isinstance(entry.get("identity"), dict) else {}
        document_number = identity.get("documentNumber")
        document_last4 = identity.get("documentNumberLast4") or _mask_document_number(
            document_number if isinstance(document_number, str) else None
        )
        nominees.append(
            {
                "full_name": core.get("fullName"),
                "relationship": core.get("relationship"),
                "share_percent": core.get("sharePercent"),
                "date_of_birth": core.get("dateOfBirth"),
                "document_type": identity.get("documentType"),
                "document_number_last4": document_last4,
            }
        )
    return nominees


def _serialize_signature_draft(signature_draft: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(signature_draft, dict):
        return None
    return {
        "mode": signature_draft.get("mode"),
        "has_upload": bool(signature_draft.get("documentId") or signature_draft.get("dataUrl")),
        "document_id": signature_draft.get("documentId"),
    }


def _serialize_investor_address(row: InvestorAddress) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "is_primary": row.is_primary,
        "nature": row.nature,
        "line1": row.line1,
        "line2": row.line2,
        "line3": row.line3,
        "city": row.city,
        "state": row.state,
        "postal_code": row.postal_code,
        "country": row.country,
        "sync_status": row.sync_status.value,
    }


def _serialize_investor_nominee(row: InvestorRelatedParty) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "name": row.name,
        "relationship": row.party_relationship,
        "date_of_birth": row.date_of_birth.isoformat() if row.date_of_birth else None,
        "pan_last4": _mask_pan_last4(row.pan),
        "guardian_name": row.guardian_name,
        "guardian_pan_last4": _mask_pan_last4(row.guardian_pan),
        "share_percent": row.share_percent,
        "sync_status": row.sync_status.value,
    }


def _incomplete_steps(
    step_statuses: dict[str, str] | None,
    overall_status: str | None,
    *,
    kyc_already_registered: bool = False,
) -> list[dict[str, str]]:
    if overall_status in {"completed", "submitted"}:
        return []
    if not step_statuses:
        return [
            {"key": key, "label": label}
            for key, label in KYC_STEP_LABELS.items()
            if not (kyc_already_registered and key in KRA_SKIPPED_STEP_KEYS)
        ]
    incomplete: list[dict[str, str]] = []
    for key, label in KYC_STEP_LABELS.items():
        if kyc_already_registered and key in KRA_SKIPPED_STEP_KEYS:
            continue
        status = step_statuses.get(key, "pending")
        if status in INCOMPLETE_STEP_STATUSES:
            incomplete.append({"key": key, "label": label, "status": status})
    return incomplete


async def _build_kyc_detail(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    journey = await db.get(KycJourneyState, user_id)
    status = await db.get(UserKycStatus, user_id)

    bootstrap = journey_to_bootstrap_dict(journey, status)
    step_statuses = bootstrap.get("stepStatuses") if isinstance(bootstrap.get("stepStatuses"), dict) else {}
    step_statuses = dict(step_statuses)
    step_statuses["esign"] = derive_esign_step_status(journey, status)
    kyc_already_registered = bool(bootstrap.get("kycAlreadyRegistered"))
    step_statuses = apply_kra_skipped_step_statuses(
        step_statuses,
        kyc_already_registered=kyc_already_registered,
    )
    overall_status = step_statuses.get("overall", "none")

    kyc_review = await get_user_kyc_review(db, user_id=user_id)
    signature_document_id = next(
        (
            str(document["id"])
            for document in kyc_review["documents"]
            if document["doc_type"] == "signature"
        ),
        None,
    )

    profile = await db.get(InvestorProfile, user_id)
    mf_account = await db.scalar(
        select(MfInvestmentAccount).where(MfInvestmentAccount.user_id == user_id)
    )
    investor_banks: list[dict[str, Any]] = []
    investor_addresses: list[dict[str, Any]] = []
    investor_nominees: list[dict[str, Any]] = []
    investor_profile_status: str | None = None
    investor_profile_id: str | None = None
    mf_investment_profile_id: str | None = None
    mf_investment_profile_status: str | None = None

    if profile:
        investor_profile_status = profile.status.value
        investor_profile_id = profile.external_profile_id
        bank_rows = (
            await db.scalars(
                select(InvestorBankAccount)
                .where(InvestorBankAccount.investor_profile_id == user_id)
                .order_by(InvestorBankAccount.is_primary.desc(), InvestorBankAccount.created_at.asc())
            )
        ).all()
        investor_banks = [serialize_bank_account(row) for row in bank_rows]

        address_rows = (
            await db.scalars(
                select(InvestorAddress)
                .where(InvestorAddress.investor_profile_id == user_id)
                .order_by(InvestorAddress.is_primary.desc(), InvestorAddress.created_at.asc())
            )
        ).all()
        investor_addresses = [_serialize_investor_address(row) for row in address_rows]

        nominee_rows = (
            await db.scalars(
                select(InvestorRelatedParty)
                .where(InvestorRelatedParty.investor_profile_id == user_id)
                .order_by(InvestorRelatedParty.created_at.asc())
            )
        ).all()
        investor_nominees = [_serialize_investor_nominee(row) for row in nominee_rows]

    if mf_account:
        mf_investment_profile_id = mf_account.fp_mfia_id
        mf_investment_profile_status = mf_account.status.value

    pan_info = _serialize_pan_draft(bootstrap.get("panDraft"))
    bank_draft = _serialize_bank_draft(bootstrap.get("bankDraft"))
    contact_draft = _serialize_contact_draft(bootstrap.get("contactDraft"))
    personal_draft = _serialize_personal_draft(bootstrap.get("personalDraft"))
    nominee_draft = _serialize_nominee_draft(bootstrap.get("nomineeDraft"))
    signature_draft = _serialize_signature_draft(bootstrap.get("signatureDraft"))

    documents = kyc_review["documents"]

    return {
        "overall_status": overall_status,
        "last_completed_step": bootstrap.get("lastCompletedStep"),
        "active_step_index": bootstrap.get("activeStepIndex"),
        "step_statuses": step_statuses,
        "incomplete_steps": _incomplete_steps(
            step_statuses,
            overall_status,
            kyc_already_registered=kyc_already_registered,
        ),
        "kyc_already_registered": kyc_already_registered,
        "readiness_code": bootstrap.get("readinessCode"),
        "readiness_reason": bootstrap.get("readinessReason"),
        "kyc_initiated_at": journey.created_at.isoformat() if journey and journey.created_at else None,
        "esign_details_status": bootstrap.get("esignDetailsStatus"),
        "proof_details_status": bootstrap.get("proofDetailsStatus"),
        "compliance_issues": build_compliance_issues(journey, step_statuses),
        "audit_log": build_kyc_audit_log(
            journey=journey,
            status=status,
            step_statuses=step_statuses,
            documents=documents,
        ),
        "pan": pan_info,
        "address": contact_draft,
        "investor_addresses": investor_addresses,
        "personal": personal_draft,
        "bank_draft": bank_draft,
        "bank_accounts": investor_banks,
        "nominees": investor_nominees or nominee_draft,
        "signature": signature_draft,
        "signature_document_id": signature_document_id,
        "pan_verification_status": bootstrap.get("panVerificationStatus"),
        "bank_verification_status": bootstrap.get("bankVerificationStatus"),
        "external_kyc_status": bootstrap.get("externalKycStatus"),
        "kyc_form_status": bootstrap.get("kycFormStatus"),
        "investor_profile_status": investor_profile_status,
        "investor_profile_id": investor_profile_id,
        "mf_investment_profile_id": mf_investment_profile_id,
        "mf_investment_profile_status": mf_investment_profile_status,
        "documents": documents,
    }


async def _load_fund_amc_metadata(
    db: AsyncSession,
    fund_ids: set[int],
) -> tuple[dict[int, str], dict[int, str | None]]:
    if not fund_ids:
        return {}, {}

    settings = get_settings()
    result = await db.execute(
        select(MutualFund.id, FundAmc.name, FundAmc.logo_url, FundAmc.slug)
        .join(FundAmc, MutualFund.amc_id == FundAmc.id)
        .where(MutualFund.id.in_(fund_ids))
    )
    amc_names: dict[int, str] = {}
    amc_logos: dict[int, str | None] = {}
    for fund_id, name, logo_url, slug in result:
        amc_names[fund_id] = name
        amc_logos[fund_id] = resolve_amc_logo_url(logo_url, slug, settings)
    return amc_names, amc_logos


def _serialize_admin_portfolio_holding(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "holding_id": row.get("id"),
        "isin": row.get("isin"),
        "scheme_name": row.get("fund_name"),
        "matched_scheme_name": row.get("fund_name"),
        "folio_number": row.get("folio_number"),
        "units": row.get("units"),
        "redeemable_units": row.get("redeemable_units"),
        "nav_value": row.get("nav"),
        "market_value_inr": row.get("current_value_inr"),
        "redeemable_amount_inr": row.get("redeemable_amount_inr"),
        "invested_inr": row.get("invested_inr"),
        "return_inr": row.get("return_inr"),
        "return_pct": row.get("return_pct"),
        "allocation_pct": row.get("allocation_pct"),
        "as_of_date": row.get("nav_as_on"),
        "amc_name": row.get("amc_name"),
        "amc_logo_url": row.get("amc_logo_url"),
        "source": row.get("source") or "zynd",
    }


async def _list_admin_user_holdings(db: AsyncSession, user_id: UUID) -> list[dict[str, Any]]:
    try:
        payload = await list_user_portfolio_holdings(db, user_id=user_id)
    except Exception:
        logger.exception("Failed to load portfolio holdings for admin user %s", user_id)
        return []

    holdings: list[dict[str, Any]] = []
    for row in payload.get("holdings") or []:
        if not isinstance(row, dict):
            continue
        if str(row.get("source") or "").lower() == "external":
            continue
        holdings.append(_serialize_admin_portfolio_holding(row))
    return holdings


async def _build_investments_detail(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    orders = await list_orders_admin(db, user_id=user_id, limit=50)
    cart = await get_cart_summary(db, user_id=user_id)
    holdings = await _list_admin_user_holdings(db, user_id=user_id)

    plans = await list_user_sip_plans(db, user_id=user_id, limit=50)
    product_ids = {plan.product_id for plan in plans}
    products = {
        row.id: row.name
        for row in (await db.execute(select(Product).where(Product.id.in_(product_ids)))).scalars()
    } if product_ids else {}

    sip_plans: list[dict[str, Any]] = []
    sip_fund_ids = {plan.fund_id for plan in plans}
    sip_amc_names, sip_amc_logos = await _load_fund_amc_metadata(db, sip_fund_ids)
    for plan in plans:
        mandate = await db.get(MfMandate, plan.mf_mandate_id) if plan.mf_mandate_id else None
        sip_plans.append(
            serialize_sip_plan(
                plan,
                product_name=products.get(plan.product_id),
                mandate=mandate,
                amc_name=sip_amc_names.get(plan.fund_id),
                amc_logo_url=sip_amc_logos.get(plan.fund_id),
            )
        )

    succeeded_orders_raw = await list_user_orders(db, user_id=user_id, limit=100)
    purchase_amc_names, purchase_amc_logos, purchase_amc_slugs = await load_order_fund_metadata(db, succeeded_orders_raw)
    succeeded_product_ids = {order.product_id for order in succeeded_orders_raw if order.status.value == "SUCCEEDED"}
    succeeded_products = {
        row.id: row.name
        for row in (
            await db.execute(select(Product).where(Product.id.in_(succeeded_product_ids)))
        ).scalars()
    } if succeeded_product_ids else {}
    succeeded_orders = [
        serialize_order(
            order,
            product_name=succeeded_products.get(order.product_id),
            amc_name=purchase_amc_names.get(order.fund_id),
            amc_logo_url=purchase_amc_logos.get(order.fund_id),
        )
        for order in succeeded_orders_raw
        if order.status.value == "SUCCEEDED"
    ]

    return {
        "orders": orders,
        "purchases": succeeded_orders,
        "cart": cart,
        "holdings": holdings,
        "sip_plans": sip_plans,
    }


async def get_user_profile_detail(
    db: AsyncSession,
    user_id: UUID,
    *,
    include_kyc: bool = False,
    include_investments: bool = False,
) -> dict[str, Any] | None:
    user = await db.get(User, user_id)
    if not user:
        return None

    payload: dict[str, Any] = {
        "user_id": user.id,
        "email": user.email,
        "kyc": None,
        "investments": None,
    }

    if include_kyc:
        payload["kyc"] = await _build_kyc_detail(db, user_id)

    if include_investments:
        payload["investments"] = await _build_investments_detail(db, user_id)

    return payload
