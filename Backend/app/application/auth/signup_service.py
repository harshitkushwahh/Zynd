from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.auth_session_context import (
    create_authenticated_session,
    get_or_create_device,
)
from app.application.auth.errors import AuthError
from app.application.documents.client_id_service import assign_client_id
from app.application.identity.otp_purposes import OtpPurpose
from app.application.ports.email_gateway import send_security_email
from app.application.ports.otp_gateway import OtpCooldownError, OtpRateLimitError, request_otp, verify_otp
from app.application.referral.referral_attribution_service import attribute_referral_signup
from app.application.referral.referral_code_service import normalize_referral_code, resolve_active_referral_code
from app.infrastructure.persistence.referral_models import ReferralSignupChannel
from app.application.shared.datetime_utils import utcnow
from app.core.config import Settings, get_settings
from app.infrastructure.persistence.models import User, UserRole, UserStatus
from app.infrastructure.persistence.signup_draft_store import (
    create_signup_draft,
    delete_signup_draft,
    get_signup_draft,
    update_signup_draft,
)
from app.infrastructure.security.hibp_service import (
    HibpUnavailableError,
    PasswordPwnedError,
    ensure_password_not_pwned,
)
from app.infrastructure.security.passwords import hash_password
from app.infrastructure.security.rate_limit import check_rate_limit
from app.infrastructure.security.turnstile import verify_turnstile


def _otp_cooldown_error(exc: OtpCooldownError) -> AuthError:
    return AuthError(
        "Please wait before requesting another code.",
        "otp_cooldown",
        429,
        metadata={"retry_after_seconds": exc.retry_after_seconds},
    )


async def _assert_email_available_for_signup(db: AsyncSession, email: str) -> None:
    result = await db.execute(
        select(User).where(User.email == email, User.status != UserStatus.deleted)
    )
    if result.scalar_one_or_none():
        raise AuthError(
            "An account with this email already exists. Sign in instead.",
            "email_already_registered",
            409,
        )


async def _assert_phone_available(db: AsyncSession, phone: str) -> None:
    result = await db.execute(
        select(User).where(User.phone == phone, User.status != UserStatus.deleted)
    )
    if result.scalar_one_or_none():
        raise AuthError(
            "This mobile number is already linked to another account.",
            "phone_already_registered",
            409,
        )


def _raise_signup_identity_conflict(exc: IntegrityError) -> None:
    message = str(exc.orig) if exc.orig else str(exc)
    if "ix_users_phone" in message or "users_phone" in message:
        raise AuthError(
            "This mobile number is already linked to another account.",
            "phone_already_registered",
            409,
        ) from exc
    if "ix_users_email" in message or "users_email" in message:
        raise AuthError(
            "An account with this email already exists. Sign in instead.",
            "email_already_registered",
            409,
        ) from exc
    raise exc


async def signup_start(
    db: AsyncSession,
    *,
    email: str,
    turnstile_token: str | None,
    ip: str | None,
    referral_code: str | None = None,
) -> dict[str, str | int]:
    if not await check_rate_limit(f"signup:{ip or email}", 10, 3600):
        raise AuthError("Too many signup attempts. Try again later.", "rate_limited", 429)
    if not await verify_turnstile(turnstile_token, ip):
        raise AuthError("Bot verification failed.", "turnstile_failed", 403)

    normalized = email.lower().strip()
    result = await db.execute(select(User).where(User.email == normalized))
    existing = result.scalar_one_or_none()
    if existing and existing.status != UserStatus.deleted:
        await send_security_email(
            to_email=existing.email,
            subject="Signup attempt on your ZYND account",
            body=(
                "Someone tried to create a ZYND account using your email address.\n\n"
                "If this was you, sign in instead. If not, you can ignore this message."
            ),
        )
        return {
            "next": "login",
            "message": "An account with this email already exists. Sign in with your password.",
            "retry_after_seconds": 0,
            "expires_in": 0,
        }

    try:
        otp_meta = await request_otp(OtpPurpose.signup_email, normalized, ip=ip)
    except OtpCooldownError as exc:
        raise _otp_cooldown_error(exc) from exc
    except OtpRateLimitError as exc:
        raise AuthError(str(exc), "rate_limited", 429) from exc

    signup_token = await create_signup_draft(
        normalized,
        referral_code=await _resolve_signup_referral_code(db, referral_code),
    )
    return {"next": "signup", "signup_token": signup_token, **otp_meta}


async def _resolve_signup_referral_code(db: AsyncSession, referral_code: str | None) -> str | None:
    normalized = normalize_referral_code(referral_code)
    if not normalized:
        return None
    row = await resolve_active_referral_code(db, code=normalized)
    if row is None:
        return None
    return row.code


