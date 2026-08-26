"""SIP debit-bank switch via FinPrim plan modification instructions (ONDC)."""

from __future__ import annotations

import logging
import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.investor.investor_bank_account_resolver import resolve_payment_bank_account
from app.application.mf.mf_mandate_service import (
    create_mandate_for_user,
    initiate_mandate_auth,
    maybe_release_mandate_after_sip_change,
    submit_pending_mandate,
)
from app.application.mf.mf_order_errors import MfOrderError
from app.application.mf.mf_sip_plan_service import (
    _load_consent_contact,
    _record_plan_event,
)
from app.core.config import get_settings
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.mf.fp_oms_client import (
    create_mf_plan_modification_instruction,
    get_mf_plan_modification_instruction,
)
from app.infrastructure.persistence.mf_transaction_models import (
    MfMandate,
    MfMandateStatus,
    MfSipPlan,
    MfSipPlanStatus,
)

logger = logging.getLogger(__name__)

MANDATE_SWITCH_PENDING_STATES = frozenset(
    {
        "awaiting_mandate_auth",
        "instruction_submitted",
    }
)


def _plan_metadata(plan: MfSipPlan) -> dict[str, Any]:
    return dict(plan.metadata_ or {})


def get_mandate_switch_meta(plan: MfSipPlan) -> dict[str, Any]:
    meta = _plan_metadata(plan).get("mandate_switch")
    return dict(meta) if isinstance(meta, dict) else {}


def _save_mandate_switch_meta(plan: MfSipPlan, switch_meta: dict[str, Any]) -> None:
    meta = _plan_metadata(plan)
    meta["mandate_switch"] = switch_meta
    plan.metadata_ = meta


def _get_pending_switch(plan: MfSipPlan) -> dict[str, Any] | None:
    pending = get_mandate_switch_meta(plan).get("pending")
    return dict(pending) if isinstance(pending, dict) else None


def _set_pending_switch(plan: MfSipPlan, pending: dict[str, Any] | None) -> None:
    switch_meta = get_mandate_switch_meta(plan)
    if pending is None:
        switch_meta.pop("pending", None)
    else:
        switch_meta["pending"] = pending
    _save_mandate_switch_meta(plan, switch_meta)


def _mark_mandate_switch_used(plan: MfSipPlan) -> None:
    switch_meta = get_mandate_switch_meta(plan)
    switch_meta["used"] = True
    switch_meta.pop("pending", None)
    _save_mandate_switch_meta(plan, switch_meta)


async def _load_mandate(session: AsyncSession, mandate_id: str | uuid.UUID | None) -> MfMandate | None:
    if mandate_id is None:
        return None
    try:
        parsed = uuid.UUID(str(mandate_id))
    except ValueError:
        return None
    return await session.get(MfMandate, parsed)


def _consent_payload(email: str, mobile: str) -> dict[str, str]:
    return {
        "email": email,
        "isd_code": "91",
        "mobile": mobile,
    }


async def evaluate_bank_switch_eligibility(
    session: AsyncSession,
    plan: MfSipPlan,
    *,
    mandate: MfMandate | None,
) -> dict[str, Any]:
    switch_meta = get_mandate_switch_meta(plan)
    pending = _get_pending_switch(plan)
    used = bool(switch_meta.get("used"))
    in_progress = pending is not None and pending.get("state") in MANDATE_SWITCH_PENDING_STATES

    base: dict[str, Any] = {
        "eligible": False,
        "used": used,
        "in_progress": in_progress,
        "reason": None,
        "target_bank_account_id": pending.get("target_bank_account_id") if pending else None,
    }

    if used:
        base["reason"] = "Bank switch has already been used for this SIP."
        return base

    if in_progress:
        base["reason"] = "A bank switch is already in progress."
        return base

    if plan.status != MfSipPlanStatus.active:
        base["reason"] = "Only active SIPs can switch debit banks."
        return base

    if not plan.fp_plan_id:
        base["reason"] = "SIP is not fully registered yet."
        return base

    if mandate is None or mandate.status != MfMandateStatus.approved or mandate.fp_mandate_id is None:
        base["reason"] = "Current SIP mandate is not ready for switching."
        return base

    settings = get_settings()
    if settings.zynd_mf_order_payment_gateway.strip().lower() != "ondc":
        base["reason"] = "Bank switch is only available on ONDC SIPs."
        return base

    base["eligible"] = True
    return base


