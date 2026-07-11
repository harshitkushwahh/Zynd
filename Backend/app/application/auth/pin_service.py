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
from app.application.notifications.notification_service import schedule_user_notification
from app.application.notifications.types import NotificationType
from app.core.config import get_settings
from app.core.redis import get_redis
from app.infrastructure.persistence.models import AuditEventType, User
from app.infrastructure.security.passwords import hash_password, verify_password

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
    return bool(user.pin_hash)


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


async def _clear_pin_unlock(user_id: UUID, session_id: UUID) -> None:
    redis = await get_redis(get_settings().redis_session_db)
    await redis.delete(f"pin_unlock:{user_id}:{session_id}")


async def store_pin_unlock(user_id: UUID, session_id: UUID) -> dict[str, int]:
    redis = await get_redis(get_settings().redis_session_db)
    await redis.set(
        f"pin_unlock:{user_id}:{session_id}",
        "1",
        ex=PIN_UNLOCK_TTL_SECONDS,
    )
    return {"unlocked": True, "expires_in": PIN_UNLOCK_TTL_SECONDS}


async def is_pin_unlocked(user_id: UUID, session_id: UUID) -> bool:
    redis = await get_redis(get_settings().redis_session_db)
    raw = await redis.get(f"pin_unlock:{user_id}:{session_id}")
    return raw is not None


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

    meta = await request_otp(OtpPurpose.pin_reset, str(user.id), ip=ip, destination=user.email)
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

    if pin != confirm_pin:
        raise AuthError("PIN entries do not match.", "pin_mismatch", 400)

    validate_pin_format(pin)
    user.pin_hash = hash_password(pin)
    user.pin_set_at = _now()
    user.pin_failed_attempts = 0
    user.pin_locked_until = None

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
    await store_pin_unlock(user.id, session_id)
    return {"ok": True, "pin_enrolled": True}
