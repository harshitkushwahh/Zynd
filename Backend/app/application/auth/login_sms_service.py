from __future__ import annotations

import re
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.audit_service import write_audit
from app.application.auth.auth_session_context import complete_authenticated_login
from app.application.auth.errors import AuthError
from app.application.auth.second_factor_verification_service import verify_second_factor
from app.application.auth.user_service import get_user_by_id
from app.application.identity.otp_app_service import request_otp
from app.application.identity.otp_purposes import OtpPurpose
from app.application.ports.otp_gateway import OtpCooldownError, OtpRateLimitError
from app.application.security.security_config_service import get_second_factor_policy
from app.core.config import Settings, get_settings
from app.core.redis import get_redis
from app.infrastructure.persistence.models import AuditEventType, User
from app.infrastructure.security.pending_auth import (
    consume_pending_auth,
    generate_pending_token,
    peek_pending_auth,
    store_pending_auth,
)
from app.infrastructure.security.rate_limit import check_rate_limit

MFA_LOGIN_SMS_MAX_SENDS = 2


def _mfa_login_sms_send_key(mfa_token: str) -> str:
    from app.infrastructure.security.pending_auth import _hash_token

    return f"mfa_login_sms_sends:{_hash_token(mfa_token)}"


async def _get_mfa_login_sms_send_count(mfa_token: str) -> int:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    raw = await redis.get(_mfa_login_sms_send_key(mfa_token))
    return int(raw) if raw else 0


async def _record_mfa_login_sms_send(mfa_token: str, ttl_seconds: int) -> int:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    key = _mfa_login_sms_send_key(mfa_token)
    count = await _get_mfa_login_sms_send_count(mfa_token) + 1
    await redis.setex(key, ttl_seconds, str(count))
    return count


async def enrich_mfa_login_pending(
    db: AsyncSession,
    user: User,
    pending: dict[str, Any],
) -> dict[str, Any]:
    policy = await get_second_factor_policy(db)
    sms_available = bool(
        policy["step_up_sms_fallback_enabled"]
        and user.phone_verified_at
        and user.phone
    )
    pending["sms_fallback_available"] = sms_available
    if sms_available and user.phone:
        pending["masked_phone"] = mask_phone(user.phone, user.country_code)
    return pending


