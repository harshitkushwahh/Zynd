from __future__ import annotations

import base64
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.mfa_service import (
    build_provisioning_uri,
    confirm_mfa_enrollment,
    generate_totp_secret,
    get_backup_codes_status,
    regenerate_backup_codes,
    rotate_mfa_enrollment,
    user_has_mfa,
    verify_user_backup_code,
    verify_user_totp,
)
from app.application.referral.referral_qr_service import generate_referral_qr_png
from app.application.auth.audit_service import write_audit
from app.application.auth.auth_client_policy import AuthClientKind, auth_client_from_pending_payload, validate_user_role_for_client
from app.application.admin.rbac_service import list_user_role_keys
from app.application.auth.errors import AuthError
from app.application.auth.session_service import revoke_all_sessions
from app.application.notifications.notification_service import schedule_user_notification
from app.application.notifications.types import NotificationType
from app.application.documents.document_retention_service import (
    clear_document_deletion_schedule,
    schedule_documents_for_account_deletion,
)
from app.core.config import Settings, get_settings
from app.infrastructure.security.apple_oauth import is_apple_private_relay_email
from app.application.ports.otp_gateway import OtpCooldownError, OtpRateLimitError, request_otp, verify_otp
from app.application.identity.otp_purposes import OtpPurpose
from app.infrastructure.security.hibp_service import (
    HibpUnavailableError,
    PasswordPwnedError,
    ensure_password_not_pwned,
)
from app.infrastructure.notifications.email_service import send_security_email
from app.infrastructure.persistence.models import (
    AuditEventType,
    DeletionEventType,
    DeletionLedger,
    OAuthLinkRequest,
    OAuthProvider,
    User,
    UserBackupCode,
    UserMfaSecret,
    UserRole,
    UserStatus,
)
from app.infrastructure.security.password_policy import (
    PasswordStrengthError,
    validate_password_strength,
)
from app.infrastructure.security.passwords import hash_password, verify_password
from app.infrastructure.security.pending_auth import (
    consume_pending_auth,
    generate_pending_token,
    has_step_up,
    peek_pending_auth,
    store_pending_auth,
    store_step_up,
)
from app.infrastructure.security.rate_limit import check_rate_limit
from app.infrastructure.security.tokens import hash_token


def _now() -> datetime:
    return datetime.now(timezone.utc)


MFA_QR_PNG_SIZE = 256


def _mfa_qr_png_base64(secret: str, email: str) -> str:
    qr_uri = build_provisioning_uri(secret, email)
    png_bytes = generate_referral_qr_png(qr_uri, size=MFA_QR_PNG_SIZE)
    return base64.b64encode(png_bytes).decode("ascii")


async def mfa_enroll_start(db: AsyncSession, user: User) -> dict[str, Any]:
    if user_has_mfa(user):
        raise AuthError("MFA is already enabled.", "mfa_already_enabled", 409)

    secret = generate_totp_secret()
    enroll_token = generate_pending_token()
    settings = get_settings()
    await store_pending_auth(
        "mfa_enroll",
        enroll_token,
        {"user_id": str(user.id), "secret": secret},
        settings.mfa_pending_ttl_seconds,
    )
    qr_uri = build_provisioning_uri(secret, user.email)
    return {
        "enroll_token": enroll_token,
        "qr_uri": qr_uri,
        "manual_secret": secret,
        "expires_in": settings.mfa_pending_ttl_seconds,
        "qr_png_base64": _mfa_qr_png_base64(secret, user.email),
    }


async def mfa_enroll_qr(
    db: AsyncSession,
    *,
    user: User,
    enroll_token: str,
    size: int = 512,
) -> bytes:
    del db
    if user_has_mfa(user):
        raise AuthError("MFA is already enabled.", "mfa_already_enabled", 409)

    payload = await peek_pending_auth("mfa_enroll", enroll_token)
    if not payload or payload.get("user_id") != str(user.id):
        raise AuthError("Enrollment session expired. Start again.", "enroll_expired", 410)

    secret = payload["secret"]
    qr_uri = build_provisioning_uri(secret, user.email)
    return generate_referral_qr_png(qr_uri, size=size)