async def signup_resend_email_otp(signup_token: str, ip: str | None) -> dict[str, int]:
    draft = await get_signup_draft(signup_token)
    if not draft:
        raise AuthError("Signup session expired. Please start again.", "signup_expired", 410)
    if draft.get("decoy"):
        raise AuthError("Invalid or expired verification code.", "invalid_otp", 400)
    if draft.get("email_verified"):
        raise AuthError("Email is already verified.", "email_already_verified", 400)

    try:
        return await request_otp(OtpPurpose.signup_email, draft["email"], ip=ip)
    except OtpCooldownError as exc:
        raise _otp_cooldown_error(exc) from exc
    except OtpRateLimitError as exc:
        raise AuthError(str(exc), "rate_limited", 429) from exc


async def signup_verify_email(signup_token: str, otp: str) -> dict[str, bool]:
    draft = await get_signup_draft(signup_token)
    if not draft:
        raise AuthError("Signup session expired. Please start again.", "signup_expired", 410)
    if draft.get("decoy"):
        raise AuthError("Invalid or expired verification code.", "invalid_otp", 400)
    if not await verify_otp(OtpPurpose.signup_email, draft["email"], otp):
        raise AuthError("Invalid or expired verification code.", "invalid_otp", 400)
    await update_signup_draft(signup_token, {"email_verified": True})
    return {"verified": True}


async def signup_set_password(signup_token: str, password: str) -> dict[str, bool]:
    draft = await get_signup_draft(signup_token)
    if not draft or not draft.get("email_verified") or draft.get("decoy"):
        raise AuthError("Verify your email before setting a password.", "email_not_verified", 400)
    try:
        await ensure_password_not_pwned(password)
    except PasswordPwnedError as exc:
        raise AuthError(str(exc), "password_pwned", 400) from exc
    except HibpUnavailableError as exc:
        raise AuthError(str(exc), "hibp_unavailable", 503) from exc
    await update_signup_draft(signup_token, {"password_hash": hash_password(password)})
    return {"ok": True}


async def signup_send_mobile_otp(
    db: AsyncSession,
    signup_token: str,
    mobile: str,
    country_code: str = "IN",
    ip: str | None = None,
) -> dict[str, Any]:
    draft = await get_signup_draft(signup_token)
    if not draft or not draft.get("password_hash"):
        raise AuthError("Set your password before verifying mobile.", "password_required", 400)

    digits = "".join(c for c in mobile if c.isdigit())
    if len(digits) != 10 or digits[0] not in "6789":
        raise AuthError("Enter a valid 10-digit mobile number.", "invalid_mobile", 400)

    await _assert_phone_available(db, digits)

    try:
        otp_meta = await request_otp(OtpPurpose.signup_mobile, digits, ip=ip)
    except OtpCooldownError as exc:
        raise _otp_cooldown_error(exc) from exc
    except OtpRateLimitError as exc:
        raise AuthError(str(exc), "rate_limited", 429) from exc
    await update_signup_draft(
        signup_token,
        {"mobile": digits, "country_code": country_code, "mobile_verified": False},
    )
    return {"ok": True, **otp_meta}


async def signup_verify_mobile(signup_token: str, otp: str) -> dict[str, bool]:
    draft = await get_signup_draft(signup_token)
    if not draft or not draft.get("mobile"):
        raise AuthError("Enter your mobile number first.", "mobile_required", 400)
    if not await verify_otp(OtpPurpose.signup_mobile, draft["mobile"], otp):
        raise AuthError("Invalid or expired verification code.", "invalid_otp", 400)
    await update_signup_draft(signup_token, {"mobile_verified": True})
    return {"verified": True}


async def signup_complete(
    db: AsyncSession,
    *,
    signup_token: str,
    first_name: str,
    last_name: str,
    middle_name: str | None,
    device_fingerprint: str,
    user_agent: str | None,
    ip: str | None,
    settings: Settings | None = None,
) -> tuple[User, str, str]:
    settings = settings or get_settings()
    draft = await get_signup_draft(signup_token)
    if not draft or not draft.get("mobile_verified") or not draft.get("password_hash"):
        raise AuthError("Complete all signup steps first.", "signup_incomplete", 400)

    await _assert_email_available_for_signup(db, draft["email"])
    await _assert_phone_available(db, draft["mobile"])

    user = User(
        email=draft["email"],
        phone=draft["mobile"],
        password_hash=draft["password_hash"],
        first_name=first_name.strip(),
        middle_name=middle_name.strip() if middle_name else None,
        last_name=last_name.strip(),
        country_code=draft.get("country_code", "IN"),
        email_verified_at=utcnow(),
        phone_verified_at=utcnow(),
        role=UserRole.user,
    )
    await assign_client_id(db, user)
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as exc:
        _raise_signup_identity_conflict(exc)

    await attribute_referral_signup(
        db,
        referee=user,
        referral_code=draft.get("referral_code"),
        channel=ReferralSignupChannel.email,
    )

    device, _ = await get_or_create_device(
        db, user=user, fingerprint=device_fingerprint, user_agent=user_agent
    )
    access_token, refresh_token, _ = await create_authenticated_session(
        db, user=user, device=device, settings=settings, ip=ip
    )
    await delete_signup_draft(signup_token)
    return user, access_token, refresh_token
