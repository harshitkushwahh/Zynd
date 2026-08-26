from __future__ import annotations

"""SIP plan orchestration (mandate-first activation).

Zynd activates SIPs after UPI mandate authorization and FP plan confirmation.
The first installment is debited via autopay (``generate_first_installment_now``),
not a separate payment-gateway checkout. We intentionally do not mirror MultiPlus's
``activation_status`` / first-installment PG layer unless product requires it.
"""

import logging
import re
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.goals.errors import GoalError
from app.application.goals.goal_funding_service import apply_family_goal_metadata, validate_family_goal_link
from app.application.investor.investor_profile_service import ensure_pending_investor_profile_for_payment
from app.application.mf.mf_fp_state import FP_PLAN_CANCELLED_STATES, FP_PLAN_FAILURE_STATES, map_fp_plan_state
from app.application.mf.mf_folio_defaults_service import ensure_mfia_folio_defaults
from app.application.mf.mf_mandate_service import (
    create_mandate_for_user,
    maybe_release_mandate_after_sip_change,
    serialize_mandate,
)
from app.application.mf.mf_order_errors import MfOrderError
from app.application.mf.mf_order_service import _load_order_context, get_or_create_mf_investment_account
from app.application.mf.mf_transaction_retry import bump_transient_retry, is_transient_error, should_skip_retry
from app.application.mf.public_asset_service import resolve_amc_logo_url
from app.core.config import get_settings
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.mf.fp_oms_client import (
    _extract_fp_object,
    cancel_mf_purchase_plan,
    create_mf_investment_account,
    create_mf_purchase_plan,
    extract_fp_state,
    get_mf_purchase_plan,
    resolve_fp_user_ip,
    update_mf_purchase_plan,
)
from app.infrastructure.persistence.investor_models import (
    InvestorProfile,
    InvestorProfileStatus,
    InvestorProvisionTrigger,
)
from app.infrastructure.persistence.mf_models import FundAmc, MutualFund
from app.infrastructure.persistence.mf_transaction_models import (
    MfInvestmentAccountStatus,
    MfMandate,
    MfMandateStatus,
    MfSipPlan,
    MfSipPlanEvent,
    MfSipPlanStatus,
)
from app.infrastructure.persistence.models import User

logger = logging.getLogger(__name__)

SIP_TERMINAL_STATUSES = {
    MfSipPlanStatus.active,
    MfSipPlanStatus.failed,
    MfSipPlanStatus.cancelled,
}

SIP_NON_OPERATIONAL_FP_STATES = frozenset(
    state.lower() for state in (*FP_PLAN_CANCELLED_STATES, *FP_PLAN_FAILURE_STATES)
)


def sip_plan_is_operational(plan: MfSipPlan) -> bool:
    """True when a SIP should count toward debits, stats, and upcoming installments."""
    if plan.status != MfSipPlanStatus.active:
        return False
    if plan.cancelled_at is not None:
        return False
    fp_state = (plan.fp_state or "").strip().lower()
    if fp_state in SIP_NON_OPERATIONAL_FP_STATES:
        return False
    meta = plan.metadata_ if isinstance(plan.metadata_, dict) else {}
    sip = meta.get("sip") if isinstance(meta.get("sip"), dict) else {}
    if sip.get("user_cancelled"):
        return False
    return True


def operational_sip_plan_filters():
    """SQLAlchemy filters for investor-facing active SIP queries."""
    return (
        MfSipPlan.status == MfSipPlanStatus.active,
        MfSipPlan.cancelled_at.is_(None),
        or_(
            MfSipPlan.fp_state.is_(None),
            func.lower(MfSipPlan.fp_state).not_in(list(SIP_NON_OPERATIONAL_FP_STATES)),
        ),
    )

ONDEC_SUPPORTED_FREQUENCIES = frozenset({"monthly", "daily"})

RECOVERABLE_SUBMIT_FAILURE_CODES = frozenset(
    {
        "fp_plan_submit_failed",
        "scheme_not_available",
        "fp_client_error",
    }
)


from app.application.mf.investment_constraints import fund_allows_sip
from app.application.mf.mf_scheme_resolution import (
    is_scheme_unavailable_for_transaction,
    resolve_mf_purchase_scheme,
)


def _validate_fund_sip_eligible(fund: MutualFund) -> None:
    settings = get_settings()
    if not fund_allows_sip(fund, payment_gateway=settings.zynd_mf_order_payment_gateway):
        raise MfOrderError(
            code="sip_not_allowed",
            message="This fund is not available for SIP on the payment network yet. Try a one-time investment or choose another fund.",
        )


def _format_fp_plan_submit_error(exc: Exception) -> tuple[str, str]:
    message = str(exc).strip()
    lowered = message.lower()
    if "user_ip" in lowered and "invalid ip" in lowered:
        return (
            "fp_plan_submit_failed",
            "We couldn't submit this SIP because of a network address issue. Please try again.",
        )
    if "scheme" in lowered and "not available" in lowered:
        return (
            "scheme_not_available",
            "This fund is not available for SIP on the payment network yet. Try a one-time investment or another fund.",
        )
    if "scheme" in lowered:
        return (
            "scheme_not_available",
            "This fund is not available for SIP on the payment network yet. Try a one-time investment or another fund.",
        )
    return ("fp_plan_submit_failed", message or "SIP setup failed. Please try again.")


