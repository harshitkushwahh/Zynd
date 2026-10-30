"""Zynd-only OTP consent before nominee add/remove in Settings (not Cybrilla)."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.login_sms_service import mask_phone
from app.application.consent.consent_service import ConsentAcceptContext, record_acceptance
from app.application.identity.otp_app_service import request_otp, verify_otp
from app.application.identity.otp_purposes import OtpPurpose
from app.application.kyc.errors import KycError
from app.application.ports.otp_gateway import OtpCooldownError, OtpRateLimitError
from app.domain.consent.keys import KYC_NOMINEE_UPDATE_AUTHORIZATION
from app.infrastructure.persistence.models import User


def nominee_settings_otp_identifier(user_id: uuid.UUID) -> str:
    return str(user_id)


async def send_settings_nominee_consent_otp(
    *,
    user: User,
    ip: str | None = None,
) -> dict[str, Any]:
    if not user.phone_verified_at or not user.phone:
        raise KycError(
            "Verify your mobile number in account settings before updating nominees.",
            "phone_not_verified",
            409,
        )

    try:
        otp_meta = await request_otp(
            OtpPurpose.settings_nominee_update,
            nominee_settings_otp_identifier(user.id),
            ip=ip,
            destination=user.phone,
        )
    except OtpCooldownError as exc:
        raise KycError(
            "Please wait before requesting another code.",
            "otp_cooldown",
            429,
        ) from exc
    except OtpRateLimitError as exc:
        raise KycError(str(exc), "otp_rate_limited", 429) from exc

    return {
        **otp_meta,
        "masked_mobile": mask_phone(user.phone, user.country_code),
    }


async def verify_settings_nominee_consent_otp(
    session: AsyncSession,
    *,
    user: User,
    otp: str,
    consent_context: ConsentAcceptContext,
) -> uuid.UUID:
    code = (otp or "").strip()
    if not code:
        raise KycError("OTP is required.", "invalid_otp", 400)

    verified = await verify_otp(
        OtpPurpose.settings_nominee_update,
        nominee_settings_otp_identifier(user.id),
        code,
    )
    if not verified:
        raise KycError("Invalid or expired OTP.", "invalid_otp", 400)

    record = await record_acceptance(
        session,
        user=user,
        definition_key=KYC_NOMINEE_UPDATE_AUTHORIZATION,
        context=ConsentAcceptContext(
            source=consent_context.source or "settings_nominee",
            ip=consent_context.ip,
            user_agent=consent_context.user_agent,
            metadata={
                "otp_purpose": OtpPurpose.settings_nominee_update.value,
                "otp_identifier": nominee_settings_otp_identifier(user.id),
                **(consent_context.metadata or {}),
            },
        ),
    )
    return record.id


__all__ = [
    "nominee_settings_otp_identifier",
    "send_settings_nominee_consent_otp",
    "verify_settings_nominee_consent_otp",
]
