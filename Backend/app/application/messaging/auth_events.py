from __future__ import annotations

from typing import Any
from uuid import UUID

from app.application.messaging.scheduled_events import schedule_domain_event
from app.application.messaging.streams import STREAM_AUTH, STREAM_SECURITY
from app.domain.auth.events import (
    LoginFailedPayload,
    LoginSucceededPayload,
    RefreshReuseDetectedPayload,
    SecurityReviewFlaggedPayload,
    login_failed_event,
    login_succeeded_event,
    refresh_reuse_detected_event,
    security_review_flagged_event,
)


def schedule_login_succeeded(
    *,
    user_id: UUID,
    email: str,
    ip: str | None,
    device_id: UUID,
    device_label: str,
    is_new_device: bool,
    velocity_flag: dict[str, Any] | None,
    provider: str | None = None,
    login_method: str | None = None,
) -> None:
    schedule_domain_event(
        STREAM_AUTH,
        login_succeeded_event(
            LoginSucceededPayload(
                user_id=user_id,
                email=email,
                ip=ip,
                device_id=device_id,
                device_label=device_label,
                is_new_device=is_new_device,
                velocity_flag=velocity_flag,
                provider=provider,
                login_method=login_method,
            )
        ),
    )


def schedule_login_failed(
    *,
    email: str,
    user_id: UUID | None,
    ip: str | None,
    reason: str,
) -> None:
    schedule_domain_event(
        STREAM_AUTH,
        login_failed_event(
            LoginFailedPayload(
                email=email,
                user_id=user_id,
                ip=ip,
                reason=reason,
            )
        ),
    )


def schedule_security_review_flagged(
    *,
    user_id: UUID,
    reason: str,
    metadata: dict[str, Any] | None = None,
) -> None:
    schedule_domain_event(
        STREAM_SECURITY,
        security_review_flagged_event(
            SecurityReviewFlaggedPayload(
                user_id=user_id,
                reason=reason,
                metadata=metadata,
            )
        ),
    )


def schedule_refresh_reuse_detected(*, user_id: UUID, email: str) -> None:
    schedule_domain_event(
        STREAM_AUTH,
        refresh_reuse_detected_event(
            RefreshReuseDetectedPayload(user_id=user_id, email=email)
        ),
    )
