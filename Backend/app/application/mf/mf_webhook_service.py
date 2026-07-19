from __future__ import annotations

import hashlib
import hmac
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.mf_fp_state import map_fp_mandate_status, map_fp_purchase_state, map_fp_purchase_state_to_checkout
from app.application.mf.mf_sip_plan_service import _apply_plan_state
from app.application.mf.mf_order_service import TERMINAL_STATUSES, _record_order_event
from app.application.referral.referral_investment_service import record_referral_investment_activity
from app.core.config import get_settings
from app.infrastructure.persistence.mf_transaction_models import (
    MfCheckout,
    MfFinprimWebhookEvent,
    MfMandate,
    MfOrder,
    MfSipPlan,
    MfWebhookProcessingStatus,
)
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.referral_models import ReferralInvestmentProduct

logger = logging.getLogger(__name__)

MF_PURCHASE_EVENT_PREFIX = "mf_purchase"
MF_PURCHASE_PLAN_EVENT_PREFIX = "mf_purchase_plan"
MANDATE_EVENT_PREFIX = "mandate"
PAYMENT_EVENT_PREFIX = "payment"


def verify_fp_webhook_signature(*, raw_body: bytes, signature_header: str | None, secret: str) -> bool:
    if not signature_header or ":" not in signature_header:
        return False
    _, signature = signature_header.split(":", 1)
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def _extract_event_object(payload: dict[str, Any]) -> dict[str, Any]:
    data = payload.get("data")
    if isinstance(data, dict):
        obj = data.get("object")
        if isinstance(obj, dict):
            return obj
    return {}


async def _find_order_for_purchase_object(
    session: AsyncSession,
    purchase_obj: dict[str, Any],
) -> MfOrder | None:
    fp_purchase_id = purchase_obj.get("id")
    if fp_purchase_id:
        order = await session.scalar(select(MfOrder).where(MfOrder.fp_purchase_id == str(fp_purchase_id)))
        if order:
            return order

    source_ref_id = purchase_obj.get("source_ref_id")
    if source_ref_id:
        try:
            order_id = UUID(str(source_ref_id))
        except ValueError:
            return None
        return await session.get(MfOrder, order_id)
    return None


async def _apply_purchase_state_to_order(
    session: AsyncSession,
    order: MfOrder,
    *,
    fp_state: str | None,
    source: str,
    payload: dict[str, Any] | None = None,
) -> bool:
    if order.status in TERMINAL_STATUSES:
        return False

    mapped = map_fp_purchase_state(fp_state)
    old_id = payload.get("old_id") if payload else None
    if old_id is not None and order.fp_purchase_old_id is None:
        try:
            order.fp_purchase_old_id = int(old_id)
        except (TypeError, ValueError):
            pass

    if mapped == order.status and fp_state == order.fp_state:
        return False

    previous = order.status.value
    order.fp_state = str(fp_state) if fp_state is not None else order.fp_state
    order.status = mapped
    if mapped.value == "SUCCEEDED":
        order.settled_at = datetime.now(timezone.utc)
        user = await session.get(User, order.user_id)
        if user:
            await record_referral_investment_activity(
                session,
                user=user,
                product=ReferralInvestmentProduct.mutual_fund,
                amount_inr=int(order.amount_inr),
            )
    elif mapped.value == "FAILED":
        order.failure_code = order.failure_code or "fp_terminal_failed"
        order.failure_reason = order.failure_reason or str(fp_state)

    await _record_order_event(
        session,
        order,
        from_status=previous,
        to_status=order.status.value,
        source=source,
        payload={"fp_state": order.fp_state, **(payload or {})},
    )

    if order.checkout_id:
        checkout = await session.get(MfCheckout, order.checkout_id)
        if checkout:
            checkout.status = map_fp_purchase_state_to_checkout(fp_state)
    return True


async def _handle_mf_purchase_event(session: AsyncSession, *, event_type: str, payload: dict[str, Any]) -> bool:
    purchase_obj = _extract_event_object(payload)
    if not purchase_obj:
        return False

    order = await _find_order_for_purchase_object(session, purchase_obj)
    if not order:
        logger.info("Finprim webhook %s: no matching order for purchase %s", event_type, purchase_obj.get("id"))
        return False

    if not order.fp_purchase_id and purchase_obj.get("id"):
        order.fp_purchase_id = str(purchase_obj["id"])

    fp_state = purchase_obj.get("state")
    if event_type.endswith("review_completed") and fp_state is None:
        fp_state = "pending"

    return await _apply_purchase_state_to_order(
        session,
        order,
        fp_state=str(fp_state) if fp_state is not None else order.fp_state,
        source="WEBHOOK",
        payload=purchase_obj,
    )


