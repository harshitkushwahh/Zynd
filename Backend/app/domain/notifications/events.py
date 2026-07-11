from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.domain.shared.event_factory import build_domain_event
from app.domain.shared.events import DomainEvent


class NotificationEventType:
    CREATED = "notification.created"


class NotificationCreatedPayload(BaseModel):
    user_id: UUID
    user_email: str
    category: str
    notification_type: str
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1)
    metadata: dict[str, Any] | None = None
    idempotency_key: str | None = Field(default=None, max_length=128)
    email_subject: str | None = Field(default=None, max_length=200)


def notification_created_event(payload: NotificationCreatedPayload) -> DomainEvent:
    aggregate_id = str(payload.user_id)
    return build_domain_event(
        event_type=NotificationEventType.CREATED,
        aggregate_id=aggregate_id,
        aggregate_type="user",
        payload=payload,
    )
