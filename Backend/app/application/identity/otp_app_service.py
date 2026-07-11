from __future__ import annotations

from app.application.identity.otp_purposes import OtpPurpose, build_otp_message, get_purpose_definition, resolve_purpose
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
    "resend_otp",
    "verify_otp",
]


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
    schedule_otp_requested(
        purpose=resolved,
        identifier=identifier,
        destination=delivery_target,
        storage_key=definition.storage_key,
        channel=definition.channel,
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
