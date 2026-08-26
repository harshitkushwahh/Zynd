"""Finprim MF purchase / checkout state → Zynd status mapping (live ONDC flow)."""

from __future__ import annotations

from app.infrastructure.persistence.mf_transaction_models import MfCheckoutStatus, MfOrderStatus

# Terminal success — units allotted / purchase complete.
FP_SUCCESS_STATES = frozenset({"successful", "succeeded", "completed"})

# Terminal failure.
FP_FAILURE_STATES = frozenset({"failed", "cancelled", "rejected", "expired", "reversed"})

# Awaiting investor consent + payment creation (post review_completed).
FP_PAYMENT_PENDING_STATES = frozenset({"pending", "payment_pending", "awaiting_payment", "created"})

# Payment link shown; user completing UPI / netbanking.
FP_SUBMITTED_STATES = frozenset({"submitted"})

# In-flight: review, confirm, AMC submission, allotment.
FP_PROCESSING_STATES = frozenset(
    {
        "under_review",
        "confirmed",
        "payment_confirmed",
        "submitted_to_amc",
        "units_allocated",
        "pending_authorization",
        "review_completed",
    }
)


def map_fp_purchase_state(fp_state: str | None) -> MfOrderStatus:
    normalized = (fp_state or "").strip().lower()
    if not normalized:
        return MfOrderStatus.processing
    if normalized in FP_SUCCESS_STATES:
        return MfOrderStatus.succeeded
    if normalized in FP_FAILURE_STATES:
        return MfOrderStatus.failed
    if normalized in FP_PAYMENT_PENDING_STATES:
        return MfOrderStatus.payment_pending
    if normalized in FP_SUBMITTED_STATES:
        return MfOrderStatus.submitted
    if normalized in FP_PROCESSING_STATES:
        return MfOrderStatus.processing
    return MfOrderStatus.processing


def map_fp_purchase_state_to_checkout(fp_state: str | None) -> MfCheckoutStatus:
    order_status = map_fp_purchase_state(fp_state)
    return _ORDER_TO_CHECKOUT_STATUS[order_status]


_ORDER_TO_CHECKOUT_STATUS: dict[MfOrderStatus, MfCheckoutStatus] = {
    MfOrderStatus.pending: MfCheckoutStatus.pending,
    MfOrderStatus.payment_pending: MfCheckoutStatus.payment_pending,
    MfOrderStatus.submitted: MfCheckoutStatus.submitted,
    MfOrderStatus.processing: MfCheckoutStatus.processing,
    MfOrderStatus.succeeded: MfCheckoutStatus.succeeded,
    MfOrderStatus.failed: MfCheckoutStatus.failed,
    MfOrderStatus.cancelled: MfCheckoutStatus.cancelled,
}

FP_PLAN_REVIEW_STATES = frozenset({"created", "under_review"})
FP_PLAN_CONSENT_STATES = frozenset({"review_completed"})
FP_PLAN_ACTIVE_STATES = frozenset({"active", "submitted"})
FP_PLAN_FAILURE_STATES = frozenset({"failed", "rejected", "expired"})
FP_PLAN_CANCELLED_STATES = frozenset({"cancelled", "completed"})


def map_fp_plan_state(fp_state: str | None) -> "MfSipPlanStatus":
    from app.infrastructure.persistence.mf_transaction_models import MfSipPlanStatus

    normalized = (fp_state or "").strip().lower()
    if not normalized:
        return MfSipPlanStatus.pending
    if normalized in FP_PLAN_CANCELLED_STATES:
        return MfSipPlanStatus.cancelled
    if normalized in FP_PLAN_FAILURE_STATES:
        return MfSipPlanStatus.failed
    if normalized in FP_PLAN_ACTIVE_STATES:
        return MfSipPlanStatus.active
    if normalized in FP_PLAN_CONSENT_STATES:
        return MfSipPlanStatus.consent_pending
    if normalized in FP_PLAN_REVIEW_STATES or normalized == "confirmed":
        return MfSipPlanStatus.review
    return MfSipPlanStatus.review


def map_fp_redemption_state_to_order(fp_state: str | None) -> MfOrderStatus:
    normalized = (fp_state or "").strip().lower()
    if not normalized:
        return MfOrderStatus.processing
    if normalized in {"successful", "succeeded"}:
        return MfOrderStatus.succeeded
    if normalized in {"failed", "rejected", "expired"}:
        return MfOrderStatus.failed
    if normalized == "cancelled":
        return MfOrderStatus.cancelled
    if normalized == "submitted":
        return MfOrderStatus.submitted
    if normalized in {"confirmed", "processing", "review", "under_review"}:
        return MfOrderStatus.processing
    if normalized in {"pending", "review_completed", "created"}:
        return MfOrderStatus.payment_pending
    return MfOrderStatus.processing


FP_MANDATE_APPROVED_STATES = frozenset(
    {"approved", "APPROVED", "active", "ACTIVE", "registered", "REGISTERED", "success", "SUCCESS", "authorized", "AUTHORIZED"}
)
FP_MANDATE_AUTH_PENDING_STATES = frozenset(
    {
        "created",
        "CREATED",
        "submitted",
        "SUBMITTED",
        "pending",
        "PENDING",
        "auth_pending",
        "AUTH_PENDING",
        "initiated",
        "INITIATED",
    }
)
FP_MANDATE_FAILURE_STATES = frozenset({"rejected", "REJECTED", "failed", "FAILED"})
FP_MANDATE_CANCELLED_STATES = frozenset({"cancelled", "CANCELLED"})


def map_fp_mandate_status(fp_status: str | None) -> "MfMandateStatus":
    from app.infrastructure.persistence.mf_transaction_models import MfMandateStatus

    normalized = (fp_status or "").strip()
    if not normalized:
        return MfMandateStatus.pending
    if normalized in FP_MANDATE_APPROVED_STATES or normalized.lower() in {
        state.lower() for state in FP_MANDATE_APPROVED_STATES
    }:
        return MfMandateStatus.approved
    if normalized in FP_MANDATE_CANCELLED_STATES or normalized.lower() == "cancelled":
        return MfMandateStatus.cancelled
    if normalized in FP_MANDATE_FAILURE_STATES or normalized.lower() in {"rejected", "failed"}:
        return MfMandateStatus.failed
    if normalized in FP_MANDATE_AUTH_PENDING_STATES or normalized.lower() in {
        state.lower() for state in FP_MANDATE_AUTH_PENDING_STATES
    }:
        return MfMandateStatus.auth_pending
    return MfMandateStatus.pending