async def build_bank_switch_response(
    session: AsyncSession,
    plan: MfSipPlan,
    *,
    mandate: MfMandate | None,
) -> dict[str, Any]:
    return await evaluate_bank_switch_eligibility(session, plan, mandate=mandate)


def derive_sip_next_action_from_plan(
    *,
    plan: MfSipPlan,
    mandate: MfMandate | None,
    switch_target_mandate: MfMandate | None,
    first_installment: dict[str, Any] | None = None,
) -> str:
    status = plan.status.value
    if status == "ACTIVE":
        if isinstance(first_installment, dict) and first_installment.get("status") == "pending":
            return "pay_first_installment"
        pending = _get_pending_switch(plan)
        if pending and pending.get("state") == "awaiting_mandate_auth":
            if switch_target_mandate and switch_target_mandate.auth_token_url:
                return "authorize_mandate_switch"
            if switch_target_mandate and switch_target_mandate.status != MfMandateStatus.approved:
                return "wait_mandate"
        if pending and pending.get("state") == "instruction_submitted":
            return "wait_bank_switch"
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


def build_bank_switch_summary_sync(plan: MfSipPlan) -> dict[str, Any]:
    switch_meta = get_mandate_switch_meta(plan)
    pending = _get_pending_switch(plan)
    used = bool(switch_meta.get("used"))
    in_progress = pending is not None and pending.get("state") in MANDATE_SWITCH_PENDING_STATES
    eligible = (
        plan.status == MfSipPlanStatus.active
        and bool(plan.fp_plan_id)
        and not used
        and not in_progress
    )
    reason = None
    if used:
        reason = "Bank switch has already been used for this SIP."
    elif in_progress:
        reason = "A bank switch is already in progress."
    elif plan.status != MfSipPlanStatus.active:
        reason = "Only active SIPs can switch debit banks."
    elif not plan.fp_plan_id:
        reason = "SIP is not fully registered yet."

    return {
        "eligible": eligible,
        "used": used,
        "in_progress": in_progress,
        "reason": reason,
        "target_bank_account_id": pending.get("target_bank_account_id") if pending else None,
    }


async def resolve_switch_target_mandate(session: AsyncSession, plan: MfSipPlan) -> MfMandate | None:
    pending = _get_pending_switch(plan)
    if not pending:
        return None
    return await _load_mandate(session, pending.get("target_mandate_id"))