def _derive_sip_next_action(*, status: str, mandate: MfMandate | None) -> str:
    if status == "ACTIVE":
        return "complete"
    if status in {"FAILED", "CANCELLED"}:
        return "failed"
    if mandate and mandate.status != MfMandateStatus.approved:
        if mandate.auth_token_url:
            return "authorize_mandate"
        return "wait_mandate"
    if status in {"REVIEW", "CONSENT_PENDING"}:
        return "wait_review"
    return "wait_processing"


async def load_sip_plan_fund_metadata(
    session: AsyncSession,
    plans: list[MfSipPlan],
) -> tuple[dict[int, str], dict[int, str | None], dict[int, str]]:
    fund_ids = {plan.fund_id for plan in plans}
    if not fund_ids:
        return {}, {}, {}

    settings = get_settings()
    result = await session.execute(
        select(MutualFund.id, MutualFund.isin_growth, FundAmc.name, FundAmc.logo_url, FundAmc.slug)
        .join(FundAmc, MutualFund.amc_id == FundAmc.id)
        .where(MutualFund.id.in_(fund_ids))
    )
    amc_names: dict[int, str] = {}
    amc_logos: dict[int, str | None] = {}
    isins: dict[int, str] = {}
    for fund_id, isin, name, logo_url, slug in result:
        amc_names[fund_id] = name
        amc_logos[fund_id] = resolve_amc_logo_url(logo_url, slug, settings)
        isins[fund_id] = isin
    return amc_names, amc_logos, isins


def serialize_sip_plan(
    plan: MfSipPlan,
    *,
    product_name: str | None = None,
    mandate: MfMandate | None = None,
    mandate_bank_account=None,
    switch_target_mandate: MfMandate | None = None,
    bank_switch: dict[str, Any] | None = None,
    amc_name: str | None = None,
    amc_logo_url: str | None = None,
    isin: str | None = None,
    first_installment: dict[str, Any] | None = None,
) -> dict:
    from app.application.mf.mf_sip_plan_mandate_switch_service import (
        build_bank_switch_summary_sync,
        derive_sip_next_action_from_plan,
    )

    mandate_payload = (
        serialize_mandate(mandate, bank_account=mandate_bank_account) if mandate else None
    )
    bank_switch_payload = bank_switch or build_bank_switch_summary_sync(plan)
    next_action = derive_sip_next_action_from_plan(
        plan=plan,
        mandate=mandate,
        switch_target_mandate=switch_target_mandate,
        first_installment=first_installment,
    )
    mandate_auth_url = None
    if next_action == "authorize_mandate_switch" and switch_target_mandate:
        mandate_auth_url = switch_target_mandate.auth_token_url
    elif mandate:
        mandate_auth_url = mandate.auth_token_url

    return {
        "plan_id": str(plan.id),
        "product_id": str(plan.product_id),
        "product_name": product_name,
        "amc_name": amc_name,
        "amc_logo_url": amc_logo_url,
        "isin": isin,
        "amount_inr": float(plan.amount_inr),
        "frequency": plan.frequency,
        "installment_day": plan.installment_day,
        "number_of_installments": plan.number_of_installments,
        "status": plan.status.value,
        "fp_plan_id": plan.fp_plan_id,
        "fp_state": plan.fp_state,
        "next_installment_date": plan.next_installment_date.isoformat() if plan.next_installment_date else None,
        "mandate": mandate_payload,
        "mandate_auth_url": mandate_auth_url,
        "next_action": next_action,
        "bank_switch": bank_switch_payload,
        "first_installment": first_installment,
        "payment_url": (
            first_installment.get("payment_url")
            if isinstance(first_installment, dict) and first_installment.get("status") == "pending"
            else None
        ),
        "failure_code": plan.failure_code,
        "failure_reason": plan.failure_reason,
        "created_at": plan.created_at.isoformat() if plan.created_at else None,
        "activated_at": plan.activated_at.isoformat() if plan.activated_at else None,
    }


async def _record_plan_event(
    session: AsyncSession,
    plan: MfSipPlan,
    *,
    from_status: str | None,
    to_status: str,
    source: str = "SYSTEM",
    payload: dict | None = None,
) -> None:
    session.add(
        MfSipPlanEvent(
            plan_id=plan.id,
            from_status=from_status,
            to_status=to_status,
            source=source,
            payload=payload,
        )
    )


def _validate_sip_frequency(frequency: str) -> str:
    normalized = frequency.strip().lower()
    if normalized not in ONDEC_SUPPORTED_FREQUENCIES:
        raise MfOrderError(
            code="invalid_frequency",
            message="Only monthly and daily SIP frequencies are supported on ONDC",
        )
    return normalized


def _validate_installment_day(*, frequency: str, installment_day: int | None) -> int | None:
    if frequency == "daily":
        return None
    if installment_day is None:
        raise MfOrderError(code="installment_day_required", message="Installment day is required for monthly SIP")
    if installment_day < 1 or installment_day > 28:
        raise MfOrderError(code="invalid_installment_day", message="Installment day must be between 1 and 28")
    return installment_day


def default_installments(frequency: str) -> int:
    settings = get_settings()
    if frequency == "daily":
        return settings.zynd_mf_sip_default_daily_installments
    return settings.zynd_mf_sip_default_monthly_installments