async def mfa_enroll_confirm(
    db: AsyncSession,
    *,
    user: User,
    enroll_token: str,
    totp_code: str,
    ip: str | None,
    session_id: UUID | None = None,
) -> dict[str, Any]:
    payload = await consume_pending_auth("mfa_enroll", enroll_token)
    if not payload or payload.get("user_id") != str(user.id):
        raise AuthError("Enrollment session expired. Start again.", "enroll_expired", 410)

    try:
        backup_codes = await confirm_mfa_enrollment(
            db,
            user=user,
            secret=payload["secret"],
            totp_code=totp_code,
        )
    except ValueError as exc:
        raise AuthError("Invalid authenticator code.", "invalid_totp", 400) from exc

    await write_audit(db, event_type=AuditEventType.mfa_enrolled, user_id=user.id, ip=ip)
    await revoke_all_sessions(
        db,
        user_id=user.id,
        ip=ip,
        except_session_id=session_id,
        reason="mfa_enabled",
    )
    schedule_user_notification(
        user_id=user.id,
        user_email=user.email,
        notification_type=NotificationType.AUTH_MFA_ENABLED,
        title="Two-factor authentication enabled",
        body=(
            "Authenticator app MFA was enabled on your ZYND account. "
            "Other active sessions were signed out.\n\n"
            "If you didn't make this change, contact support immediately."
        ),
        idempotency_key=f"auth.mfa.enabled:{user.id}:{user.mfa_enrolled_at.isoformat()}",
        email_subject="Two-factor authentication enabled on your ZYND account",
    )
    return {"enrolled": True, "backup_codes": backup_codes, "mfa_enrolled_at": user.mfa_enrolled_at}


async def mfa_backup_codes_status(db: AsyncSession, user: User) -> dict[str, Any]:
    if not user_has_mfa(user):
        return {"enrolled": False, "total": 0, "remaining": 0, "used": 0}
    status = await get_backup_codes_status(db, user.id)
    return {"enrolled": True, **status}


async def mfa_regenerate_backup_codes(
    db: AsyncSession,
    *,
    user: User,
    session_id: UUID,
    current_password: str,
    totp_code: str | None,
    sms_otp: str | None = None,
    ip: str | None,
) -> dict[str, Any]:
    await verify_step_up(
        db,
        user=user,
        session_id=session_id,
        current_password=current_password,
        totp_code=totp_code,
        sms_otp=sms_otp,
        ip=ip,
    )
    try:
        backup_codes = await regenerate_backup_codes(db, user)
    except ValueError as exc:
        raise AuthError("Enable MFA before managing backup codes.", "mfa_not_enrolled", 400) from exc

    await write_audit(
        db,
        event_type=AuditEventType.mfa_enrolled,
        user_id=user.id,
        ip=ip,
        metadata={"action": "backup_codes_regenerated"},
    )
    return {"backup_codes": backup_codes}


async def mfa_reset_start(
    db: AsyncSession,
    *,
    user: User,
    current_totp_code: str,
    ip: str | None,
) -> dict[str, Any]:
    if not user_has_mfa(user):
        raise AuthError("MFA is not enabled.", "mfa_not_enrolled", 400)

    if not await verify_user_totp(db, user, current_totp_code):
        raise AuthError("Invalid authenticator code.", "invalid_totp", 401)

    secret = generate_totp_secret()
    reset_token = generate_pending_token()
    settings = get_settings()
    await store_pending_auth(
        "mfa_reset",
        reset_token,
        {"user_id": str(user.id), "secret": secret},
        settings.mfa_pending_ttl_seconds,
    )
    await write_audit(
        db,
        event_type=AuditEventType.mfa_enrolled,
        user_id=user.id,
        ip=ip,
        metadata={"action": "mfa_reset_started"},
    )
    qr_uri = build_provisioning_uri(secret, user.email)
    return {
        "reset_token": reset_token,
        "qr_uri": qr_uri,
        "manual_secret": secret,
        "expires_in": settings.mfa_pending_ttl_seconds,
        "qr_png_base64": _mfa_qr_png_base64(secret, user.email),
    }


