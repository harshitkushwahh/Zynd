from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.domain.shared.event_factory import build_domain_event
from app.domain.shared.events import DomainEvent


class AuthEventType:
    LOGIN_SUCCEEDED = "auth.login.succeeded"
    LOGIN_FAILED = "auth.login.failed"
    REFRESH_REUSE_DETECTED = "auth.refresh_reuse.detected"


class SecurityEventType:
    REVIEW_FLAGGED = "security.review.flagged"


class LoginSucceededPayload(BaseModel):
    user_id: UUID
    email: str
    ip: str | None = None
    device_id: UUID
    device_label: str
    is_new_device: bool
    velocity_flag: dict[str, Any] | None = None
    provider: str | None = None


class LoginFailedPayload(BaseModel):
    email: str
    user_id: UUID | None = None
    ip: str | None = None
    reason: str


class RefreshReuseDetectedPayload(BaseModel):
    user_id: UUID
    email: str


class SecurityReviewFlaggedPayload(BaseModel):
    user_id: UUID
    reason: str
    metadata: dict[str, Any] | None = None


def login_succeeded_event(payload: LoginSucceededPayload) -> DomainEvent:
    return build_domain_event(
        event_type=AuthEventType.LOGIN_SUCCEEDED,
        aggregate_id=str(payload.user_id),
        aggregate_type="user",
        payload=payload,
    )


def login_failed_event(payload: LoginFailedPayload) -> DomainEvent:
    aggregate_id = str(payload.user_id) if payload.user_id else payload.email
    return build_domain_event(
        event_type=AuthEventType.LOGIN_FAILED,
        aggregate_id=aggregate_id,
        aggregate_type="user",
        payload=payload,
    )


def refresh_reuse_detected_event(payload: RefreshReuseDetectedPayload) -> DomainEvent:
    return build_domain_event(
        event_type=AuthEventType.REFRESH_REUSE_DETECTED,
        aggregate_id=str(payload.user_id),
        aggregate_type="user",
        payload=payload,
    )


def security_review_flagged_event(payload: SecurityReviewFlaggedPayload) -> DomainEvent:
    return build_domain_event(
        event_type=SecurityEventType.REVIEW_FLAGGED,
        aggregate_id=str(payload.user_id),
        aggregate_type="user",
        payload=payload,
    )
