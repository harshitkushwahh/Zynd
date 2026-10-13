from __future__ import annotations

from app.application.identity.otp_purposes import (
    OtpChannel,
    OtpPurpose,
    build_otp_message,
    get_purpose_definition,
    resolve_purpose,
)
from app.application.messaging.otp_events import schedule_otp_requested
from app.infrastructure.otp.service import (
    OtpCooldownError,
    OtpRateLimitError,
    send_otp as _send_otp,
    verify_otp as _verify_otp,
)

__all__ = [
    "OtpCooldownError",
    "OtpPurpose",
    "OtpRateLimitError",
    "request_otp",
    "request_otp_mobile_and_email",
    "resend_otp",
    "schedule_otp_delivery",
    "verify_otp",
]


def schedule_otp_delivery(
    *,
    purpose: OtpPurpose,
    identifier: str,
    destination: str,
    storage_key: str,
    channel: OtpChannel,
) -> None:
    schedule_otp_requested(
        purpose=purpose,
        identifier=identifier,
        destination=destination,
        storage_key=storage_key,
        channel=channel,
    )


async def request_otp(
    purpose: str | OtpPurpose,
    identifier: str,
    *,
    ip: str | None = None,
    destination: str | None = None,
) -> dict[str, int]:
    resolved = resolve_purpose(purpose)
    definition = get_purpose_definition(resolved)
    delivery_target = destination or identifier

    meta = await _send_otp(definition.storage_key, identifier, ip=ip)
    schedule_otp_delivery(
        purpose=resolved,
        identifier=identifier,
        destination=delivery_target,
        storage_key=definition.storage_key,
        channel=definition.channel,
    )
    return meta


async def request_otp_mobile_and_email(
    purpose: str | OtpPurpose,
    identifier: str,
    *,
    ip: str | None = None,
    mobile: str,
    email: str | None = None,
) -> dict[str, int]:
    """Generate one OTP and deliver the same code via SMS and optional email."""
    resolved = resolve_purpose(purpose)
    definition = get_purpose_definition(resolved)
    mobile_target = mobile.strip()
    if not mobile_target:
        raise ValueError("mobile is required")

    meta = await _send_otp(definition.storage_key, identifier, ip=ip)
    schedule_otp_delivery(
        purpose=resolved,
        identifier=identifier,
        destination=mobile_target,
        storage_key=definition.storage_key,
        channel="sms",
    )
    email_target = email.strip() if email else None
    if email_target:
        schedule_otp_delivery(
            purpose=resolved,
            identifier=identifier,
            destination=email_target,
            storage_key=definition.storage_key,
            channel="email",
        )
    return meta


async def resend_otp(
    purpose: str | OtpPurpose,
    identifier: str,
    *,
    ip: str | None = None,
    destination: str | None = None,
) -> dict[str, int]:
    return await request_otp(
        purpose,
        identifier,
        ip=ip,
        destination=destination,
    )


async def verify_otp(purpose: str | OtpPurpose, identifier: str, code: str) -> bool:
    resolved = resolve_purpose(purpose)
    definition = get_purpose_definition(resolved)
    return await _verify_otp(definition.storage_key, identifier, code)