def _validate_number_of_installments(number_of_installments: int | None) -> int:
    settings = get_settings()
    max_installments = settings.zynd_mf_sip_max_installments
    if number_of_installments is None:
        raise MfOrderError(
            code="number_of_installments_required",
            message="Number of installments is required for SIP",
        )
    if number_of_installments < 1 or number_of_installments > max_installments:
        raise MfOrderError(
            code="invalid_number_of_installments",
            message=f"Number of installments must be between 1 and {max_installments}",
        )
    return number_of_installments


def _normalize_mobile(phone: str | None) -> str | None:
    if not phone:
        return None
    raw = phone.strip()
    if raw.startswith("+91"):
        raw = raw[3:]
    raw = re.sub(r"\D", "", raw.lstrip("+"))
    return raw or None


async def _load_consent_contact(session: AsyncSession, *, user_id: uuid.UUID) -> tuple[str, str] | None:
    user = await session.get(User, user_id)
    if not user or not user.email:
        return None
    mobile = _normalize_mobile(user.phone)
    if not mobile:
        return None
    return user.email.lower(), mobile


async def _ensure_fp_mfia(session: AsyncSession, *, user_id: uuid.UUID, mfia) -> str | None:
    if mfia.fp_mfia_id and mfia.status == MfInvestmentAccountStatus.active:
        folio_ready = await ensure_mfia_folio_defaults(session, user_id=user_id, mfia=mfia)
        return mfia.fp_mfia_id if folio_ready else None

    profile = await session.get(InvestorProfile, user_id)
    if not profile or profile.status != InvestorProfileStatus.active or not profile.external_profile_id:
        return None

    settings = get_settings()
    if not settings.resolved_fp_enabled:
        return "stub-mfia-id"

    result = await create_mf_investment_account(investor_profile_id=profile.external_profile_id)
    fp_mfia_id = result.get("fp_mfia_id")
    if not fp_mfia_id:
        return None

    mfia.fp_mfia_id = fp_mfia_id
    mfia.fp_mfia_old_id = result.get("fp_mfia_old_id")
    mfia.status = MfInvestmentAccountStatus.active
    await session.flush()
    if not await ensure_mfia_folio_defaults(session, user_id=user_id, mfia=mfia):
        return None
    return fp_mfia_id


async def validate_sip_plan_inputs(
    session: AsyncSession,
    *,
    product_id: uuid.UUID,
    amount_inr: Decimal,
    frequency: str,
    installment_day: int | None,
    number_of_installments: int | None,
) -> dict[str, Any]:
    if amount_inr <= 0:
        raise MfOrderError(code="invalid_amount", message="Amount must be positive")

    normalized_frequency = _validate_sip_frequency(frequency)
    resolved_day = _validate_installment_day(frequency=normalized_frequency, installment_day=installment_day)
    installments = _validate_number_of_installments(number_of_installments)

    _product, fund, _amc = await _load_order_context(session, product_id=product_id)
    await session.refresh(fund)
    _validate_fund_sip_eligible(fund)
    min_amount = fund.min_sip_amount
    if min_amount is not None and amount_inr < min_amount:
        raise MfOrderError(
            code="below_minimum",
            message=f"Minimum SIP amount is INR {min_amount}",
        )

    return {
        "valid": True,
        "frequency": normalized_frequency,
        "installment_day": resolved_day,
        "number_of_installments": installments,
        "min_amount_inr": float(min_amount) if min_amount is not None else None,
    }


async def create_sip_plan(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    product_id: uuid.UUID,
    amount_inr: Decimal,
    frequency: str,
    installment_day: int | None,
    number_of_installments: int | None,
    mandate_id: uuid.UUID | None,
    idempotency_key: str,
    user_ip: str | None = None,
    bank_account_id: uuid.UUID | None = None,
    family_goal_id: uuid.UUID | None = None,
    mandate_type: str = "upi",
) -> MfSipPlan:
    if amount_inr <= 0:
        raise MfOrderError(code="invalid_amount", message="Amount must be positive")

    existing = await session.scalar(select(MfSipPlan).where(MfSipPlan.idempotency_key == idempotency_key))
    if existing:
        if existing.user_id != user_id:
            raise MfOrderError(code="idempotency_conflict", message="Idempotency key already used", status_code=409)
        return existing

    normalized_frequency = _validate_sip_frequency(frequency)
    resolved_day = _validate_installment_day(frequency=normalized_frequency, installment_day=installment_day)
    installments = _validate_number_of_installments(number_of_installments)

    product, fund, _amc = await _load_order_context(session, product_id=product_id)
    await session.refresh(fund)
    _validate_fund_sip_eligible(fund)
    min_amount = fund.min_sip_amount
    if min_amount is not None and amount_inr < min_amount:
        raise MfOrderError(
            code="below_minimum",
            message=f"Minimum SIP amount is INR {min_amount}",
        )

    profile = await ensure_pending_investor_profile_for_payment(
        session,
        user_id=user_id,
        provision_trigger=InvestorProvisionTrigger.mf_sip,
    )
    mfia = await get_or_create_mf_investment_account(session, user_id=user_id)

    mandate: MfMandate
    if mandate_id:
        loaded = await session.get(MfMandate, mandate_id)
        if not loaded or loaded.user_id != user_id:
            raise MfOrderError(code="mandate_not_found", message="Mandate not found", status_code=404)
        mandate = loaded
    else:
        mandate = await create_mandate_for_user(
            session,
            user_id=user_id,
            idempotency_key=f"{idempotency_key}:mandate",
            installment_amount_inr=amount_inr,
            bank_account_id=bank_account_id,
            mandate_type=mandate_type,
        )

    try:
        linked_goal = await validate_family_goal_link(session, user_id=user_id, family_goal_id=family_goal_id)
    except GoalError as exc:
        raise MfOrderError(code=exc.code, message=exc.message, status_code=exc.status_code) from exc

    resolved_user_ip = await resolve_fp_user_ip(user_ip)

    plan = MfSipPlan(
        user_id=user_id,
        product_id=product.id,
        fund_id=fund.id,
        mf_investment_account_id=mfia.id,
        mf_mandate_id=mandate.id,
        amount_inr=amount_inr,
        frequency=normalized_frequency,
        installment_day=resolved_day,
        number_of_installments=installments,
        status=MfSipPlanStatus.pending,
        idempotency_key=idempotency_key,
        metadata_=apply_family_goal_metadata(
            {
                "investor_profile_status": profile.status.value,
                "mfia_status": mfia.status.value,
                "fp_scheme_id": fund.fp_scheme_id,
                "purchase_scheme": resolve_mf_purchase_scheme(fund)[0],
                "user_ip": resolved_user_ip,
            },
            family_goal_id=linked_goal.id if linked_goal else None,
        ),
    )
    session.add(plan)
    await session.flush()
    await _record_plan_event(session, plan, from_status=None, to_status=plan.status.value)
    return plan


