from __future__ import annotations

import json
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.distributor.partner_access_service import (
    assert_distributor_partner_may_set_password,
    distributor_partner_may_request_password_reset,
    resolve_auth_client_hint,
    resolve_password_reset_target,
)

from app.application.auth.audit_service import write_audit
from app.application.auth.auth_session_context import create_authenticated_session
from app.application.auth.errors import AuthError
from app.application.auth.mfa_service import user_has_mfa
from app.application.auth.refresh_token_service import handle_refresh_token_reuse
from app.application.auth.session_service import revoke_all_sessions
from app.application.notifications.notification_service import schedule_user_notification
from app.application.notifications.types import NotificationType
from app.application.ports.email_gateway import send_security_email
from app.application.shared.datetime_utils import utcnow
from app.core.config import Settings, get_settings
from app.core.redis import get_redis
from app.infrastructure.persistence.models import AuditEventType, Device, Session, User
from app.infrastructure.persistence.password_reset_token_store import (
    consume_reset_token,
    create_reset_token,
)
from app.infrastructure.security.hibp_service import (
    HibpUnavailableError,
    PasswordPwnedError,
    ensure_password_not_pwned,
)
from app.infrastructure.security.passwords import hash_password
from app.infrastructure.security.rate_limit import check_rate_limit
from app.infrastructure.security.tokens import hash_token
from app.infrastructure.security.turnstile import verify_turnstile

REFRESH_GRACE_SECONDS = 60


async def _get_refresh_grace_tokens(token_hash: str) -> tuple[str, str] | None:
    settings = get_settings()
    redis = await get_redis(settings.redis_session_db)
    raw = await redis.get(f"refresh_grace:{token_hash}")
    if not raw:
        return None
    payload = json.loads(raw)
    return payload["access_token"], payload["refresh_token"]


async def _store_refresh_grace_tokens(
    token_hash: str,
    *,
    access_token: str,
    refresh_token: str,
) -> None:
    settings = get_settings()
    redis = await get_redis(settings.redis_session_db)
    await redis.setex(
        f"refresh_grace:{token_hash}",
        REFRESH_GRACE_SECONDS,
        json.dumps({"access_token": access_token, "refresh_token": refresh_token}),
    )


async def refresh_session(
    db: AsyncSession,
    *,
    refresh_token: str,
    ip: str | None,
    settings: Settings | None = None,
) -> tuple[str, str]:
    settings = settings or get_settings()
    token_hash = hash_token(refresh_token)

    grace_tokens = await _get_refresh_grace_tokens(token_hash)
    if grace_tokens:
        return grace_tokens

    result = await db.execute(select(Session).where(Session.refresh_token_hash == token_hash))
    session = result.scalar_one_or_none()
    if not session:
        raise AuthError("Session expired. Please sign in again.", "session_expired", 401)

    if session.revoked_at is not None:
        await handle_refresh_token_reuse(
            db,
            user_id=session.user_id,
            family_id=session.token_family_id,
            ip=ip,
            reused_session_id=session.id,
        )
        raise AuthError(
            "Session compromised. Please sign in again.",
            "session_compromised",
            401,
        )

    if session.expires_at <= utcnow():
        raise AuthError("Session expired. Please sign in again.", "session_expired", 401)

    user_result = await db.execute(select(User).where(User.id == session.user_id))
    user = user_result.scalar_one()

    session.revoked_at = utcnow()
    await write_audit(
        db,
        event_type=AuditEventType.session_revoked,
        user_id=user.id,
        ip=ip,
        metadata={"session_id": str(session.id), "reason": "rotation"},
    )

    device = None
    if session.device_id:
        device_result = await db.execute(select(Device).where(Device.id == session.device_id))
        device = device_result.scalar_one_or_none()

    access_token, new_refresh_token, _ = await create_authenticated_session(
        db,
        user=user,
        device=device,
        settings=settings,
        ip=ip,
        token_family_id=session.token_family_id,
    )
    await _store_refresh_grace_tokens(
        token_hash,
        access_token=access_token,
        refresh_token=new_refresh_token,
    )
    return access_token, new_refresh_token


async def logout(db: AsyncSession, *, refresh_token: str, ip: str | None) -> None:
    token_hash = hash_token(refresh_token)
    result = await db.execute(select(Session).where(Session.refresh_token_hash == token_hash))
    session = result.scalar_one_or_none()
    if not session:
        return
    session.revoked_at = utcnow()
    await write_audit(
        db,
        event_type=AuditEventType.logout,
        user_id=session.user_id,
        ip=ip,
        metadata={"session_id": str(session.id)},
    )
    await write_audit(
        db,
        event_type=AuditEventType.session_revoked,
        user_id=session.user_id,
        ip=ip,
        metadata={"session_id": str(session.id), "reason": "logout"},
    )


