"""Account-level user notifications (settings, profile updates)."""

from __future__ import annotations

from uuid import UUID

from app.application.notifications.notification_service import schedule_user_notification
from app.application.notifications.types import NotificationType
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.notification_models import NotificationCategory


def notify_account_settings_changed(
    *,
    user_id: UUID,
    user_email: str,
    category: NotificationCategory,
) -> None:
    label = category.value.replace("_", " ")
    schedule_user_notification(
        user_id=user_id,
        user_email=user_email,
        notification_type=NotificationType.ACCOUNT_SETTINGS_CHANGED,
        title="Notification preferences updated",
        body=f"Your {label} notification preferences were updated.",
        metadata={"category": category.value},
    )


def notify_profile_image_updated(*, user: User, document_id: UUID) -> None:
    schedule_user_notification(
        user_id=user.id,
        user_email=user.email,
        notification_type=NotificationType.ACCOUNT_PROFILE_IMAGE_UPDATED,
        title="Profile photo updated",
        body="Your profile photo was updated successfully.",
        metadata={"document_id": str(document_id)},
        idempotency_key=f"account.profile_image.updated:{user.id}:{document_id}",
    )


__all__ = [
    "notify_account_settings_changed",
    "notify_profile_image_updated",
]