async def _handle_payment_event(session: AsyncSession, *, event_type: str, payload: dict[str, Any]) -> bool:
    payment_obj = _extract_event_object(payload)
    if not payment_obj:
        return False

    amc_order_ids = payment_obj.get("amc_order_ids") or []
    if not isinstance(amc_order_ids, list) or not amc_order_ids:
        return False

    changed = False
    for raw_old_id in amc_order_ids:
        try:
            old_id = int(raw_old_id)
        except (TypeError, ValueError):
            continue
        order = await session.scalar(select(MfOrder).where(MfOrder.fp_purchase_old_id == old_id))
        if not order:
            continue

        checkout = await session.get(MfCheckout, order.checkout_id) if order.checkout_id else None
        if checkout:
            if payment_obj.get("id") is not None and checkout.fp_payment_id is None:
                try:
                    checkout.fp_payment_id = int(payment_obj["id"])
                except (TypeError, ValueError):
                    pass
            upi = payment_obj.get("upi")
            if isinstance(upi, dict) and upi.get("uri"):
                checkout.token_url = str(upi["uri"])
            elif payment_obj.get("token_url"):
                checkout.token_url = str(payment_obj["token_url"])

        if event_type.endswith("success"):
            if await _apply_purchase_state_to_order(
                session,
                order,
                fp_state="successful",
                source="WEBHOOK",
                payload=payment_obj,
            ):
                changed = True
        elif event_type.endswith("failed"):
            if await _apply_purchase_state_to_order(
                session,
                order,
                fp_state="failed",
                source="WEBHOOK",
                payload=payment_obj,
            ):
                changed = True
        elif event_type.endswith("updated"):
            if checkout and checkout.token_url:
                changed = True
    return changed


async def _find_plan_for_plan_object(session: AsyncSession, plan_obj: dict[str, Any]) -> MfSipPlan | None:
    fp_plan_id = plan_obj.get("id")
    if fp_plan_id:
        plan = await session.scalar(select(MfSipPlan).where(MfSipPlan.fp_plan_id == str(fp_plan_id)))
        if plan:
            return plan
    source_ref_id = plan_obj.get("source_ref_id")
    if source_ref_id:
        try:
            plan_id = UUID(str(source_ref_id))
        except ValueError:
            return None
        return await session.get(MfSipPlan, plan_id)
    return None


async def _handle_mf_purchase_plan_event(session: AsyncSession, *, event_type: str, payload: dict[str, Any]) -> bool:
    plan_obj = _extract_event_object(payload)
    if not plan_obj:
        return False

    plan = await _find_plan_for_plan_object(session, plan_obj)
    if not plan:
        logger.info("Finprim webhook %s: no matching SIP plan for %s", event_type, plan_obj.get("id"))
        return False

    if not plan.fp_plan_id and plan_obj.get("id"):
        plan.fp_plan_id = str(plan_obj["id"])

    fp_state = plan_obj.get("state")
    if event_type.endswith("review_completed") and fp_state is None:
        fp_state = "review_completed"

    return await _apply_plan_state(session, plan, fp_state=str(fp_state) if fp_state is not None else plan.fp_state, source="WEBHOOK")


async def _find_mandate_for_mandate_object(session: AsyncSession, mandate_obj: dict[str, Any]) -> MfMandate | None:
    fp_mandate_id = mandate_obj.get("id")
    if fp_mandate_id is None:
        return None
    try:
        mandate_old_id = int(fp_mandate_id)
    except (TypeError, ValueError):
        return None
    return await session.scalar(select(MfMandate).where(MfMandate.fp_mandate_id == mandate_old_id))


async def _handle_mandate_event(session: AsyncSession, *, event_type: str, payload: dict[str, Any]) -> bool:
    mandate_obj = _extract_event_object(payload)
    if not mandate_obj:
        return False

    mandate = await _find_mandate_for_mandate_object(session, mandate_obj)
    if not mandate:
        logger.info("Finprim webhook %s: no matching mandate for %s", event_type, mandate_obj.get("id"))
        return False

    fp_status = mandate_obj.get("mandate_status") or mandate_obj.get("status")
    if event_type.endswith("approved"):
        fp_status = fp_status or "APPROVED"
    elif event_type.endswith("rejected") or event_type.endswith("failed"):
        fp_status = fp_status or "REJECTED"

    from app.infrastructure.persistence.mf_transaction_models import MfMandateStatus

    mapped = map_fp_mandate_status(str(fp_status) if fp_status is not None else None)
    if mapped == mandate.status and fp_status == mandate.fp_mandate_status:
        return False

    mandate.fp_mandate_status = str(fp_status) if fp_status is not None else mandate.fp_mandate_status
    mandate.status = mapped
    if mapped == MfMandateStatus.approved and mandate.approved_at is None:
        mandate.approved_at = datetime.now(timezone.utc)
    elif mapped == MfMandateStatus.failed:
        mandate.failure_code = mandate.failure_code or "fp_mandate_failed"
        mandate.failure_reason = mandate.failure_reason or str(fp_status)
    await session.flush()
    return True


