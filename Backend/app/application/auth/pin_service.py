from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.audit_service import write_audit
from app.application.auth.errors import AuthError
from app.application.auth.mfa_service import user_has_mfa, verify_user_totp
from app.application.identity.otp_app_service import request_otp, verify_otp
from app.application.identity.otp_purposes import OtpPurpose
from app.application.ports.otp_gateway import OtpCooldownError, OtpRateLimitError
from app.application.notifications.notification_service import schedule_user_notification
from app.application.notifications.types import NotificationType
from app.application.ports.email_gateway import send_security_email
from app.infrastructure.notifications.email_service import smtp_configured
from app.core.config import get_settings
from app.core.redis import get_redis
from app.infrastructure.persistence.models import AuditEventType, User
from app.infrastructure.persistence.pin_reset_token_store import (
    PIN_RESET_TOKEN_TTL_SECONDS,
    consume_pin_reset_token,
    create_pin_reset_token,
    peek_pin_reset_token,
)
from app.infrastructure.security.passwords import hash_password, verify_password
from app.infrastructure.security.rate_limit import check_rate_limit

PIN_LENGTH = 4
PIN_UNLOCK_TTL_SECONDS = 60 * 60
PIN_MAX_ATTEMPTS = 5
PIN_LOCKOUT_MINUTES = 15
WEAK_PINS = {
    "0000",
    "1111",
    "2222",
    "3333",
    "4444",
    "5555",
    "6666",
    "7777",
    "8888",
    "9999",
    "1234",
    "4321",
    "1212",
    "6969",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def user_has_pin(user: User) -> bool:
    return bool(user.pin_hash and user.pin_hash.strip())


def validate_pin_format(pin: str) -> None:
    if not re.fullmatch(r"\d{4}", pin):
        raise AuthError("PIN must be exactly 4 digits.", "invalid_pin_format", 400)
    if pin in WEAK_PINS:
        raise AuthError("Choose a stronger PIN.", "weak_pin", 400)


def _assert_pin_not_locked(user: User) -> None:
    if user.pin_locked_until and user.pin_locked_until > _now():
        raise AuthError(
            "PIN is temporarily locked. Try again later or reset via email.",
            "pin_locked",
            429,
        )


def _pin_unlock_key(user_id: UUID) -> str:
    return f"pin_unlock:{user_id}"


async def clear_pin_unlock(user_id: UUID, session_id: UUID | None = None) -> None:
    _ = session_id
    redis = await get_redis(get_settings().redis_session_db)
    await redis.delete(_pin_unlock_key(user_id))


async def store_pin_unlock(user_id: UUID, session_id: UUID | None = None) -> dict[str, int]:
    _ = session_id
    redis = await get_redis(get_settings().redis_session_db)
    await redis.set(
        _pin_unlock_key(user_id),
        "1",
        ex=PIN_UNLOCK_TTL_SECONDS,
    )
    return {"unlocked": True, "expires_in": PIN_UNLOCK_TTL_SECONDS}


async def is_pin_unlocked(user_id: UUID, session_id: UUID | None = None) -> bool:
    _ = session_id
    redis = await get_redis(get_settings().redis_session_db)
    raw = await redis.get(_pin_unlock_key(user_id))
    return raw is not None


async def get_pin_unlock_status(user_id: UUID, session_id: UUID | None = None) -> dict[str, Any]:
    _ = session_id
    redis = await get_redis(get_settings().redis_session_db)
    key = _pin_unlock_key(user_id)
    ttl = await redis.ttl(key)
    if ttl is None or ttl <= 0:
        return {"unlocked": False, "expires_in": 0}
    return {"unlocked": True, "expires_in": int(ttl)}


async def _record_pin_failure(db: AsyncSession, *, user: User, ip: str | None) -> None:
    user.pin_failed_attempts += 1
    if user.pin_failed_attempts >= PIN_MAX_ATTEMPTS:
        user.pin_locked_until = _now() + timedelta(minutes=PIN_LOCKOUT_MINUTES)
        user.pin_failed_attempts = 0
    await write_audit(
        db,
        event_type=AuditEventType.pin_verify_failed,
        user_id=user.id,
        ip=ip,
    )


async def _verify_step_up_for_pin_setup(
    db: AsyncSession,
    *,
    user: User,
    current_password: str,
    totp_code: str | None,
) -> None:
    if not user_has_mfa(user):
        raise AuthError(
            "Enable two-factor authentication before setting up Zynd PIN.",
            "mfa_not_enrolled",
            400,
        )
    if not user.password_hash or not verify_password(user.password_hash, current_password):
        raise AuthError("Invalid password.", "invalid_credentials", 401)
    if not totp_code or not await verify_user_totp(db, user, totp_code):
        raise AuthError("Valid authenticator code required.", "invalid_totp", 401)


async def _apply_pin_reset(
    db: AsyncSession,
    *,
    user: User,
    pin: str,
    confirm_pin: str,
    ip: str | None,
    session_id: UUID | None = None,
    is_initial_setup: bool = False,
) -> dict[str, Any]:
    if pin != confirm_pin:
        raise AuthError("PIN entries do not match.", "pin_mismatch", 400)

    validate_pin_format(pin)
    user.pin_hash = hash_password(pin)
    user.pin_set_at = _now()
    user.pin_failed_attempts = 0
    user.pin_locked_until = None

    if is_initial_setup:
        await write_audit(db, event_type=AuditEventType.pin_set, user_id=user.id, ip=ip)
        schedule_user_notification(
            user_id=user.id,
            user_email=user.email,
            notification_type=NotificationType.AUTH_PIN_SET,
            title="Zynd PIN set",
            body="Your Zynd PIN was set successfully on this account.",
            idempotency_key=f"auth.pin.set:{user.id}:{user.pin_set_at.isoformat()}",
        )
    else:
        await write_audit(db, event_type=AuditEventType.pin_reset, user_id=user.id, ip=ip)
        schedule_user_notification(
            user_id=user.id,
            user_email=user.email,
            notification_type=NotificationType.AUTH_PIN_RESET,
            title="Zynd PIN reset",
            body=(
                "Your Zynd PIN was reset.\n\n"
                "If you didn't make this change, secure your account immediately."
            ),
            idempotency_key=f"auth.pin.reset:{user.id}:{user.pin_set_at.isoformat()}",
            email_subject="Your ZYND PIN was reset",
        )
    if session_id is not None:
        await store_pin_unlock(user.id, session_id)
    return {"ok": True, "pin_enrolled": True}


async def setup_pin(
    db: AsyncSession,
    *,
    user: User,
    session_id: UUID,
    current_password: str,
    totp_code: str,
    pin: str,
    confirm_pin: str,
    ip: str | None,
) -> dict[str, Any]:
    if user_has_pin(user):
        raise AuthError("Zynd PIN is already set.", "pin_already_set", 400)

    await _verify_step_up_for_pin_setup(
        db,
        user=user,
        current_password=current_password,
        totp_code=totp_code,
    )

    if pin != confirm_pin:
        raise AuthError("PIN entries do not match.", "pin_mismatch", 400)

    validate_pin_format(pin)
    user.pin_hash = hash_password(pin)
    user.pin_set_at = _now()
    user.pin_failed_attempts = 0
    user.pin_locked_until = None

    await write_audit(db, event_type=AuditEventType.pin_set, user_id=user.id, ip=ip)
    schedule_user_notification(
        user_id=user.id,
        user_email=user.email,
        notification_type=NotificationType.AUTH_PIN_SET,
        title="Zynd PIN set",
        body="Your Zynd PIN was set successfully on this account.",
        idempotency_key=f"auth.pin.set:{user.id}:{user.pin_set_at.isoformat()}",
    )
    await store_pin_unlock(user.id, session_id)
    return {"ok": True, "pin_enrolled": True}


async def verify_pin(
    db: AsyncSession,
    *,
    user: User,
    session_id: UUID,
    pin: str,
    ip: str | None,
) -> dict[str, Any]:
    await db.refresh(user)
    if not user_has_pin(user):
        raise AuthError("Zynd PIN is not set.", "pin_not_set", 400)

    _assert_pin_not_locked(user)

    if not user.pin_hash or not verify_password(user.pin_hash, pin):
        await _record_pin_failure(db, user=user, ip=ip)
        raise AuthError("Incorrect PIN.", "invalid_pin", 401)

    user.pin_failed_attempts = 0
    user.pin_locked_until = None
    await write_audit(db, event_type=AuditEventType.pin_verify_success, user_id=user.id, ip=ip)
    return await store_pin_unlock(user.id, session_id)


async def send_pin_reset_otp(
    db: AsyncSession,
    *,
    user: User,
    ip: str | None,
) -> dict[str, int]:
    if not user_has_pin(user):
        raise AuthError("Zynd PIN is not set.", "pin_not_set", 400)

    try:
        meta = await request_otp(OtpPurpose.pin_reset, str(user.id), ip=ip, destination=user.email)
    except OtpCooldownError as exc:
        raise AuthError(
            "Please wait before requesting another code.",
            "otp_cooldown",
            429,
            metadata={"retry_after_seconds": exc.retry_after_seconds},
        ) from exc
    except OtpRateLimitError as exc:
        raise AuthError(str(exc), "rate_limited", 429) from exc
    await write_audit(db, event_type=AuditEventType.pin_reset_requested, user_id=user.id, ip=ip)
    return meta


async def reset_pin_with_otp(
    db: AsyncSession,
    *,
    user: User,
    session_id: UUID,
    otp: str,
    pin: str,
    confirm_pin: str,
    ip: str | None,
) -> dict[str, Any]:
    if not await verify_otp(OtpPurpose.pin_reset, str(user.id), otp):
        raise AuthError("Invalid or expired verification code.", "invalid_otp", 401)

    return await _apply_pin_reset(
        db,
        user=user,
        pin=pin,
        confirm_pin=confirm_pin,
        ip=ip,
        session_id=session_id,
    )


def _mask_email(email: str) -> str:
    local, _, domain = email.partition("@")
    if not domain:
        return email
    if len(local) <= 2:
        masked_local = local[:1] + "*"
    else:
        masked_local = local[:1] + "*" * (len(local) - 2) + local[-1]
    return f"{masked_local}@{domain}"


async def send_pin_reset_link(
    db: AsyncSession,
    *,
    user: User,
    ip: str | None,
) -> dict[str, Any]:
    await db.refresh(user)
    has_pin = user_has_pin(user)

    if not await check_rate_limit(f"pin_reset_link:{user.id}", 5, 3600):
        raise AuthError("Too many reset requests. Try again later.", "rate_limited", 429)

    token = await create_pin_reset_token(str(user.id))
    settings = get_settings()
    reset_url = f"{settings.distributor_frontend_url.rstrip('/')}/reset-pin?token={token}"
    if has_pin:
        subject = "Reset your Zynd Mitra console PIN"
        intro = "We received a request to reset your Zynd PIN for the Zynd Mitra console."
        action = "You'll need your account password and authenticator app to set a new PIN."
    else:
        subject = "Set your Zynd Mitra console PIN"
        intro = "We received a request to set your Zynd PIN for the Zynd Mitra console."
        action = "You'll need your account password and authenticator app to choose a PIN."
    await send_security_email(
        to_email=user.email,
        subject=subject,
        body=(
            f"{intro}\n\n"
            f"Secure link (valid for {PIN_RESET_TOKEN_TTL_SECONDS // 60} minutes):\n"
            f"{reset_url}\n\n"
            f"{action}\n\n"
            "If you did not request this, you can ignore this email."
        ),
    )
    await write_audit(db, event_type=AuditEventType.pin_reset_requested, user_id=user.id, ip=ip)

    email_delivered = smtp_configured()
    result: dict[str, Any] = {
        "ok": True,
        "masked_email": _mask_email(user.email),
        "email_delivered": email_delivered,
    }
    if settings.debug and not email_delivered:
        result["dev_reset_url"] = reset_url
    return result


async def validate_pin_reset_link(token: str) -> dict[str, Any]:
    user_id = await peek_pin_reset_token(token)
    if not user_id:
        raise AuthError("Invalid or expired reset link.", "invalid_pin_reset_token", 400)
    return {"ok": True}


async def reset_pin_with_link(
    db: AsyncSession,
    *,
    token: str,
    current_password: str,
    totp_code: str,
    pin: str,
    confirm_pin: str,
    ip: str | None,
    session_id: UUID | None = None,
) -> dict[str, Any]:
    user_id = await consume_pin_reset_token(token)
    if not user_id:
        raise AuthError("Invalid or expired reset link.", "invalid_pin_reset_token", 400)

    from app.application.auth.user_service import get_user_by_id

    user = await get_user_by_id(db, UUID(user_id))
    if not user:
        raise AuthError("Invalid or expired reset link.", "invalid_pin_reset_token", 400)

    await _verify_step_up_for_pin_setup(
        db,
        user=user,
        current_password=current_password,
        totp_code=totp_code,
    )

    return await _apply_pin_reset(
        db,
        user=user,
        pin=pin,
        confirm_pin=confirm_pin,
        ip=ip,
        session_id=session_id,
        is_initial_setup=not user_has_pin(user),
    )
