from __future__ import annotations

from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.audit_service import write_audit
from app.application.auth.auth_session_context import (
    complete_authenticated_login,
    get_or_create_device,
    maybe_mfa_pending_login,
)
from app.application.auth.auth_client_policy import AuthClientKind, validate_user_role_for_client
from app.application.admin.rbac_service import list_user_role_keys
from app.application.distributor.partner_access_service import assert_distributor_partner_may_sign_in
from app.application.auth.errors import AuthError
from app.application.auth.mfa_service import user_has_mfa
from app.application.auth.progressive_lockout_service import (
    apply_login_delay,
    clear_failure_counters,
    evaluate_progressive_lockout,
    peek_failure_count,
    record_failure_counters,
    record_login_attempt,
)
from app.application.auth.risk_scoring_service import assess_login_risk, risk_metadata
from app.application.messaging.auth_events import schedule_login_failed, schedule_security_review_flagged
from app.application.shared.datetime_utils import utcnow
from app.core.config import Settings, get_settings
from app.infrastructure.persistence.models import (
    AuditEventType,
    User,
    UserStatus,
)
from app.infrastructure.security.passwords import TIMING_SAFE_DUMMY_HASH, verify_password
from app.infrastructure.security.rate_limit import check_rate_limit
from app.infrastructure.security.turnstile import verify_turnstile


async def check_email(db: AsyncSession, email: str) -> dict[str, Any]:
    normalized = email.lower().strip()
    result = await db.execute(select(User).where(User.email == normalized))
    user = result.scalar_one_or_none()
    if user and user.status == UserStatus.deleted:
        return {"next": "continue"}
    return {"next": "continue"}


