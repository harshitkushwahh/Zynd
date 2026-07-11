"""Schedule KYC lifecycle notifications (Phase 3)."""

from __future__ import annotations

from app.application.notifications.notification_service import schedule_user_notification
from app.application.notifications.types import NotificationType
from app.infrastructure.persistence.models import User


def notify_kyc_initiated(*, user: User) -> None:
    schedule_user_notification(
        user_id=user.id,
        user_email=user.email,
        notification_type=NotificationType.KYC_INITIATED,
        title="KYC verification started",
        body=(
            "You started identity verification on ZYND. Complete your KYC journey "
            "to unlock investing features."
        ),
        idempotency_key=f"kyc.initiated:{user.id}",
        email_subject="Your ZYND KYC verification has started",
    )


def notify_kyc_under_review(*, user: User) -> None:
    schedule_user_notification(
        user_id=user.id,
        user_email=user.email,
        notification_type=NotificationType.KYC_UNDER_REVIEW,
        title="KYC submitted for review",
        body=(
            "Your KYC application was submitted and is now under review.\n\n"
            "We will notify you when verification is complete."
        ),
        idempotency_key=f"kyc.under_review:{user.id}",
        email_subject="Your ZYND KYC application is under review",
    )


def notify_kyc_completed(*, user: User) -> None:
    schedule_user_notification(
        user_id=user.id,
        user_email=user.email,
        notification_type=NotificationType.KYC_COMPLETED,
        title="KYC verification complete",
        body=(
            "Your identity verification is complete. You can now access investing features on ZYND."
        ),
        idempotency_key=f"kyc.completed:{user.id}",
        email_subject="Your ZYND KYC verification is complete",
    )


def notify_kyc_rejected(
    *,
    user: User,
    reason: str,
    doc_type: str,
) -> None:
    schedule_user_notification(
        user_id=user.id,
        user_email=user.email,
        notification_type=NotificationType.KYC_REJECTED,
        title="KYC document needs attention",
        body=(
            f"A KYC document ({doc_type.replace('_', ' ')}) was rejected during review.\n\n"
            f"Reason: {reason}\n\n"
            "Please sign in and resubmit the required documents."
        ),
        metadata={"doc_type": doc_type, "reason": reason},
        idempotency_key=f"kyc.rejected:{user.id}:{doc_type}",
        email_subject="Action required: ZYND KYC document rejected",
    )


__all__ = [
    "notify_kyc_completed",
    "notify_kyc_initiated",
    "notify_kyc_rejected",
    "notify_kyc_under_review",
]