async def forgot_password(
    db: AsyncSession,
    *,
    email: str,
    turnstile_token: str | None,
    ip: str | None,
    client: str | None = None,
    origin: str | None = None,
    referer: str | None = None,
    header_client: str | None = None,
) -> dict[str, bool]:
    if not await check_rate_limit(f"forgot:{ip or email}", 5, 3600):
        raise AuthError("Too many reset requests. Try again later.", "rate_limited", 429)
    if not await verify_turnstile(turnstile_token, ip):
        raise AuthError("Bot verification failed.", "turnstile_failed", 403)

    normalized = email.lower().strip()
    result = await db.execute(select(User).where(User.email == normalized))
    user = result.scalar_one_or_none()
    if user:
        if not await distributor_partner_may_request_password_reset(db, user=user):
            return {"ok": True}

        token = await create_reset_token(str(user.id))
        settings = get_settings()
        client_hint = resolve_auth_client_hint(body_client=client, header_client=header_client)
        reset_base, product_label = await resolve_password_reset_target(
            db,
            settings,
            user=user,
            client=client_hint,
            origin=origin,
            referer=referer,
        )
        reset_url = f"{reset_base}/reset-password?token={token}"
        is_first_password = not user.password_hash
        if is_first_password:
            subject = f"Set your {product_label} password"
            body = (
                f"Your {product_label} account is ready.\n\n"
                f"Set your password using the link below (valid for a short time):\n"
                f"{reset_url}\n\n"
                "If you did not expect this email, you can ignore it."
            )
        else:
            subject = f"Reset your {product_label} password"
            body = (
                f"We received a request to reset your {product_label} password.\n\n"
                f"Reset link (valid for a short time):\n{reset_url}\n\n"
                "If you did not request this, you can ignore this email."
            )
        await send_security_email(
            to_email=user.email,
            subject=subject,
            body=body,
        )
        await write_audit(
            db,
            event_type=AuditEventType.password_reset_requested,
            user_id=user.id,
            ip=ip,
        )
    return {"ok": True}


async def reset_password(
    db: AsyncSession,
    *,
    token: str,
    new_password: str,
    totp_code: str | None = None,
    backup_code: str | None = None,
    ip: str | None = None,
) -> dict[str, bool]:
    user_id = await consume_reset_token(token)
    if not user_id:
        raise AuthError("Invalid or expired reset link.", "invalid_reset_token", 400)
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise AuthError("User not found.", "user_not_found", 404)

    await assert_distributor_partner_may_set_password(db, user=user)

    if user_has_mfa(user):
        from app.application.auth.mfa_service import verify_user_backup_code, verify_user_totp

        if totp_code and backup_code:
            raise AuthError("Provide either a TOTP code or a backup code.", "invalid_mfa_payload", 400)
        if not totp_code and not backup_code:
            raise AuthError(
                "MFA verification is required to reset your password.",
                "mfa_required_for_reset",
                403,
            )
        verified = False
        if totp_code:
            verified = await verify_user_totp(db, user, totp_code)
        else:
            verified = await verify_user_backup_code(db, user, backup_code or "")
        if not verified:
            await write_audit(
                db,
                event_type=AuditEventType.mfa_challenge_failure,
                user_id=user.id,
                ip=ip,
                metadata={"context": "password_reset"},
            )
            raise AuthError("Invalid verification code.", "invalid_mfa_code", 401)

    try:
        await ensure_password_not_pwned(new_password)
    except PasswordPwnedError as exc:
        raise AuthError(str(exc), "password_pwned", 400) from exc
    except HibpUnavailableError as exc:
        raise AuthError(str(exc), "hibp_unavailable", 503) from exc

    user.password_hash = hash_password(new_password)
    user.password_changed_at = utcnow()
    user.failed_login_count = 0
    user.is_locked = False
    user.locked_until = None
    await revoke_all_sessions(db, user_id=user.id, ip=ip, reason="password_reset")
    await write_audit(db, event_type=AuditEventType.password_changed, user_id=user.id, ip=ip)
    from app.application.distributor.partner_approval_service import activate_distributor_partner_after_password_set

    await activate_distributor_partner_after_password_set(db, user_id=user.id)
    schedule_user_notification(
        user_id=user.id,
        user_email=user.email,
        notification_type=NotificationType.AUTH_PASSWORD_CHANGED,
        title="Password reset completed",
        body=(
            "Your ZYND account password was reset successfully.\n\n"
            "All active sessions were signed out. If you did not make this change, "
            "contact support immediately."
        ),
        idempotency_key=f"auth.password.reset:{user.id}:{user.password_changed_at.isoformat()}",
        email_subject="Your ZYND password was changed",
    )
    return {"ok": True}