async def mfa_reset_qr(
    db: AsyncSession,
    *,
    user: User,
    reset_token: str,
    size: int = 512,
) -> bytes:
    del db
    if not user_has_mfa(user):
        raise AuthError("MFA is not enabled.", "mfa_not_enrolled", 400)

    payload = await peek_pending_auth("mfa_reset", reset_token)
    if not payload or payload.get("user_id") != str(user.id):
        raise AuthError("Reset session expired. Start again.", "reset_expired", 410)

    secret = payload["secret"]
    qr_uri = build_provisioning_uri(secret, user.email)
    return generate_referral_qr_png(qr_uri, size=size)


async def mfa_reset_confirm(
    db: AsyncSession,
    *,
    user: User,
    reset_token: str,
    totp_code: str,
    ip: str | None,
) -> dict[str, Any]:
    payload = await consume_pending_auth("mfa_reset", reset_token)
    if not payload or payload.get("user_id") != str(user.id):
        raise AuthError("Reset session expired. Start again.", "reset_expired", 410)

    try:
        backup_codes = await rotate_mfa_enrollment(
            db,
            user=user,
            secret=payload["secret"],
            totp_code=totp_code,
        )
    except ValueError as exc:
        raise AuthError("Invalid authenticator code.", "invalid_totp", 400) from exc

    await write_audit(
        db,
        event_type=AuditEventType.mfa_enrolled,
        user_id=user.id,
        ip=ip,
        metadata={"action": "mfa_reset_completed"},
    )
    schedule_user_notification(
        user_id=user.id,
        user_email=user.email,
        notification_type=NotificationType.AUTH_MFA_ENABLED,
        title="Authenticator app reset",
        body=(
            "Your ZYND authenticator app was reset and re-enrolled.\n\n"
            "If you didn't make this change, contact support immediately."
        ),
        idempotency_key=f"auth.mfa.reset:{user.id}:{user.mfa_enrolled_at.isoformat()}",
        email_subject="Your ZYND authenticator app was reset",
    )
    return {
        "enrolled": True,
        "backup_codes": backup_codes,
        "mfa_enrolled_at": user.mfa_enrolled_at,
    }


async def mfa_disable(
    db: AsyncSession,
    *,
    user: User,
    session_id: UUID,
    current_password: str,
    totp_code: str | None,
    sms_otp: str | None = None,
    ip: str | None,
) -> dict[str, bool]:
    if not user_has_mfa(user):
        raise AuthError("MFA is not enabled.", "mfa_not_enrolled", 400)

    await verify_step_up(
        db,
        user=user,
        session_id=session_id,
        current_password=current_password,
        totp_code=totp_code,
        sms_otp=sms_otp,
        ip=ip,
    )

    await db.execute(delete(UserMfaSecret).where(UserMfaSecret.user_id == user.id))
    await db.execute(delete(UserBackupCode).where(UserBackupCode.user_id == user.id))
    user.mfa_enrolled_at = None

    await write_audit(
        db,
        event_type=AuditEventType.mfa_disabled,
        user_id=user.id,
        ip=ip,
    )
    await revoke_all_sessions(
        db,
        user_id=user.id,
        ip=ip,
        except_session_id=session_id,
        reason="mfa_disabled",
    )
    schedule_user_notification(
        user_id=user.id,
        user_email=user.email,
        notification_type=NotificationType.AUTH_MFA_DISABLED,
        title="Two-factor authentication disabled",
        body=(
            "Multi-factor authentication was disabled on your ZYND account. "
            "Other active sessions were signed out.\n\n"
            "If you did not make this change, sign in and secure your account immediately."
        ),
        idempotency_key=f"auth.mfa.disabled:{user.id}:{_now().isoformat()}",
        email_subject="Authenticator disabled on your ZYND account",
    )
    await db.flush()
    return {"disabled": True}