async def list_user_sip_plans(session: AsyncSession, *, user_id: uuid.UUID, limit: int = 50) -> list[MfSipPlan]:
    result = await session.execute(
        select(MfSipPlan)
        .where(MfSipPlan.user_id == user_id)
        .order_by(MfSipPlan.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars())


async def get_user_sip_plan(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    plan_id: uuid.UUID,
) -> MfSipPlan | None:
    plan = await session.get(MfSipPlan, plan_id)
    if not plan or plan.user_id != user_id:
        return None
    return plan


async def get_user_sip_plan_journey(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    plan_id: uuid.UUID,
) -> dict | None:
    plan = await get_user_sip_plan(session, user_id=user_id, plan_id=plan_id)
    if not plan:
        return None

    from app.application.investor.investor_bank_account_resolver import load_mandate_bank_account
    from app.application.mf.mf_sip_plan_mandate_switch_service import (
        build_bank_switch_response,
        resolve_switch_target_mandate,
    )
    from app.infrastructure.persistence.mf_models import Product

    mandate_row = await session.get(MfMandate, plan.mf_mandate_id) if plan.mf_mandate_id else None
    if mandate_row is not None:
        from app.application.mf.mf_mandate_service import refresh_mandate_status_from_fp

        await refresh_mandate_status_from_fp(
            session,
            mandate_row,
            force=plan.status in SIP_TERMINAL_STATUSES,
        )
    await sync_sip_plan_after_mandate_auth(session, plan, mandate=mandate_row)
    switch_target_mandate = await resolve_switch_target_mandate(session, plan)
    bank_switch = await build_bank_switch_response(session, plan, mandate=mandate_row)
    mandate_bank_account = None
    if mandate_row is not None:
        mandate_bank_account = await load_mandate_bank_account(
            session,
            user_id=user_id,
            mandate=mandate_row,
        )

    events = list(
        (
            await session.execute(
                select(MfSipPlanEvent)
                .where(MfSipPlanEvent.plan_id == plan.id)
                .order_by(MfSipPlanEvent.created_at)
            )
        ).scalars()
    )
    product = await session.get(Product, plan.product_id)
    amc_names, amc_logos, isins = await load_sip_plan_fund_metadata(session, [plan])

    return {
        "plan": serialize_sip_plan(
            plan,
            product_name=product.name if product else None,
            mandate=mandate_row,
            mandate_bank_account=mandate_bank_account,
            switch_target_mandate=switch_target_mandate,
            bank_switch=bank_switch,
            amc_name=amc_names.get(plan.fund_id),
            amc_logo_url=amc_logos.get(plan.fund_id),
            isin=isins.get(plan.fund_id),
        ),
        "events": [
            {
                "from_status": event.from_status,
                "to_status": event.to_status,
                "source": event.source,
                "payload": event.payload,
                "created_at": event.created_at.isoformat() if event.created_at else None,
            }
            for event in events
        ],
    }


async def cancel_sip_plan(session: AsyncSession, plan: MfSipPlan) -> MfSipPlan:
    if plan.status == MfSipPlanStatus.cancelled:
        return plan
    if plan.fp_plan_id:
        try:
            result = await cancel_mf_purchase_plan(fp_plan_id=plan.fp_plan_id)
        except FpClientError as exc:
            raise MfOrderError(
                code=exc.code,
                message=exc.message or "Unable to cancel this SIP with the fund platform. Please try again.",
                status_code=409 if exc.status_code == 409 else 502,
            ) from exc
        plan.fp_state = result.get("state") or plan.fp_state
        try:
            snapshot = await get_mf_purchase_plan(plan.fp_plan_id)
            plan.fp_state = extract_fp_state(snapshot) or plan.fp_state
        except FpClientError:
            logger.warning("Unable to refresh cancelled SIP snapshot plan=%s", plan.id, exc_info=True)
    previous = plan.status.value
    plan.status = MfSipPlanStatus.cancelled
    plan.cancelled_at = datetime.now(timezone.utc)
    await _set_sip_meta(session, plan, user_cancelled=True, user_cancelled_at=datetime.now(timezone.utc).isoformat())
    await _record_plan_event(
        session,
        plan,
        from_status=previous,
        to_status=plan.status.value,
        source="API",
    )
    mandate = await session.get(MfMandate, plan.mf_mandate_id) if plan.mf_mandate_id else None
    await maybe_release_mandate_after_sip_change(session, mandate)
    await session.flush()
    return plan


def _plan_metadata(plan: MfSipPlan) -> dict[str, Any]:
    return dict(plan.metadata_ or {})


def _sip_meta(plan: MfSipPlan) -> dict[str, Any]:
    meta = _plan_metadata(plan)
    sip = meta.get("sip")
    return dict(sip) if isinstance(sip, dict) else {}


async def _set_sip_meta(session: AsyncSession, plan: MfSipPlan, **updates: Any) -> None:
    meta = _plan_metadata(plan)
    sip = _sip_meta(plan)
    sip.update(updates)
    plan.metadata_ = {**meta, "sip": sip}
    await session.flush()


async def _apply_plan_state(session: AsyncSession, plan: MfSipPlan, *, fp_state: str | None, source: str) -> bool:
    if plan.status in SIP_TERMINAL_STATUSES:
        return False
    mapped = map_fp_plan_state(fp_state)
    if mapped == plan.status and fp_state == plan.fp_state:
        return False
    previous = plan.status.value
    plan.fp_state = fp_state or plan.fp_state
    plan.status = mapped
    if mapped == MfSipPlanStatus.active and plan.activated_at is None:
        plan.activated_at = datetime.now(timezone.utc)
        from app.application.goals.goal_funding_service import record_contribution_from_sip_plan

        await record_contribution_from_sip_plan(session, plan)
    elif mapped == MfSipPlanStatus.failed:
        plan.failure_code = plan.failure_code or "fp_plan_failed"
        plan.failure_reason = plan.failure_reason or str(fp_state)
    await _record_plan_event(
        session,
        plan,
        from_status=previous,
        to_status=plan.status.value,
        source=source,
        payload={"fp_state": plan.fp_state},
    )
    if mapped in {MfSipPlanStatus.cancelled, MfSipPlanStatus.failed}:
        mandate = await session.get(MfMandate, plan.mf_mandate_id) if plan.mf_mandate_id else None
        await maybe_release_mandate_after_sip_change(session, mandate)
    return True


async def submit_pending_sip_plan(session: AsyncSession, plan: MfSipPlan) -> bool:
    if plan.status != MfSipPlanStatus.pending or plan.fp_plan_id:
        return False
    if should_skip_retry(plan.metadata_):
        return False

    mandate = await session.get(MfMandate, plan.mf_mandate_id) if plan.mf_mandate_id else None
    if not mandate or mandate.status != MfMandateStatus.approved or mandate.fp_mandate_id is None:
        return False

    mfia = await get_or_create_mf_investment_account(session, user_id=plan.user_id)
    plan.mf_investment_account_id = mfia.id
    fp_mfia_id = await _ensure_fp_mfia(session, user_id=plan.user_id, mfia=mfia)
    meta = _plan_metadata(plan)
    fund = await session.get(MutualFund, plan.fund_id) if plan.fund_id else None
    purchase_scheme, fallback_scheme = resolve_mf_purchase_scheme(
        fund,
        stored_scheme=str(meta.get("purchase_scheme") or meta.get("fp_scheme_id") or ""),
    )
    if not fp_mfia_id or not purchase_scheme:
        return False

    settings = get_settings()
    body: dict[str, Any] = {
        "mf_investment_account": fp_mfia_id,
        "scheme": purchase_scheme,
        "frequency": plan.frequency,
        "amount": float(plan.amount_inr),
        "number_of_installments": plan.number_of_installments,
        "systematic": True,
        "payment_method": "mandate",
        "payment_source": str(mandate.fp_mandate_id),
        "auto_generate_installments": True,
        "generate_first_installment_now": True,
        "source_ref_id": str(plan.id),
        "initiated_by": "investor",
        "initiated_via": "mobile_app",
    }
    if plan.installment_day is not None:
        body["installment_day"] = plan.installment_day
    user_ip = await resolve_fp_user_ip(meta.get("user_ip"))
    if user_ip:
        body["user_ip"] = user_ip
        if meta.get("user_ip") != user_ip:
            meta["user_ip"] = user_ip
            plan.metadata_ = meta
    if settings.zynd_distributor_arn.strip():
        body["distributor_arn"] = settings.zynd_distributor_arn.strip()
    if settings.zynd_distributor_euin.strip():
        body["euin"] = settings.zynd_distributor_euin.strip()

    try:
        result = await create_mf_purchase_plan(body=body)
    except Exception as exc:
        if (
            is_scheme_unavailable_for_transaction(exc)
            and fallback_scheme
            and body.get("scheme") != fallback_scheme
        ):
            logger.warning(
                "SIP plan submit rejected for scheme=%s plan=%s; retrying with fallback scheme=%s",
                body.get("scheme"),
                plan.id,
                fallback_scheme,
            )
            body["scheme"] = fallback_scheme
            try:
                result = await create_mf_purchase_plan(body=body)
            except Exception as retry_exc:
                exc = retry_exc
            else:
                plan.fp_plan_id = result.get("fp_plan_id")
                plan.fp_state = result.get("state")
                resolved_meta = _plan_metadata(plan)
                resolved_meta["purchase_scheme"] = fallback_scheme
                plan.metadata_ = resolved_meta
                await _apply_plan_state(session, plan, fp_state=plan.fp_state, source="WORKER")
                return True

        logger.exception("SIP plan submit failed plan=%s", plan.id)
        if is_transient_error(exc):
            plan.metadata_, terminal = bump_transient_retry(
                plan.metadata_,
                error_code="fp_plan_submit_failed",
                error_message=str(exc),
            )
            await session.flush()
            return not terminal
        previous = plan.status.value
        failure_code, failure_reason = _format_fp_plan_submit_error(exc)
        plan.status = MfSipPlanStatus.failed
        plan.failure_code = failure_code
        plan.failure_reason = failure_reason
        await _record_plan_event(
            session,
            plan,
            from_status=previous,
            to_status=plan.status.value,
            source="WORKER",
            payload={"error": failure_reason, "failure_code": failure_code},
        )
        return True

    plan.fp_plan_id = result.get("fp_plan_id")
    plan.fp_state = result.get("state")
    await _apply_plan_state(session, plan, fp_state=plan.fp_state, source="WORKER")
    return True


async def _refresh_sip_plan_from_fp(
    session: AsyncSession,
    plan: MfSipPlan,
    *,
    repair_terminal: bool = False,
) -> bool:
    """Fetch Cybrilla plan snapshot and align local fp_state / next installment."""
    if not plan.fp_plan_id:
        return False

    payload = await get_mf_purchase_plan(plan.fp_plan_id)
    obj = _extract_fp_object(payload)
    fp_state = extract_fp_state(payload) or obj.get("state") or plan.fp_state
    fp_state_text = str(fp_state) if fp_state is not None else None
    mapped = map_fp_plan_state(fp_state_text)
    changed = False

    next_date = obj.get("next_installment_date")
    if next_date:
        try:
            parsed = date.fromisoformat(str(next_date)[:10])
            if plan.next_installment_date != parsed:
                plan.next_installment_date = parsed
                changed = True
        except ValueError:
            pass

    if fp_state_text and plan.fp_state != fp_state_text:
        plan.fp_state = fp_state_text
        changed = True

    if plan.status == MfSipPlanStatus.cancelled:
        if fp_state_text and plan.fp_state != fp_state_text:
            plan.fp_state = fp_state_text
            changed = True
        if changed:
            await session.flush()
        return changed

    if repair_terminal and plan.status == MfSipPlanStatus.failed:
        if mapped not in {MfSipPlanStatus.failed, MfSipPlanStatus.cancelled}:
            previous = plan.status.value
            plan.status = mapped
            plan.failure_code = None
            plan.failure_reason = None
            await _record_plan_event(
                session,
                plan,
                from_status=previous,
                to_status=plan.status.value,
                source="RECONCILE",
                payload={"fp_state": plan.fp_state, "repair": "fp_snapshot"},
            )
            changed = True
    elif plan.status not in SIP_TERMINAL_STATUSES:
        if await _apply_plan_state(session, plan, fp_state=fp_state_text, source="WORKER"):
            changed = True

    if changed:
        await session.flush()
    return changed


async def advance_sip_plan(session: AsyncSession, plan: MfSipPlan) -> bool:
    if not plan.fp_plan_id:
        return False
    if should_skip_retry(plan.metadata_):
        return False

    changed = await _refresh_sip_plan_from_fp(
        session,
        plan,
        repair_terminal=plan.status == MfSipPlanStatus.failed,
    )
    if plan.status in SIP_TERMINAL_STATUSES:
        return changed

    sip_meta = _sip_meta(plan)
    fp_state_normalized = (plan.fp_state or "").lower()
    if fp_state_normalized in {"active", "confirmed"}:
        return changed

    try:
        contact = await _load_consent_contact(session, user_id=plan.user_id)
        if fp_state_normalized == "review_completed" and not sip_meta.get("plan_confirmed"):
            update_body: dict[str, Any] = {"id": plan.fp_plan_id, "state": "confirmed"}
            if contact:
                email, mobile = contact
                update_body["consent"] = {"email": email, "mobile": mobile, "isd_code": "91"}
            result = await update_mf_purchase_plan(body=update_body)
            plan.fp_state = result.get("state") or plan.fp_state
            await _set_sip_meta(session, plan, plan_confirmed=True, consent_applied=True)
            if await _apply_plan_state(session, plan, fp_state=plan.fp_state, source="WORKER"):
                changed = True
            changed = (await _refresh_sip_plan_from_fp(session, plan)) or changed
    except FpClientError as exc:
        logger.exception("SIP advance failed plan=%s", plan.id)
        repaired = await _refresh_sip_plan_from_fp(
            session,
            plan,
            repair_terminal=plan.status == MfSipPlanStatus.failed,
        )
        if repaired and plan.status == MfSipPlanStatus.active:
            return True
        if is_transient_error(exc):
            plan.metadata_, terminal = bump_transient_retry(
                plan.metadata_,
                error_code=exc.code,
                error_message=exc.message,
            )
            await session.flush()
            return not terminal
        if plan.status in SIP_TERMINAL_STATUSES:
            return changed
        previous = plan.status.value
        plan.status = MfSipPlanStatus.failed
        plan.failure_code = exc.code
        plan.failure_reason = exc.message
        await _record_plan_event(
            session,
            plan,
            from_status=previous,
            to_status=plan.status.value,
            source="WORKER",
            payload={"error": exc.message, "code": exc.code},
        )
        return True

    return changed


_MANDATE_ABANDONABLE_SIP_STATUSES = {
    MfSipPlanStatus.pending,
    MfSipPlanStatus.review,
    MfSipPlanStatus.consent_pending,
}

_MANDATE_ABANDON_REASON = "Mandate authorization was not completed"


async def abandon_unfinished_mandate_auth(
    session: AsyncSession,
    plan: MfSipPlan,
) -> bool:
    """Cancel SIP/mandate when the investor returns without completing UPI authorization."""
    from app.application.mf.mf_mandate_service import cancel_user_mandate, refresh_mandate_status_from_fp

    if plan.status in SIP_TERMINAL_STATUSES:
        return False

    mandate_row = await session.get(MfMandate, plan.mf_mandate_id) if plan.mf_mandate_id else None
    if mandate_row is not None and mandate_row.fp_mandate_id is not None:
        await refresh_mandate_status_from_fp(session, mandate_row, force=True)

    if mandate_row is not None and mandate_row.status == MfMandateStatus.approved:
        await sync_sip_plan_after_mandate_auth(session, plan, mandate=mandate_row)
        return False

    if mandate_row is not None and mandate_row.status == MfMandateStatus.auth_pending:
        return False

    if plan.status not in _MANDATE_ABANDONABLE_SIP_STATUSES:
        return False

    if mandate_row is not None and mandate_row.status not in {
        MfMandateStatus.failed,
        MfMandateStatus.cancelled,
    }:
        try:
            await cancel_user_mandate(session, mandate_row)
        except MfOrderError:
            mandate_row.status = MfMandateStatus.cancelled
            mandate_row.failure_code = mandate_row.failure_code or "mandate_abandoned"
            mandate_row.failure_reason = mandate_row.failure_reason or _MANDATE_ABANDON_REASON
            await session.flush()

    previous = plan.status.value
    plan.status = MfSipPlanStatus.cancelled
    plan.cancelled_at = datetime.now(timezone.utc)
    plan.failure_code = plan.failure_code or "mandate_abandoned"
    plan.failure_reason = plan.failure_reason or _MANDATE_ABANDON_REASON
    await _record_plan_event(
        session,
        plan,
        from_status=previous,
        to_status=plan.status.value,
        source="USER",
        payload={"reason": "mandate_abandoned"},
    )
    await session.flush()
    return True


async def confirm_mandate_return(session: AsyncSession, plan: MfSipPlan) -> None:
    """Refresh mandate status and advance SIP setup when the investor returns from UPI."""
    await sync_sip_plan_after_mandate_auth(session, plan)


async def sync_sip_plan_after_mandate_auth(
    session: AsyncSession,
    plan: MfSipPlan,
    *,
    mandate: MfMandate | None = None,
) -> None:
    """Refresh mandate status and advance SIP setup after the investor returns from UPI."""
    from app.application.mf.mf_mandate_service import refresh_mandate_status_from_fp
    from app.application.mf.mf_sip_plan_mandate_switch_service import (
        get_mandate_switch_meta,
        sync_sip_plan_mandate_switch_after_auth,
    )

    if plan.status == MfSipPlanStatus.cancelled:
        if plan.fp_plan_id:
            await _refresh_sip_plan_from_fp(session, plan, repair_terminal=False)
        return

    if plan.status == MfSipPlanStatus.active and plan.cancelled_at is not None:
        previous = plan.status.value
        plan.status = MfSipPlanStatus.cancelled
        await _record_plan_event(
            session,
            plan,
            from_status=previous,
            to_status=plan.status.value,
            source="RECONCILE",
            payload={"repair": "cancelled_at_present"},
        )
        await session.flush()
        return

    fp_state_normalized = (plan.fp_state or "").strip().lower()
    if plan.status == MfSipPlanStatus.active and fp_state_normalized in SIP_NON_OPERATIONAL_FP_STATES:
        previous = plan.status.value
        plan.status = map_fp_plan_state(plan.fp_state)
        await _record_plan_event(
            session,
            plan,
            from_status=previous,
            to_status=plan.status.value,
            source="RECONCILE",
            payload={"fp_state": plan.fp_state, "repair": "fp_state_terminal"},
        )
        await session.flush()
        return

    switch_meta = get_mandate_switch_meta(plan)
    pending_switch = switch_meta.get("pending")
    if plan.status == MfSipPlanStatus.active and isinstance(pending_switch, dict):
        await sync_sip_plan_mandate_switch_after_auth(session, plan)
        return

    if plan.fp_plan_id:
        await _refresh_sip_plan_from_fp(
            session,
            plan,
            repair_terminal=plan.status == MfSipPlanStatus.failed,
        )
    if plan.status == MfSipPlanStatus.active:
        return

    mandate_row = mandate
    if mandate_row is None and plan.mf_mandate_id:
        mandate_row = await session.get(MfMandate, plan.mf_mandate_id)
    if mandate_row is not None and mandate_row.fp_mandate_id is not None:
        await refresh_mandate_status_from_fp(session, mandate_row, force=True)

    if (
        plan.status == MfSipPlanStatus.failed
        and not plan.fp_plan_id
        and mandate_row is not None
        and mandate_row.status == MfMandateStatus.approved
        and (plan.failure_code is None or plan.failure_code in RECOVERABLE_SUBMIT_FAILURE_CODES)
    ):
        plan.status = MfSipPlanStatus.pending
        plan.failure_code = None
        plan.failure_reason = None
        await session.flush()
        await submit_pending_sip_plan(session, plan)
        return

    if plan.status in SIP_TERMINAL_STATUSES:
        return

    if plan.status == MfSipPlanStatus.pending and not plan.fp_plan_id:
        await submit_pending_sip_plan(session, plan)
        return

    if plan.fp_plan_id:
        await advance_sip_plan(session, plan)


async def process_pending_sip_plans(session: AsyncSession, *, batch_size: int = 10) -> dict[str, int]:
    plans = list(
        (
            await session.execute(
                select(MfSipPlan)
                .where(MfSipPlan.status == MfSipPlanStatus.pending)
                .order_by(MfSipPlan.created_at)
                .limit(batch_size)
            )
        ).scalars()
    )
    submitted = 0
    for plan in plans:
        if await submit_pending_sip_plan(session, plan):
            submitted += 1
    return {"processed": len(plans), "submitted": submitted}


async def advance_sip_plans(session: AsyncSession, *, batch_size: int = 10) -> dict[str, int]:
    plans = list(
        (
            await session.execute(
                select(MfSipPlan)
                .where(
                    MfSipPlan.fp_plan_id.is_not(None),
                    MfSipPlan.status.not_in(list(SIP_TERMINAL_STATUSES)),
                )
                .order_by(MfSipPlan.updated_at)
                .limit(batch_size)
            )
        ).scalars()
    )
    advanced = 0
    for plan in plans:
        if await advance_sip_plan(session, plan):
            advanced += 1
    return {"processed": len(plans), "advanced": advanced}


async def reconcile_sip_plan_from_fp(
    session: AsyncSession,
    plan: MfSipPlan,
    *,
    retry_submit: bool = False,
) -> dict[str, Any]:
    """Pull Cybrilla SIP plan state and repair local rows that lag or failed prematurely."""
    outcome: dict[str, Any] = {
        "plan_id": str(plan.id),
        "status_before": plan.status.value,
        "fp_plan_id": plan.fp_plan_id,
        "repaired": False,
        "retried_submit": False,
        "advanced": False,
        "status_after": plan.status.value,
        "fp_state": plan.fp_state,
    }

    if plan.fp_plan_id:
        payload = await get_mf_purchase_plan(plan.fp_plan_id)
        obj = _extract_fp_object(payload)
        fp_state = extract_fp_state(payload) or obj.get("state") or plan.fp_state
        mapped = map_fp_plan_state(str(fp_state) if fp_state is not None else None)
        next_date = obj.get("next_installment_date")
        if next_date:
            try:
                plan.next_installment_date = date.fromisoformat(str(next_date)[:10])
            except ValueError:
                pass

        if plan.status == MfSipPlanStatus.failed and mapped not in {
            MfSipPlanStatus.failed,
            MfSipPlanStatus.cancelled,
        }:
            previous = plan.status.value
            plan.status = mapped
            plan.fp_state = str(fp_state) if fp_state is not None else plan.fp_state
            plan.failure_code = None
            plan.failure_reason = None
            await _record_plan_event(
                session,
                plan,
                from_status=previous,
                to_status=plan.status.value,
                source="RECONCILE",
                payload={"fp_state": plan.fp_state, "repair": "fp_plan_state"},
            )
            outcome["repaired"] = True

        if plan.status not in SIP_TERMINAL_STATUSES:
            outcome["advanced"] = await advance_sip_plan(session, plan)
    elif (
        retry_submit
        and plan.status == MfSipPlanStatus.failed
        and (plan.failure_code is None or plan.failure_code in RECOVERABLE_SUBMIT_FAILURE_CODES)
    ):
        mandate = await session.get(MfMandate, plan.mf_mandate_id) if plan.mf_mandate_id else None
        if mandate and mandate.status == MfMandateStatus.approved and mandate.fp_mandate_id is not None:
            previous = plan.status.value
            plan.status = MfSipPlanStatus.pending
            plan.failure_code = None
            plan.failure_reason = None
            await _record_plan_event(
                session,
                plan,
                from_status=previous,
                to_status=plan.status.value,
                source="RECONCILE",
                payload={"repair": "retry_submit"},
            )
            outcome["retried_submit"] = await submit_pending_sip_plan(session, plan)
            if plan.fp_plan_id and plan.status not in SIP_TERMINAL_STATUSES:
                outcome["advanced"] = await advance_sip_plan(session, plan)

    outcome["status_after"] = plan.status.value
    outcome["fp_state"] = plan.fp_state
    outcome["fp_plan_id"] = plan.fp_plan_id
    outcome["failure_code"] = plan.failure_code
    return outcome
