"""Schedule risk profile completion notifications."""

from __future__ import annotations

from uuid import UUID

from app.application.notifications.notification_service import schedule_user_notification
from app.application.notifications.types import NotificationType
from app.infrastructure.persistence.models import User


def notify_risk_profile_completed(
    *,
    user: User,
    assessment_id: UUID,
    score: int,
    tier: str,
    title: str,
    message_body: str,
) -> None:
    schedule_user_notification(
        user_id=user.id,
        user_email=user.email,
        notification_type=NotificationType.INVEST_RISK_PROFILE_COMPLETED,
        title=title,
        body=message_body,
        metadata={
            "assessment_id": str(assessment_id),
            "score": score,
            "tier": tier,
        },
        idempotency_key=f"invest.risk_profile.completed:{assessment_id}",
        email_subject=f"Your ZYND risk profile: {title}",
    )