async def verify_mfa_login(
    db: AsyncSession,
    *,
    mfa_token: str,
    totp_code: str | None,
    backup_code: str | None,
    sms_otp: str | None,
    ip: str | None,
) -> dict[str, Any]:
    settings = get_settings()
    payload = await consume_pending_auth("mfa_login", mfa_token)
    if not payload:
        raise AuthError("MFA session expired. Sign in again.", "mfa_expired", 410)

    user_id = UUID(payload["user_id"])
    if not await check_rate_limit(f"totp:{user_id}", 5, 600):
        raise AuthError("Too many MFA attempts. Try again later.", "rate_limited", 429)

    from app.application.auth.service import _complete_authenticated_login, get_user_by_id
    from app.application.auth.second_factor_verification_service import verify_second_factor
    from app.application.identity.otp_purposes import OtpPurpose
    from app.application.security.security_config_service import get_second_factor_policy

    user = await get_user_by_id(db, user_id)
    if not user or not user_has_mfa(user):
        raise AuthError("Invalid MFA session.", "mfa_invalid", 400)

    provided = [
        bool(totp_code and totp_code.strip()),
        bool(backup_code and backup_code.strip()),
        bool(sms_otp and sms_otp.strip()),
    ]
    if sum(provided) != 1:
        raise AuthError(
            "Provide an authenticator code, backup code, or SMS code.",
            "invalid_mfa_payload",
            400,
        )

    verified = False
    used_backup = False
    used_sms = False
    if sms_otp and sms_otp.strip():
        policy = await get_second_factor_policy(db)
        if not policy["step_up_sms_fallback_enabled"]:
            raise AuthError("SMS fallback is not enabled.", "sms_fallback_disabled", 403)
        if not user.phone_verified_at or not user.phone:
            raise AuthError(
                "SMS verification is unavailable for this account.",
                "sms_fallback_unavailable",
                400,
            )
        result = await verify_second_factor(
            db,
            user=user,
            sms_otp=sms_otp.strip(),
            sms_purpose=OtpPurpose.step_up_sms,
        )
        verified = result.verified
        used_sms = verified
    elif totp_code and totp_code.strip():
        verified = await verify_user_totp(db, user, totp_code.strip())
    elif backup_code and backup_code.strip():
        verified = await verify_user_backup_code(db, user, backup_code.strip())
        used_backup = verified

    if not verified:
        await write_audit(
            db,
            event_type=AuditEventType.mfa_challenge_failure,
            user_id=user.id,
            ip=ip,
        )
        raise AuthError("Invalid verification code.", "invalid_mfa_code", 401)

    challenge_metadata: dict[str, Any] = {"used_backup_code": used_backup}
    if used_sms:
        challenge_metadata["method"] = "sms"
        await write_audit(
            db,
            event_type=AuditEventType.step_up_sms_used,
            user_id=user.id,
            ip=ip,
            metadata={"context": "mfa_login"},
        )
    elif totp_code:
        challenge_metadata["method"] = "totp"
    elif used_backup:
        challenge_metadata["method"] = "backup"

    await write_audit(
        db,
        event_type=AuditEventType.mfa_challenge_success,
        user_id=user.id,
        ip=ip,
        metadata=challenge_metadata,
    )
    if used_backup:
        await write_audit(db, event_type=AuditEventType.backup_code_used, user_id=user.id, ip=ip)

    login_method = "sms" if used_sms else "backup" if used_backup else "authenticator"

    return await _complete_authenticated_login(
        db,
        user=user,
        device_fingerprint=payload["device_fingerprint"],
        user_agent=payload.get("user_agent"),
        ip=ip,
        settings=settings,
        provider=payload.get("provider"),
        login_method=login_method,
    ) | {
        "device_fingerprint": payload["device_fingerprint"],
        "auth_client": auth_client_from_pending_payload(payload),
    }


async def create_oauth_link_request(
    db: AsyncSession,
    *,
    user: User,
    provider: OAuthProvider,
    provider_user_id: str,
    provider_email: str | None,
    ip: str | None,
) -> dict[str, Any]:
    settings = get_settings()
    link_token = generate_pending_token()
    token_hash = hash_token(link_token)

    link = OAuthLinkRequest(
        user_id=user.id,
        provider=provider,
        provider_user_id=provider_user_id,
        provider_email=provider_email,
        confirmation_token_hash=token_hash,
        expires_at=_now() + timedelta(seconds=settings.oauth_link_ttl_seconds),
    )
    db.add(link)
    try:
        otp_meta = await request_otp(
            OtpPurpose.oauth_link,
            str(user.id),
            ip=ip,
            destination=user.email,
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
        event_type=AuditEventType.oauth_link_requested,
        user_id=user.id,
        ip=ip,
        metadata={"provider": provider.value},
    )
    await store_pending_auth(
        "oauth_link",
        link_token,
        {
            "user_id": str(user.id),
            "provider": provider.value,
            "provider_user_id": provider_user_id,
            "provider_email": provider_email,
            "link_id": str(link.id),
        },
        settings.oauth_link_ttl_seconds,
    )
    return {
        "next": "oauth_link_confirmation_required",
        "link_token": link_token,
        "expires_in": settings.oauth_link_ttl_seconds,
        "email_hint": _mask_email(user.email),
        "provider": provider.value,
        **otp_meta,
    }


