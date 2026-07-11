"""Application port for OTP request/verify (Phase 4 unified API)."""

from __future__ import annotations

from app.application.identity.otp_app_service import (
    OtpCooldownError,
    OtpRateLimitError,
    request_otp,
    resend_otp,
    verify_otp,
)
from app.application.identity.otp_purposes import OtpPurpose
from app.infrastructure.otp.service import generate_otp

__all__ = [
    "OtpCooldownError",
    "OtpPurpose",
    "OtpRateLimitError",
    "generate_otp",
    "request_otp",
    "resend_otp",
    "send_otp",
    "verify_otp",
]


async def send_otp(
    purpose: str | OtpPurpose,
    identifier: str,
    *,
    ip: str | None = None,
    destination: str | None = None,
) -> dict[str, int]:
    """Backward-compatible alias for `request_otp`."""
    return await request_otp(purpose, identifier, ip=ip, destination=destination)
