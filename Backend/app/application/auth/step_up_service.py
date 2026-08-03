from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.audit_service import write_audit
from app.application.auth.errors import AuthError
from app.application.auth.login_sms_service import mask_phone
from app.application.auth.mfa_service import user_has_mfa
from app.application.identity.otp_app_service import request_otp
from app.application.identity.otp_purposes import OtpPurpose
from app.application.ports.otp_gateway import OtpCooldownError, OtpRateLimitError
from app.application.security.security_config_service import get_second_factor_policy
from app.infrastructure.persistence.models import AuditEventType, User


async def get_step_up_sms_options(db: AsyncSession, user: User) -> dict[str, Any]:
    policy = await get_second_factor_policy(db)
    available = bool(
        policy["step_up_sms_fallback_enabled"]
        and user_has_mfa(user)
        and user.phone_verified_at
        and user.phone
    )
    masked_phone = mask_phone(user.phone, user.country_code) if available and user.phone else None
    return {
        "sms_fallback_available": available,
        "masked_phone": masked_phone,
    }


async def send_step_up_sms(
    db: AsyncSession,
    *,
    user: User,
    ip: str | None,
) -> dict[str, Any]:
    policy = await get_second_factor_policy(db)
    if not policy["step_up_sms_fallback_enabled"]:
        raise AuthError("SMS fallback is not enabled.", "sms_fallback_disabled", 403)
    if not user_has_mfa(user):
        raise AuthError("Enable MFA before using SMS step-up.", "mfa_not_enrolled", 400)
    if not user.phone_verified_at or not user.phone:
        raise AuthError(
            "SMS verification is unavailable for this account.",
            "sms_fallback_unavailable",
            400,
        )

    try:
        meta = await request_otp(
            OtpPurpose.step_up_sms,
            str(user.id),
            ip=ip,
            destination=user.phone,
        )
    except OtpCooldownError as exc:
        raise AuthError(
            "Please wait before requesting another code.",
            "otp_cooldown",
            429,
            metadata={"retry_after_seconds": exc.retry_after_seconds},
        ) from exc
    except OtpRateLimitError as exc:
        raise AuthError(str(exc), "rate_limited", 429) from exc

    await write_audit(
        db,
        event_type=AuditEventType.step_up_sms_sent,
        user_id=user.id,
        ip=ip,
        metadata={"context": "step_up"},
    )
    return {
        **meta,
        "masked_phone": mask_phone(user.phone, user.country_code),
    }
