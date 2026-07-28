from __future__ import annotations

import logging
import re
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.goals.errors import GoalError
from app.application.goals.goal_funding_service import apply_family_goal_metadata, validate_family_goal_link
from app.application.investor.investor_profile_service import ensure_pending_investor_profile_for_payment
from app.application.mf.mf_fp_state import map_fp_plan_state
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

ONDEC_SUPPORTED_FREQUENCIES = frozenset({"monthly", "daily"})


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
    amc_name: str | None = None,
    amc_logo_url: str | None = None,
    isin: str | None = None,
) -> dict:
    mandate_payload = serialize_mandate(mandate) if mandate else None
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
        "mandate_auth_url": mandate.auth_token_url if mandate else None,
        "next_action": _derive_sip_next_action(status=plan.status.value, mandate=mandate),
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


def _default_installments(frequency: str) -> int:
    settings = get_settings()
    if frequency == "daily":
        return settings.zynd_mf_sip_default_daily_installments
    return settings.zynd_mf_sip_default_monthly_installments


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
    installments = number_of_installments or _default_installments(normalized_frequency)

    product, fund, _amc = await _load_order_context(session, product_id=product_id)
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
        )

    try:
        linked_goal = await validate_family_goal_link(session, user_id=user_id, family_goal_id=family_goal_id)
    except GoalError as exc:
        raise MfOrderError(code=exc.code, message=exc.message, status_code=exc.status_code) from exc

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
                "user_ip": user_ip,
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


async def cancel_sip_plan(session: AsyncSession, plan: MfSipPlan) -> MfSipPlan:
    if plan.status == MfSipPlanStatus.cancelled:
        return plan
    if plan.fp_plan_id:
        result = await cancel_mf_purchase_plan(fp_plan_id=plan.fp_plan_id)
        plan.fp_state = result.get("state") or plan.fp_state
    previous = plan.status.value
    plan.status = MfSipPlanStatus.cancelled
    plan.cancelled_at = datetime.now(timezone.utc)
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
    fp_scheme_id = meta.get("fp_scheme_id")
    if not fp_mfia_id or not fp_scheme_id:
        return False

    settings = get_settings()
    body: dict[str, Any] = {
        "mf_investment_account": fp_mfia_id,
        "scheme": fp_scheme_id,
        "frequency": plan.frequency,
        "amount": float(plan.amount_inr),
        "number_of_installments": plan.number_of_installments,
        "systematic": True,
        "payment_method": "mandate",
        "payment_source": str(mandate.fp_mandate_id),
        "auto_generate_installments": True,
        "gateway": settings.zynd_mf_order_payment_gateway,
        "source_ref_id": str(plan.id),
        "initiated_by": "investor",
        "initiated_via": "mobile_app",
    }
    if plan.installment_day is not None:
        body["installment_day"] = plan.installment_day
    user_ip = meta.get("user_ip")
    if user_ip:
        body["user_ip"] = user_ip
    if settings.zynd_distributor_arn.strip():
        body["distributor_arn"] = settings.zynd_distributor_arn.strip()
    if settings.zynd_distributor_euin.strip():
        body["euin"] = settings.zynd_distributor_euin.strip()

    try:
        result = await create_mf_purchase_plan(body=body)
    except Exception as exc:
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
        plan.status = MfSipPlanStatus.failed
        plan.failure_code = "fp_plan_submit_failed"
        plan.failure_reason = str(exc)
        await _record_plan_event(
            session,
            plan,
            from_status=previous,
            to_status=plan.status.value,
            source="WORKER",
            payload={"error": str(exc)},
        )
        return True

    plan.fp_plan_id = result.get("fp_plan_id")
    plan.fp_state = result.get("state")
    await _apply_plan_state(session, plan, fp_state=plan.fp_state, source="WORKER")
    return True


async def advance_sip_plan(session: AsyncSession, plan: MfSipPlan) -> bool:
    if plan.status in SIP_TERMINAL_STATUSES or not plan.fp_plan_id:
        return False
    if should_skip_retry(plan.metadata_):
        return False

    changed = False
    payload = await get_mf_purchase_plan(plan.fp_plan_id)
    obj = _extract_fp_object(payload)
    fp_state = extract_fp_state(payload) or obj.get("state") or plan.fp_state
    next_date = obj.get("next_installment_date")
    if next_date:
        try:
            plan.next_installment_date = date.fromisoformat(str(next_date)[:10])
            changed = True
        except ValueError:
            pass

    if await _apply_plan_state(session, plan, fp_state=str(fp_state) if fp_state else None, source="WORKER"):
        changed = True

    if plan.status in SIP_TERMINAL_STATUSES:
        return changed

    sip_meta = _sip_meta(plan)
    fp_state_normalized = (plan.fp_state or "").lower()

    try:
        contact = await _load_consent_contact(session, user_id=plan.user_id)
        if contact and not sip_meta.get("consent_applied"):
            email, mobile = contact
            await update_mf_purchase_plan(
                body={
                    "id": plan.fp_plan_id,
                    "consent": {"email": email, "mobile": mobile, "isd_code": "91"},
                }
            )
            await _set_sip_meta(session, plan, consent_applied=True)
            changed = True

        if fp_state_normalized == "review_completed" and not sip_meta.get("plan_confirmed"):
            mandate = await session.get(MfMandate, plan.mf_mandate_id) if plan.mf_mandate_id else None
            update_body: dict[str, Any] = {"id": plan.fp_plan_id, "state": "confirmed"}
            if mandate and mandate.fp_mandate_id is not None:
                update_body["payment_method"] = "mandate"
                update_body["payment_source"] = str(mandate.fp_mandate_id)
            if contact:
                email, mobile = contact
                update_body["consent"] = {"email": email, "mobile": mobile, "isd_code": "91"}
            result = await update_mf_purchase_plan(body=update_body)
            plan.fp_state = result.get("state") or plan.fp_state
            await _set_sip_meta(session, plan, plan_confirmed=True)
            if await _apply_plan_state(session, plan, fp_state=plan.fp_state, source="WORKER"):
                changed = True
    except FpClientError as exc:
        logger.exception("SIP advance failed plan=%s", plan.id)
        if is_transient_error(exc):
            plan.metadata_, terminal = bump_transient_retry(
                plan.metadata_,
                error_code=exc.code,
                error_message=exc.message,
            )
            await session.flush()
            return not terminal
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