async def resend_oauth_link_otp(link_token: str, ip: str | None) -> dict[str, int]:
    payload = await peek_pending_auth("oauth_link", link_token)
    if not payload:
        raise AuthError("Link session expired. Please sign in again.", "link_expired", 410)

    try:
        return await request_otp(
            OtpPurpose.oauth_link,
            payload["user_id"],
            ip=ip,
            destination=user.email,
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


def _mask_email(email: str) -> str:
    local, _, domain = email.partition("@")
    if len(local) <= 2:
        masked = local[0] + "*"
    else:
        masked = local[0] + "*" * (len(local) - 2) + local[-1]
    return f"{masked}@{domain}"


async def confirm_oauth_link(
    db: AsyncSession,
    *,
    link_token: str,
    email_otp: str,
    password: str,
    device_fingerprint: str,
    user_agent: str | None,
    ip: str | None,
) -> dict[str, Any]:
    payload = await consume_pending_auth("oauth_link", link_token)
    if not payload:
        raise AuthError("Link request expired. Try signing in again.", "link_expired", 410)

    from app.application.auth.service import _complete_authenticated_login, get_user_by_id
    from app.infrastructure.persistence.models import OAuthAccount

    user = await get_user_by_id(db, UUID(payload["user_id"]))
    if not user or not user.password_hash:
        raise AuthError("Account verification failed.", "link_invalid", 400)

    if not verify_password(user.password_hash, password):
        raise AuthError("Invalid password.", "invalid_credentials", 401)

    if not await verify_otp(OtpPurpose.oauth_link, str(user.id), email_otp):
        raise AuthError("Invalid or expired verification code.", "invalid_otp", 400)

    role_keys = await list_user_role_keys(db, user.id)
    validate_user_role_for_client(user, client="web", role_keys=role_keys)

    provider = OAuthProvider(payload["provider"])
    result = await db.execute(
        select(OAuthLinkRequest).where(OAuthLinkRequest.id == UUID(payload["link_id"]))
    )
    link = result.scalar_one_or_none()
    if not link or link.confirmed_at is not None or link.expires_at <= _now():
        raise AuthError("Link request expired.", "link_expired", 410)

    existing = await db.execute(
        select(OAuthAccount).where(
            OAuthAccount.provider == provider,
            OAuthAccount.provider_user_id == payload["provider_user_id"],
        )
    )
    if existing.scalar_one_or_none():
        raise AuthError("This provider account is already linked.", "oauth_exists", 409)

    link.confirmed_at = _now()
    db.add(
        OAuthAccount(
            user_id=user.id,
            provider=provider,
            provider_user_id=payload["provider_user_id"],
            email=payload.get("provider_email"),
        )
    )
    await write_audit(
        db,
        event_type=AuditEventType.oauth_link_confirmed,
        user_id=user.id,
        ip=ip,
        metadata={"provider": provider.value},
    )

    pending = await _maybe_mfa_pending_login(
        user,
        device_fingerprint=device_fingerprint,
        user_agent=user_agent,
        provider=provider.value,
        auth_client="web",
    )
    if pending:
        from app.application.auth.login_sms_service import enrich_mfa_login_pending

        if pending.get("next") == "mfa_required":
            pending = await enrich_mfa_login_pending(db, user, pending)
        return pending

    return await _complete_authenticated_login(
        db,
        user=user,
        device_fingerprint=device_fingerprint,
        user_agent=user_agent,
        ip=ip,
        provider=provider.value,
    )


async def _maybe_mfa_pending_login(
    user: User,
    *,
    device_fingerprint: str,
    user_agent: str | None,
    provider: str | None = None,
    auth_client: AuthClientKind = "web",
) -> dict[str, Any] | None:
    from app.application.auth.service import _maybe_mfa_pending_login as pending

    return await pending(
        user,
        device_fingerprint=device_fingerprint,
        user_agent=user_agent,
        provider=provider,
        auth_client=auth_client,
    )


async def verify_step_up(
    db: AsyncSession,
    *,
    user: User,
    session_id: UUID,
    current_password: str,
    totp_code: str | None,
    sms_otp: str | None = None,
    ip: str | None,
) -> dict[str, bool]:
    from app.application.auth.second_factor_verification_service import verify_second_factor
    from app.application.identity.otp_purposes import OtpPurpose
    from app.application.security.security_config_service import get_second_factor_policy

    if not user.password_hash or not verify_password(user.password_hash, current_password):
        raise AuthError("Invalid password.", "invalid_credentials", 401)

    if user_has_mfa(user):
        has_totp = bool(totp_code and totp_code.strip())
        has_sms = bool(sms_otp and sms_otp.strip())
        if has_totp and has_sms:
            raise AuthError(
                "Provide only one second-factor method at a time.",
                "invalid_second_factor_payload",
                400,
            )
        if not has_totp and not has_sms:
            raise AuthError(
                "Valid authenticator or SMS code required.",
                "second_factor_required",
                401,
            )

        if has_sms:
            policy = await get_second_factor_policy(db)
            if not policy["step_up_sms_fallback_enabled"]:
                raise AuthError("SMS fallback is not enabled.", "sms_fallback_disabled", 403)
            if not user.phone_verified_at or not user.phone:
                raise AuthError(
                    "SMS verification is unavailable for this account.",
                    "sms_fallback_unavailable",
                    400,
                )
            result = await verify_second_factor(
                db,
                user=user,
                sms_otp=sms_otp.strip() if sms_otp else None,
                sms_purpose=OtpPurpose.step_up_sms,
            )
            if not result.verified:
                raise AuthError("Invalid verification code.", "invalid_mfa_code", 401)
            await write_audit(
                db,
                event_type=AuditEventType.step_up_sms_used,
                user_id=user.id,
                ip=ip,
                metadata={"context": "step_up"},
            )
        elif not await verify_user_totp(db, user, totp_code.strip() if totp_code else ""):
            raise AuthError("Valid authenticator code required.", "invalid_totp", 401)

    settings = get_settings()
    await store_step_up(str(user.id), str(session_id), settings.step_up_ttl_seconds)
    return {"verified": True}


async def verify_account_password(*, user: User, current_password: str) -> dict[str, bool]:
    if not user.password_hash or not verify_password(user.password_hash, current_password):
        raise AuthError("Invalid password.", "invalid_credentials", 401)
    return {"ok": True}


async def change_password(
    db: AsyncSession,
    *,
    user: User,
    session_id: UUID,
    current_password: str,
    new_password: str,
    totp_code: str | None,
    sms_otp: str | None = None,
    ip: str | None,
) -> dict[str, bool]:
    await verify_step_up(
        db,
        user=user,
        session_id=session_id,
        current_password=current_password,
        totp_code=totp_code,
        sms_otp=sms_otp,
        ip=ip,
    )
    try:
        validate_password_strength(new_password)
    except PasswordStrengthError as exc:
        raise AuthError(str(exc), "invalid_password", 400) from exc
    try:
        await ensure_password_not_pwned(new_password)
    except PasswordPwnedError as exc:
        raise AuthError(str(exc), "password_pwned", 400) from exc
    except HibpUnavailableError as exc:
        raise AuthError(str(exc), "hibp_unavailable", 503) from exc

    user.password_hash = hash_password(new_password)
    user.password_changed_at = _now()
    await revoke_all_sessions(db, user_id=user.id, ip=ip, except_session_id=session_id)
    await write_audit(db, event_type=AuditEventType.password_changed, user_id=user.id, ip=ip)
    schedule_user_notification(
        user_id=user.id,
        user_email=user.email,
        notification_type=NotificationType.AUTH_PASSWORD_CHANGED,
        title="Password changed",
        body=(
            "Your ZYND account password was changed. All other sessions were signed out.\n\n"
            "If you didn't make this change, contact support immediately."
        ),
        idempotency_key=f"auth.password.changed:{user.id}:{user.password_changed_at.isoformat()}",
    )
    return {"ok": True}


async def change_email_start(
    db: AsyncSession,
    *,
    user: User,
    session_id: UUID,
    new_email: str,
    current_password: str,
    totp_code: str | None,
    sms_otp: str | None = None,
    ip: str | None,
) -> dict[str, str]:
    await verify_step_up(
        db,
        user=user,
        session_id=session_id,
        current_password=current_password,
        totp_code=totp_code,
        sms_otp=sms_otp,
        ip=ip,
    )

    normalized = new_email.lower().strip()
    existing = await db.execute(select(User).where(User.email == normalized))
    if existing.scalar_one_or_none():
        raise AuthError("An account with this email already exists.", "email_exists", 409)

    change_token = generate_pending_token()
    settings = get_settings()
    try:
        otp_meta = await request_otp(OtpPurpose.email_change, normalized, ip=ip)
    except OtpCooldownError as exc:
        raise AuthError(
            "Please wait before requesting another code.",
            "otp_cooldown",
            429,
            metadata={"retry_after_seconds": exc.retry_after_seconds},
        ) from exc
    except OtpRateLimitError as exc:
        raise AuthError(str(exc), "rate_limited", 429) from exc
    await store_pending_auth(
        "email_change",
        change_token,
        {"user_id": str(user.id), "new_email": normalized},
        settings.oauth_link_ttl_seconds,
    )
    await write_audit(
        db,
        event_type=AuditEventType.email_change_requested,
        user_id=user.id,
        ip=ip,
        metadata={"new_email": normalized},
    )
    schedule_user_notification(
        user_id=user.id,
        user_email=user.email,
        notification_type=NotificationType.AUTH_EMAIL_CHANGE_REQUESTED,
        title="Email change requested",
        body=(
            f"A request was made to change your ZYND account email to {normalized}.\n\n"
            "If you didn't request this, secure your account immediately."
        ),
        metadata={"new_email": normalized},
        idempotency_key=f"auth.email_change.requested:{user.id}:{change_token}",
        email_subject="Email change requested on your ZYND account",
    )
    return {"change_token": change_token, **otp_meta}


async def change_email_resend(change_token: str, ip: str | None) -> dict[str, int]:
    payload = await peek_pending_auth("email_change", change_token)
    if not payload:
        raise AuthError("Email change session expired.", "change_expired", 410)

    try:
        return await request_otp(OtpPurpose.email_change, payload["new_email"], ip=ip)
    except OtpCooldownError as exc:
        raise AuthError(
            "Please wait before requesting another code.",
            "otp_cooldown",
            429,
            metadata={"retry_after_seconds": exc.retry_after_seconds},
        ) from exc
    except OtpRateLimitError as exc:
        raise AuthError(str(exc), "rate_limited", 429) from exc


async def change_email_confirm(
    db: AsyncSession,
    *,
    user: User,
    session_id: UUID,
    change_token: str,
    otp: str,
    ip: str | None,
) -> dict[str, bool]:
    if not await has_step_up(str(user.id), str(session_id)):
        raise AuthError("Re-authenticate before confirming email change.", "step_up_required", 403)

    payload = await consume_pending_auth("email_change", change_token)
    if not payload or payload.get("user_id") != str(user.id):
        raise AuthError("Email change session expired.", "change_expired", 410)

    new_email = payload["new_email"]
    if not await verify_otp(OtpPurpose.email_change, new_email, otp):
        raise AuthError("Invalid or expired verification code.", "invalid_otp", 400)

    old_email = user.email
    user.email = new_email
    user.email_verified_at = _now()
    user.email_changed_at = _now()
    await revoke_all_sessions(db, user_id=user.id, ip=ip, except_session_id=session_id)
    await write_audit(
        db,
        event_type=AuditEventType.email_changed,
        user_id=user.id,
        ip=ip,
        metadata={"previous_email": old_email},
    )
    schedule_user_notification(
        user_id=user.id,
        user_email=new_email,
        notification_type=NotificationType.AUTH_EMAIL_CHANGED,
        title="Email address updated",
        body=(
            f"Your ZYND account email was changed to {new_email}.\n\n"
            "If you didn't make this change, contact support immediately."
        ),
        metadata={"previous_email": old_email, "new_email": new_email},
        idempotency_key=f"auth.email.changed:{user.id}:{user.email_changed_at.isoformat()}",
        email_subject="Your ZYND email address was updated",
    )
    if old_email and old_email != new_email:
        await send_security_email(
            to_email=old_email,
            subject="Your ZYND email address was changed",
            body=(
                f"Your ZYND account email was changed from {old_email} to {new_email}.\n\n"
                "If you didn't make this change, contact support immediately."
            ),
        )
    return {"ok": True}


async def request_account_deletion(
    db: AsyncSession,
    *,
    user: User,
    session_id: UUID,
    current_password: str,
    totp_code: str | None,
    sms_otp: str | None = None,
    ip: str | None,
) -> dict[str, Any]:
    await verify_step_up(
        db,
        user=user,
        session_id=session_id,
        current_password=current_password,
        totp_code=totp_code,
        sms_otp=sms_otp,
        ip=ip,
    )

    if user.role != UserRole.user:
        raise AuthError(
            "Admin and service accounts cannot use self-service deletion.",
            "admin_deletion_blocked",
            403,
        )

    settings = get_settings()
    user.status = UserStatus.deletion_pending
    user.deletion_requested_at = _now()
    user.deletion_scheduled_at = _now() + timedelta(days=settings.account_deletion_grace_days)

    scheduled_documents = await schedule_documents_for_account_deletion(db, user=user)

    db.add(
        DeletionLedger(
            user_id=user.id,
            event_type=DeletionEventType.deletion_requested,
            retention_policy="dpdp_grace_30d",
            metadata_={"channel": "web", "documents_scheduled_count": scheduled_documents},
        )
    )
    await revoke_all_sessions(db, user_id=user.id, ip=ip, except_session_id=session_id)
    await write_audit(
        db,
        event_type=AuditEventType.account_deletion_requested,
        user_id=user.id,
        ip=ip,
    )
    await send_security_email(
        to_email=user.email,
        subject="ZYND account deletion scheduled",
        body=(
            f"Your ZYND account is scheduled for deletion on "
            f"{user.deletion_scheduled_at.isoformat() if user.deletion_scheduled_at else 'the grace deadline'}.\n\n"
            "Sign in and visit Settings → Delete account to cancel before then."
        ),
    )
    return {"ok": True, "deletion_scheduled_at": user.deletion_scheduled_at}


async def cancel_account_deletion(
    db: AsyncSession,
    *,
    user: User,
    ip: str | None,
) -> dict[str, bool]:
    if user.status != UserStatus.deletion_pending:
        raise AuthError("No pending deletion request.", "no_deletion_pending", 400)

    user.status = UserStatus.active
    user.deletion_requested_at = None
    user.deletion_scheduled_at = None
    cleared_documents = await clear_document_deletion_schedule(db, user_id=user.id)
    db.add(
        DeletionLedger(
            user_id=user.id,
            event_type=DeletionEventType.deletion_cancelled,
            retention_policy="dpdp_grace_30d",
            metadata_={"channel": "web", "documents_unscheduled_count": cleared_documents},
        )
    )
    await write_audit(
        db,
        event_type=AuditEventType.account_deletion_cancelled,
        user_id=user.id,
        ip=ip,
    )
    return {"ok": True}


def fund_eligibility_status(user: User) -> dict[str, Any]:
    from app.application.auth.fund_movement_policy_service import (
        evaluate_fund_eligibility_with_policy,
    )

    result = evaluate_fund_eligibility_with_policy(
        user,
        require_mfa=False,
        require_pin=False,
    )
    return {"eligible": result["eligible"], "reasons": result["reasons"]}


def kyc_eligibility_status(user: User) -> dict[str, Any]:
    from app.application.kyc.eligibility import kyc_eligibility_status as _kyc_eligibility_status

    return _kyc_eligibility_status(user)