async def _dispatch_finprim_event(
    session: AsyncSession,
    *,
    event_type: str,
    payload: dict[str, Any],
) -> bool:
    if event_type.startswith(MF_PURCHASE_EVENT_PREFIX) and not event_type.startswith(MF_PURCHASE_PLAN_EVENT_PREFIX):
        return await _handle_mf_purchase_event(session, event_type=event_type, payload=payload)
    if event_type.startswith(MF_PURCHASE_PLAN_EVENT_PREFIX):
        return await _handle_mf_purchase_plan_event(session, event_type=event_type, payload=payload)
    if event_type.startswith(MANDATE_EVENT_PREFIX):
        return await _handle_mandate_event(session, event_type=event_type, payload=payload)
    if event_type.startswith(PAYMENT_EVENT_PREFIX):
        return await _handle_payment_event(session, event_type=event_type, payload=payload)
    return False


async def replay_finprim_webhook_event(session: AsyncSession, *, event_id: int) -> dict[str, Any]:
    event_row = await session.get(MfFinprimWebhookEvent, event_id)
    if not event_row:
        raise ValueError("Webhook event not found")

    event_type = event_row.event_type
    payload = event_row.payload
    try:
        handled = await _dispatch_finprim_event(session, event_type=event_type, payload=payload)
        if not handled and not (
            event_type.startswith(MF_PURCHASE_EVENT_PREFIX)
            or event_type.startswith(MF_PURCHASE_PLAN_EVENT_PREFIX)
            or event_type.startswith(MANDATE_EVENT_PREFIX)
            or event_type.startswith(PAYMENT_EVENT_PREFIX)
        ):
            event_row.processing_status = MfWebhookProcessingStatus.ignored
        else:
            event_row.processing_status = MfWebhookProcessingStatus.processed
        event_row.processing_error = None
        event_row.processed_at = datetime.now(timezone.utc)
        await session.flush()
        return {
            "status": event_row.processing_status.value,
            "event_id": event_row.id,
            "event_type": event_type,
            "handled": handled,
        }
    except Exception as exc:
        logger.exception("Finprim webhook replay failed event_id=%s type=%s", event_id, event_type)
        event_row.processing_status = MfWebhookProcessingStatus.failed
        event_row.processing_error = str(exc)
        event_row.processed_at = datetime.now(timezone.utc)
        await session.flush()
        raise


async def process_finprim_webhook(
    session: AsyncSession,
    *,
    raw_body: bytes,
    signature_header: str | None,
    payload: dict[str, Any],
) -> dict[str, Any]:
    settings = get_settings()
    if settings.resolved_fp_webhook_verify_enabled:
        from app.application.integrations.integration_runtime import get_finprim_runtime

        secret = get_finprim_runtime().webhook_secret.strip()
        if not secret:
            raise ValueError("FP_WEBHOOK_SECRET is required when webhook verification is enabled")
        if not verify_fp_webhook_signature(raw_body=raw_body, signature_header=signature_header, secret=secret):
            raise PermissionError("Invalid Finprim webhook signature")

    event_id = str(payload.get("id") or "")
    event_type = str(payload.get("type") or "")
    if not event_id or not event_type:
        raise ValueError("Webhook payload missing id or type")

    existing = await session.scalar(
        select(MfFinprimWebhookEvent).where(MfFinprimWebhookEvent.fp_event_id == event_id)
    )
    if existing:
        return {"status": "duplicate", "event_id": event_id, "event_type": event_type}

    event_row = MfFinprimWebhookEvent(
        fp_event_id=event_id,
        event_type=event_type,
        payload=payload,
        processing_status=MfWebhookProcessingStatus.received,
    )
    session.add(event_row)
    await session.flush()

    try:
        handled = await _dispatch_finprim_event(session, event_type=event_type, payload=payload)
        if not handled and not (
            event_type.startswith(MF_PURCHASE_EVENT_PREFIX)
            or event_type.startswith(MF_PURCHASE_PLAN_EVENT_PREFIX)
            or event_type.startswith(MANDATE_EVENT_PREFIX)
            or event_type.startswith(PAYMENT_EVENT_PREFIX)
        ):
            event_row.processing_status = MfWebhookProcessingStatus.ignored
            event_row.processed_at = datetime.now(timezone.utc)
            await session.flush()
            return {"status": "ignored", "event_id": event_id, "event_type": event_type}

        event_row.processing_status = MfWebhookProcessingStatus.processed
        event_row.processed_at = datetime.now(timezone.utc)
        await session.flush()
        return {
            "status": "processed" if handled else "received",
            "event_id": event_id,
            "event_type": event_type,
            "handled": handled,
        }
    except Exception as exc:
        logger.exception("Finprim webhook processing failed event_id=%s type=%s", event_id, event_type)
        event_row.processing_status = MfWebhookProcessingStatus.failed
        event_row.processing_error = str(exc)
        event_row.processed_at = datetime.now(timezone.utc)
        await session.flush()
        raise