async def switch_sip_plan_mandate(
    session: AsyncSession,
    plan: MfSipPlan,
    *,
    user_id: uuid.UUID,
    bank_account_id: uuid.UUID,
    mandate_type: str,
    idempotency_key: str,
) -> MfSipPlan:
    current_mandate = await _load_mandate(session, plan.mf_mandate_id)
    eligibility = await evaluate_bank_switch_eligibility(session, plan, mandate=current_mandate)
    if not eligibility["eligible"]:
        raise MfOrderError(
            code="bank_switch_not_eligible",
            message=eligibility.get("reason") or "This SIP cannot switch debit banks right now.",
            status_code=409,
        )

    if current_mandate is None:
        raise MfOrderError(code="mandate_not_found", message="Current SIP mandate not found", status_code=404)

    target_bank = await resolve_payment_bank_account(
        session,
        user_id=user_id,
        bank_account_id=bank_account_id,
    )
    if current_mandate.investor_bank_account_id == target_bank.id:
        raise MfOrderError(
            code="same_debit_bank",
            message="Choose a different bank account than the one currently debiting this SIP.",
            status_code=400,
        )

    target_mandate = await create_mandate_for_user(
        session,
        user_id=user_id,
        idempotency_key=idempotency_key,
        installment_amount_inr=Decimal(str(plan.amount_inr)),
        bank_account_id=target_bank.id,
        mandate_type=mandate_type,
    )

    pending = {
        "target_mandate_id": str(target_mandate.id),
        "target_bank_account_id": str(target_bank.id),
        "previous_mandate_id": str(current_mandate.id),
        "fp_instruction_id": None,
        "state": "awaiting_mandate_auth",
        "failure_reason": None,
        "idempotency_key": idempotency_key,
    }
    _set_pending_switch(plan, pending)
    await session.flush()

    if target_mandate.status == MfMandateStatus.approved and target_mandate.fp_mandate_id is not None:
        await _submit_mandate_switch_instruction(session, plan, current_mandate=current_mandate)
    else:
        if target_mandate.status == MfMandateStatus.pending:
            await submit_pending_mandate(session, target_mandate)
        if target_mandate.status == MfMandateStatus.auth_pending and not target_mandate.auth_token_url:
            try:
                await initiate_mandate_auth(session, target_mandate)
            except MfOrderError:
                pass

    await session.flush()
    return plan


async def _submit_mandate_switch_instruction(
    session: AsyncSession,
    plan: MfSipPlan,
    *,
    current_mandate: MfMandate | None = None,
) -> None:
    pending = _get_pending_switch(plan)
    if not pending:
        raise MfOrderError(code="bank_switch_not_pending", message="No bank switch is in progress.", status_code=409)

    target_mandate = await _load_mandate(session, pending.get("target_mandate_id"))
    if target_mandate is None:
        raise MfOrderError(code="mandate_not_found", message="Target mandate not found", status_code=404)

    if target_mandate.status != MfMandateStatus.approved or target_mandate.fp_mandate_id is None:
        raise MfOrderError(
            code="mandate_not_approved",
            message="Authorize the new mandate before completing the bank switch.",
            status_code=409,
        )

    if current_mandate is None:
        current_mandate = await _load_mandate(session, pending.get("previous_mandate_id") or plan.mf_mandate_id)
    if current_mandate is None or not plan.fp_plan_id:
        raise MfOrderError(code="sip_not_ready", message="SIP is not ready for bank switch.", status_code=409)

    consent_contact = await _load_consent_contact(session, user_id=plan.user_id)
    if not consent_contact:
        raise MfOrderError(
            code="consent_contact_missing",
            message="Email and mobile are required to switch SIP debit bank.",
            status_code=400,
        )
    email, mobile = consent_contact

    if pending.get("fp_instruction_id"):
        await _sync_mandate_switch_instruction(session, plan, current_mandate=current_mandate)
        return

    try:
        result = await create_mf_plan_modification_instruction(
            plan_id=plan.fp_plan_id,
            payment_method="mandate",
            payment_source=int(target_mandate.fp_mandate_id),
            consent=_consent_payload(email, mobile),
        )
    except FpClientError as exc:
        pending["state"] = "failed"
        pending["failure_reason"] = exc.message
        _set_pending_switch(plan, pending)
        await session.flush()
        raise MfOrderError(
            code="fp_modification_failed",
            message=exc.message or "Could not submit SIP bank switch to the payment provider.",
            status_code=502 if exc.status_code >= 500 else 400,
        ) from exc

    instruction_id = result.get("id")
    pending["fp_instruction_id"] = instruction_id
    pending["state"] = "instruction_submitted"
    _set_pending_switch(plan, pending)
    await session.flush()
    await _sync_mandate_switch_instruction(session, plan, current_mandate=current_mandate)