async def login_with_email(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    turnstile_token: str | None,
    device_fingerprint: str,
    user_agent: str | None,
    ip: str | None,
    auth_client: AuthClientKind = "web",
    settings: Settings | None = None,
) -> dict[str, Any]:
    settings = settings or get_settings()
    normalized = email.lower().strip()

    if not await check_rate_limit(f"login:{ip or normalized}", 20, 3600):
        raise AuthError("Too many login attempts. Try again later.", "rate_limited", 429)

    lockout_state = await evaluate_progressive_lockout(db, email=normalized, ip=ip)
    if lockout_state.ip_blocked:
        await record_login_attempt(
            db,
            email=normalized,
            user_id=None,
            ip=ip,
            success=False,
            failure_reason="ip_blocked",
            captcha_required=lockout_state.captcha_required,
        )
        raise AuthError(
            "Too many failed attempts from this network. Try again later.",
            "ip_blocked",
            429,
            metadata={"captcha_required": True},
        )

    if lockout_state.account_locked:
        raise AuthError(
            "Account is temporarily locked. Try again later.",
            "account_locked",
            423,
            metadata={"captcha_required": True},
        )

    if not await verify_turnstile(
        turnstile_token,
        ip,
        required=lockout_state.captcha_required,
    ):
        raise AuthError(
            "Complete the security check to continue.",
            "captcha_required",
            403,
            metadata={"captcha_required": True},
        )

    result = await db.execute(select(User).where(User.email == normalized))
    user = result.scalar_one_or_none()

    password_hash = user.password_hash if user and user.password_hash else TIMING_SAFE_DUMMY_HASH
    password_valid = verify_password(password_hash, password)

    if not user or not user.password_hash:
        await apply_login_delay(lockout_state)
        attempt_count = await record_failure_counters(email=normalized, ip=ip)
        await record_login_attempt(
            db,
            email=normalized,
            user_id=None,
            ip=ip,
            success=False,
            failure_reason="invalid_credentials",
            captcha_required=attempt_count >= lockout_state.attempt_count,
        )
        await write_audit(db, event_type=AuditEventType.login_failure, ip=ip, metadata={"email": normalized})
        next_state = await evaluate_progressive_lockout(db, email=normalized, ip=ip, attempt_count=attempt_count)
        raise AuthError(
            "Invalid email or password.",
            "invalid_credentials",
            401,
            metadata={
                "captcha_required": next_state.captcha_required,
                "delay_seconds": next_state.delay_seconds,
            },
        )

    if user.status == UserStatus.deleted:
        raise AuthError("Account is no longer available.", "account_deleted", 403)

    if user.status == UserStatus.suspended:
        raise AuthError("Unable to sign in. Contact support.", "contact_support", 403)

    if user.is_locked and user.locked_until and user.locked_until > utcnow():
        raise AuthError(
            "Account is temporarily locked. Try again later.",
            "account_locked",
            423,
            metadata={"captcha_required": True},
        )

    if not password_valid:
        await apply_login_delay(lockout_state)
        attempt_count = await record_failure_counters(email=normalized, ip=ip)
        lockout_settings = await evaluate_progressive_lockout(
            db, email=normalized, ip=ip, attempt_count=attempt_count
        )
        from app.application.security.security_config_service import get_lockout_settings

        duration_settings = await get_lockout_settings(db)
        user.failed_login_count += 1
        if lockout_settings.account_locked:
            user.is_locked = True
            user.locked_until = utcnow() + timedelta(minutes=duration_settings["duration_minutes"])
        await record_login_attempt(
            db,
            email=normalized,
            user_id=user.id,
            ip=ip,
            success=False,
            failure_reason="invalid_credentials",
            captcha_required=lockout_settings.captcha_required,
        )
        await write_audit(
            db,
            event_type=AuditEventType.login_failure,
            user_id=user.id,
            ip=ip,
        )
        schedule_login_failed(
            email=normalized,
            user_id=user.id,
            ip=ip,
            reason="invalid_credentials",
        )
        raise AuthError(
            "Invalid email or password.",
            "invalid_credentials",
            401,
            metadata={
                "captcha_required": lockout_settings.captcha_required,
                "delay_seconds": lockout_settings.delay_seconds,
            },
        )

    await clear_failure_counters(email=normalized, ip=ip)
    user.failed_login_count = 0
    user.is_locked = False
    user.locked_until = None

    role_keys = await list_user_role_keys(db, user.id)
    validate_user_role_for_client(user, client=auth_client, role_keys=role_keys)
    await assert_distributor_partner_may_sign_in(db, user=user, role_keys=role_keys)

    device, is_new_device = await get_or_create_device(
        db, user=user, fingerprint=device_fingerprint, user_agent=user_agent
    )
    prior_failures = await peek_failure_count(email=normalized, ip=ip)
    risk = await assess_login_risk(
        db,
        user=user,
        device=device,
        is_new_device=is_new_device,
        ip=ip,
        failed_attempt_count=prior_failures,
    )
    if risk.action == "block_login":
        await record_login_attempt(
            db,
            email=normalized,
            user_id=user.id,
            ip=ip,
            success=False,
            failure_reason="adaptive_auth_blocked",
        )
        await write_audit(
            db,
            event_type=AuditEventType.adaptive_auth_blocked,
            user_id=user.id,
            ip=ip,
            metadata=risk_metadata(risk),
        )
        schedule_security_review_flagged(
            user_id=user.id,
            reason="login_velocity_flagged",
            metadata=risk_metadata(risk),
        )
        raise AuthError(
            "Sign-in blocked for your protection. Contact support if this is unexpected.",
            "login_blocked",
            403,
            metadata=risk_metadata(risk),
        )

    force_mfa = risk.action == "step_up_mfa"
    if user_has_mfa(user) or force_mfa:
        pending = await maybe_mfa_pending_login(
            user,
            device_fingerprint=device_fingerprint,
            user_agent=user_agent,
            auth_client=auth_client,
        )
    else:
        pending = None
    if not pending and not user_has_mfa(user):
        from app.application.auth.login_sms_service import maybe_sms_otp_pending_login

        pending = await maybe_sms_otp_pending_login(
            db,
            user,
            device_fingerprint=device_fingerprint,
            user_agent=user_agent,
            auth_client=auth_client,
            ip=ip,
        )
    if pending:
        await record_login_attempt(
            db,
            email=normalized,
            user_id=user.id,
            ip=ip,
            success=True,
            failure_reason=None,
        )
        from app.application.auth.login_sms_service import enrich_mfa_login_pending

        if pending.get("next") == "mfa_required":
            pending = await enrich_mfa_login_pending(db, user, pending)
        return pending

    if force_mfa:
        raise AuthError(
            "Additional verification is required. Enable MFA or verify your mobile number.",
            "step_up_required",
            403,
            metadata={"risk_level": risk.level, "reasons": risk.reasons},
        )

    login_result = await complete_authenticated_login(
        db,
        user=user,
        device_fingerprint=device_fingerprint,
        user_agent=user_agent,
        ip=ip,
        settings=settings,
    )
    await record_login_attempt(
        db,
        email=normalized,
        user_id=user.id,
        ip=ip,
        success=True,
    )
    if risk.level != "low":
        login_result.update(risk_metadata(risk))
    return login_result
