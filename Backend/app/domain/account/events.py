from __future__ import annotations

from pydantic import BaseModel, Field

from app.application.identity.otp_purposes import OtpChannel, OtpPurpose
from app.domain.shared.event_factory import build_domain_event
from app.domain.shared.events import DomainEvent


class AccountEventType:
    OTP_REQUESTED = "auth.otp.requested"
    SECURITY_EMAIL_REQUESTED = "security.email.requested"


class OtpRequestedPayload(BaseModel):
    purpose: OtpPurpose
    identifier: str
    destination: str
    storage_key: str
    channel: OtpChannel


class SecurityEmailRequestedPayload(BaseModel):
    to_email: str
    subject: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1)


def otp_requested_event(payload: OtpRequestedPayload) -> DomainEvent:
    return build_domain_event(
        event_type=AccountEventType.OTP_REQUESTED,
        aggregate_id=payload.identifier,
        aggregate_type="otp",
        payload=payload,
    )


def security_email_requested_event(payload: SecurityEmailRequestedPayload) -> DomainEvent:
    return build_domain_event(
        event_type=AccountEventType.SECURITY_EMAIL_REQUESTED,
        aggregate_id=payload.to_email,
        aggregate_type="user_email",
        payload=payload,
    )