async def _complete_mandate_switch(
    session: AsyncSession,
    plan: MfSipPlan,
    *,
    current_mandate: MfMandate,
    target_mandate: MfMandate,
    instruction_id: str | None,
) -> None:
    previous_mandate_id = plan.mf_mandate_id
    plan.mf_mandate_id = target_mandate.id
    _mark_mandate_switch_used(plan)
    await session.flush()

    await _record_plan_event(
        session,
        plan,
        from_status=plan.status.value,
        to_status=plan.status.value,
        source="MANDATE_SWITCH",
        payload={
            "previous_mandate_id": str(previous_mandate_id) if previous_mandate_id else None,
            "target_mandate_id": str(target_mandate.id),
            "fp_instruction_id": instruction_id,
        },
    )
    await maybe_release_mandate_after_sip_change(session, current_mandate)


async def _sync_mandate_switch_instruction(
    session: AsyncSession,
    plan: MfSipPlan,
    *,
    current_mandate: MfMandate | None = None,
) -> bool:
    pending = _get_pending_switch(plan)
    if not pending or pending.get("state") != "instruction_submitted":
        return False

    instruction_id = pending.get("fp_instruction_id")
    if not instruction_id:
        return False

    try:
        result = await get_mf_plan_modification_instruction(str(instruction_id))
    except FpClientError as exc:
        logger.warning(
            "Failed to sync mandate switch instruction plan=%s instruction=%s: %s",
            plan.id,
            instruction_id,
            exc.message,
        )
        return False

    state = str(result.get("state") or "").lower()
    if state == "failed":
        pending["state"] = "failed"
        pending["failure_reason"] = result.get("failure_reason") or "Bank switch failed."
        _set_pending_switch(plan, pending)
        await session.flush()
        return True

    if state != "completed":
        return False

    target_mandate = await _load_mandate(session, pending.get("target_mandate_id"))
    if target_mandate is None:
        return False

    if current_mandate is None:
        current_mandate = await _load_mandate(session, pending.get("previous_mandate_id") or plan.mf_mandate_id)
    if current_mandate is None:
        return False

    await _complete_mandate_switch(
        session,
        plan,
        current_mandate=current_mandate,
        target_mandate=target_mandate,
        instruction_id=str(instruction_id),
    )
    return True


async def sync_sip_plan_mandate_switch_after_auth(session: AsyncSession, plan: MfSipPlan) -> bool:
    """Advance an in-progress bank switch after mandate authorization."""
    pending = _get_pending_switch(plan)
    if not pending:
        return False

    if pending.get("state") == "failed":
        return False

    target_mandate = await _load_mandate(session, pending.get("target_mandate_id"))
    if target_mandate is None:
        return False

    from app.application.mf.mf_mandate_service import refresh_mandate_status_from_fp

    if target_mandate.fp_mandate_id is not None:
        await refresh_mandate_status_from_fp(session, target_mandate, force=True)

    if pending.get("state") == "awaiting_mandate_auth":
        if target_mandate.status != MfMandateStatus.approved or target_mandate.fp_mandate_id is None:
            return False
        current_mandate = await _load_mandate(session, pending.get("previous_mandate_id") or plan.mf_mandate_id)
        if current_mandate is None:
            return False
        await _submit_mandate_switch_instruction(session, plan, current_mandate=current_mandate)
        return True

    if pending.get("state") == "instruction_submitted":
        current_mandate = await _load_mandate(session, pending.get("previous_mandate_id") or plan.mf_mandate_id)
        return await _sync_mandate_switch_instruction(session, plan, current_mandate=current_mandate)

    return False


async def process_pending_mandate_switches(session: AsyncSession, *, batch_size: int = 10) -> dict[str, int]:
    plans = list(
        (
            await session.execute(
                select(MfSipPlan)
                .where(MfSipPlan.status == MfSipPlanStatus.active)
                .order_by(MfSipPlan.updated_at)
                .limit(batch_size * 3)
            )
        ).scalars()
    )
    processed = 0
    completed = 0
    for plan in plans:
        pending = _get_pending_switch(plan)
        if not pending or pending.get("state") != "instruction_submitted":
            continue
        processed += 1
        if processed > batch_size:
            break
        if await _sync_mandate_switch_instruction(session, plan):
            completed += 1
    return {"processed": processed, "completed": completed}