async def send_mfa_login_sms(
    db: AsyncSession,
    *,
    mfa_token: str,
    ip: str | None,
) -> dict[str, Any]:
    from app.application.auth.mfa_service import user_has_mfa

    policy = await get_second_factor_policy(db)
    if not policy["step_up_sms_fallback_enabled"]:
        raise AuthError("SMS fallback is not enabled.", "sms_fallback_disabled", 403)

    payload = await peek_pending_auth("mfa_login", mfa_token)
    if not payload:
        raise AuthError("MFA session expired. Sign in again.", "mfa_expired", 410)

    user = await get_user_by_id(db, UUID(payload["user_id"]))
    if not user or not user_has_mfa(user):
        raise AuthError("Invalid MFA session.", "mfa_invalid", 400)
    if not user.phone_verified_at or not user.phone:
        raise AuthError(
            "SMS verification is unavailable for this account.",
            "sms_fallback_unavailable",
            400,
        )

    settings = get_settings()
    send_count = await _get_mfa_login_sms_send_count(mfa_token)
    if send_count >= MFA_LOGIN_SMS_MAX_SENDS:
        raise AuthError(
            "SMS send limit reached for this sign-in. Use your authenticator or try again later.",
            "sms_send_limit",
            429,
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

    await _record_mfa_login_sms_send(mfa_token, settings.mfa_pending_ttl_seconds)
    await write_audit(
        db,
        event_type=AuditEventType.step_up_sms_sent,
        user_id=user.id,
        ip=ip,
        metadata={"context": "mfa_login"},
    )
    return {
        **meta,
        "masked_phone": mask_phone(user.phone, user.country_code),
    }


def mask_phone(phone: str, country_code: str = "IN") -> str:
    digits = re.sub(r"\D", "", phone)
    if len(digits) < 4:
        return "••••"
    last4 = digits[-4:]
    if country_code == "IN" and len(digits) >= 10:
        return f"+91 •••• ••{last4}"
    if phone.startswith("+"):
        return f"+{'•' * max(len(digits) - 4, 4)} ••{last4}"
    return f"•••• ••{last4}"


async def maybe_sms_otp_pending_login(
    db: AsyncSession,
    user: User,
    *,
    device_fingerprint: str,
    user_agent: str | None,
    admin_client: bool = False,
    ip: str | None = None,
) -> dict[str, Any] | None:
    policy = await get_second_factor_policy(db)
    if not policy["login_sms_otp_when_mfa_disabled"]:
        return None
    if not user.phone_verified_at or not user.phone:
        return None

    settings = get_settings()
    login_token = generate_pending_token()
    await store_pending_auth(
        "login_sms",
        login_token,
        {
            "user_id": str(user.id),
            "device_fingerprint": device_fingerprint,
            "user_agent": user_agent,
            "admin_client": admin_client,
        },
        settings.mfa_pending_ttl_seconds,
    )

    retry_after_seconds = 0
    expires_in = settings.mfa_pending_ttl_seconds
    try:
        meta = await request_otp(
            OtpPurpose.login_second_factor,
            str(user.id),
            ip=ip,
            destination=user.phone,
        )
        retry_after_seconds = meta.get("retry_after_seconds", 30)
        expires_in = meta.get("expires_in", settings.mfa_pending_ttl_seconds)
        await write_audit(
            db,
            event_type=AuditEventType.login_sms_otp_sent,
            user_id=user.id,
            ip=ip,
        )
    except OtpCooldownError as exc:
        retry_after_seconds = exc.retry_after_seconds
    except OtpRateLimitError as exc:
        raise AuthError(str(exc), "rate_limited", 429) from exc

    return {
        "next": "sms_otp_required",
        "login_token": login_token,
        "masked_phone": mask_phone(user.phone, user.country_code),
        "expires_in": expires_in,
        "retry_after_seconds": retry_after_seconds,
    }


async def resend_login_sms_otp(
    db: AsyncSession,
    *,
    login_token: str,
    ip: str | None,
) -> dict[str, int]:
    payload = await peek_pending_auth("login_sms", login_token)
    if not payload:
        raise AuthError("Sign-in session expired. Start again.", "login_sms_expired", 410)

    user = await get_user_by_id(db, UUID(payload["user_id"]))
    if not user or not user.phone:
        raise AuthError("Invalid sign-in session.", "login_sms_invalid", 400)

    try:
        meta = await request_otp(
            OtpPurpose.login_second_factor,
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
        event_type=AuditEventType.login_sms_otp_sent,
        user_id=user.id,
        ip=ip,
        metadata={"resent": True},
    )
    return meta


async def verify_sms_login(
    db: AsyncSession,
    *,
    login_token: str,
    otp: str,
    ip: str | None,
    settings: Settings | None = None,
) -> dict[str, Any]:
    settings = settings or get_settings()
    payload = await consume_pending_auth("login_sms", login_token)
    if not payload:
        raise AuthError("Sign-in session expired. Start again.", "login_sms_expired", 410)

    user_id = UUID(payload["user_id"])
    if not await check_rate_limit(f"login_sms:{user_id}", 5, 600):
        raise AuthError("Too many verification attempts. Try again later.", "rate_limited", 429)

    user = await get_user_by_id(db, user_id)
    if not user:
        raise AuthError("Invalid sign-in session.", "login_sms_invalid", 400)

    result = await verify_second_factor(
        db,
        user=user,
        sms_otp=otp,
        sms_purpose=OtpPurpose.login_second_factor,
    )
    if not result.verified:
        await write_audit(
            db,
            event_type=AuditEventType.login_failure,
            user_id=user.id,
            ip=ip,
            metadata={"reason": "invalid_login_sms_otp"},
        )
        raise AuthError("Invalid or expired verification code.", "invalid_otp", 401)

    await write_audit(
        db,
        event_type=AuditEventType.login_sms_otp_verified,
        user_id=user.id,
        ip=ip,
    )

    login_result = await complete_authenticated_login(
        db,
        user=user,
        device_fingerprint=payload["device_fingerprint"],
        user_agent=payload.get("user_agent"),
        ip=ip,
        settings=settings,
        login_method="sms",
    )
    return login_result | {
        "device_fingerprint": payload["device_fingerprint"],
        "admin_client": bool(payload.get("admin_client")),
    }
