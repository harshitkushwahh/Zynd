from __future__ import annotations

import re
import secrets
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.rbac_service import MITRA_MANAGER_ROLE_KEY, MITRA_ROLE_KEY, list_user_role_keys
from app.application.auth.errors import AuthError
from app.application.distributor.client_onboarding_notifications import send_investor_set_password_email
from app.application.distributor.distributor_auth_service import assert_distributor_console_access
from app.application.distributor.distributor_branch_service import get_distributor_branch_for_manager
from app.application.distributor.distributor_client_link_service import (
    DistributorClientBookError,
    create_distributor_client_link,
)
from app.application.documents.client_id_service import assign_client_id
from app.application.identity.otp_purposes import OtpPurpose
from app.application.investor.investor_identity_uniqueness_service import (
    InvestorIdentityConflictError,
    assert_email_available_for_new_investor,
    assert_phone_available_for_new_investor,
)
from app.application.ports.otp_gateway import OtpCooldownError, OtpRateLimitError, request_otp, verify_otp
from app.application.shared.datetime_utils import utcnow
from app.infrastructure.persistence.client_onboarding_draft_store import (
    CLIENT_ONBOARDING_TTL_SECONDS,
    create_client_onboarding_draft,
    delete_client_onboarding_draft,
    get_client_onboarding_draft,
    update_client_onboarding_draft,
)
from app.infrastructure.persistence.models import AuditEventType, AuditLog, User, UserRole, UserStatus
from app.infrastructure.security.passwords import hash_password
from app.infrastructure.security.rate_limit import check_rate_limit


class ClientOnboardingError(Exception):
    def __init__(self, message: str, code: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


def _otp_cooldown_error(exc: OtpCooldownError) -> ClientOnboardingError:
    return ClientOnboardingError(
        "Please wait before requesting another code.",
        "otp_cooldown",
        429,
    )


def _normalize_mobile(value: str) -> str:
    digits = re.sub(r"\D", "", value.strip())
    if len(digits) == 10:
        return digits
    if len(digits) == 12 and digits.startswith("91"):
        return digits[2:]
    if len(digits) >= 10:
        return digits[-10:]
    raise ClientOnboardingError("Enter a valid 10-digit mobile number.", "invalid_mobile", 400)


async def _assert_actor_can_onboard_clients(db: AsyncSession, actor: User) -> User:
    role_keys = await list_user_role_keys(db, actor.id)
    try:
        assert_distributor_console_access(role_keys)
    except AuthError as exc:
        raise ClientOnboardingError(exc.message, exc.code, exc.status_code) from exc

    if MITRA_MANAGER_ROLE_KEY in role_keys:
        branch = await get_distributor_branch_for_manager(db, manager_user_id=actor.id)
        if not branch:
            raise ClientOnboardingError(
                "A branch must be assigned before adding clients.",
                "branch_assignment_required",
                403,
            )
        return actor

    if MITRA_ROLE_KEY in role_keys:
        from app.infrastructure.persistence.distributor_partner_models import (
            DistributorPartner,
            DistributorPartnerStatus,
        )

        result = await db.execute(
            select(DistributorPartner).where(
                DistributorPartner.user_id == actor.id,
                DistributorPartner.status == DistributorPartnerStatus.active,
            )
        )
        partner = result.scalar_one_or_none()
        if partner is None:
            raise ClientOnboardingError(
                "Your Zynd Mitra account must be active before adding clients.",
                "mitra_not_active",
                403,
            )
        if not partner.branch_id:
            raise ClientOnboardingError(
                "A branch must be assigned before adding clients.",
                "branch_assignment_required",
                403,
            )
        if not actor.client_id or not actor.client_id.startswith("ZYND-M-"):
            raise ClientOnboardingError(
                "Zynd Mitra code is missing. Contact support before adding clients.",
                "mitra_code_missing",
                403,
            )
        return actor

    raise ClientOnboardingError(
        "Only Zynd Mitras and branch managers can add investors.",
        "distributor_actor_required",
        403,
    )


async def _assert_email_available(db: AsyncSession, email: str) -> None:
    try:
        await assert_email_available_for_new_investor(db, email)
    except InvestorIdentityConflictError as exc:
        raise ClientOnboardingError(exc.message, exc.code, exc.status_code) from exc


async def _assert_phone_available(db: AsyncSession, phone: str) -> None:
    try:
        await assert_phone_available_for_new_investor(db, phone)
    except InvestorIdentityConflictError as exc:
        raise ClientOnboardingError(exc.message, exc.code, exc.status_code) from exc


async def _load_draft(token: str) -> dict[str, Any]:
    draft = await get_client_onboarding_draft(token)
    if not draft:
        raise ClientOnboardingError(
            "Onboarding session expired. Please start again.",
            "onboarding_expired",
            410,
        )
    return draft


async def _assert_actor_owns_draft(draft: dict[str, Any], actor: User) -> None:
    if str(draft.get("actor_user_id")) != str(actor.id):
        raise ClientOnboardingError("Invalid onboarding session.", "onboarding_invalid", 403)


def _serialize_client_onboarding_draft(draft: dict[str, Any]) -> dict[str, Any]:
    email_verified = bool(draft.get("email_verified"))
    mobile_verified = bool(draft.get("mobile_verified"))
    return {
        "email": draft.get("email"),
        "email_verified": email_verified,
        "mobile": draft.get("mobile"),
        "mobile_verified": mobile_verified,
        "ready_to_create": email_verified and mobile_verified,
    }


async def get_client_onboarding_draft_snapshot(
    *,
    actor: User,
    onboarding_token: str,
) -> dict[str, Any]:
    draft = await _load_draft(onboarding_token)
    await _assert_actor_owns_draft(draft, actor)
    return _serialize_client_onboarding_draft(draft)


async def discard_client_onboarding_draft(
    *,
    actor: User,
    onboarding_token: str,
) -> None:
    draft = await _load_draft(onboarding_token)
    await _assert_actor_owns_draft(draft, actor)
    await delete_client_onboarding_draft(onboarding_token)


async def update_client_onboarding_contact(
    db: AsyncSession,
    *,
    actor: User,
    onboarding_token: str,
    email: str | None = None,
    mobile: str | None = None,
    ip: str | None,
) -> dict[str, Any]:
    if email is None and mobile is None:
        raise ClientOnboardingError("Nothing to update.", "invalid_request", 400)

    draft = await _load_draft(onboarding_token)
    await _assert_actor_owns_draft(draft, actor)

    updates: dict[str, Any] = {}
    otp_meta: dict[str, int] | None = None

    if email is not None:
        normalized = email.lower().strip()
        if "@" not in normalized:
            raise ClientOnboardingError("Enter a valid email address.", "invalid_email", 400)

        current_email = str(draft.get("email") or "").lower()
        if normalized != current_email:
            await _assert_email_available(db, normalized)
            updates["email"] = normalized
            updates["email_verified"] = False
            updates["mobile"] = None
            updates["mobile_verified"] = False
        elif draft.get("email_verified"):
            raise ClientOnboardingError("Email is already verified.", "email_already_verified", 400)

        target_email = normalized
        try:
            otp_meta = await request_otp(OtpPurpose.client_onboarding_email, target_email, ip=ip)
        except OtpCooldownError as exc:
            raise _otp_cooldown_error(exc) from exc
        except OtpRateLimitError as exc:
            raise ClientOnboardingError(str(exc), "rate_limited", 429) from exc

    if mobile is not None:
        effective_draft = {**draft, **updates}
        if not effective_draft.get("email_verified"):
            raise ClientOnboardingError("Verify email before adding a mobile number.", "email_not_verified", 400)

        normalized_mobile = _normalize_mobile(mobile)
        current_mobile = str(draft.get("mobile") or "")
        if normalized_mobile != current_mobile:
            await _assert_phone_available(db, normalized_mobile)
            updates["mobile"] = normalized_mobile
            updates["mobile_verified"] = False
        elif draft.get("mobile_verified"):
            raise ClientOnboardingError("Mobile is already verified.", "mobile_already_verified", 400)

        try:
            otp_meta = await request_otp(OtpPurpose.client_onboarding_mobile, normalized_mobile, ip=ip)
        except OtpCooldownError as exc:
            raise _otp_cooldown_error(exc) from exc
        except OtpRateLimitError as exc:
            raise ClientOnboardingError(str(exc), "rate_limited", 429) from exc

    if updates:
        await update_client_onboarding_draft(onboarding_token, updates)
        draft = {**draft, **updates}
    elif otp_meta is None:
        raise ClientOnboardingError("Contact details are already verified.", "contact_already_verified", 400)

    return {
        **(otp_meta or {"retry_after_seconds": 0, "expires_in": CLIENT_ONBOARDING_TTL_SECONDS}),
        **_serialize_client_onboarding_draft(draft),
    }


async def start_client_onboarding(
    db: AsyncSession,
    *,
    actor: User,
    email: str,
    ip: str | None,
) -> dict[str, str | int]:
    owner = await _assert_actor_can_onboard_clients(db, actor)
    normalized = email.lower().strip()
    if "@" not in normalized:
        raise ClientOnboardingError("Enter a valid email address.", "invalid_email", 400)

    if not await check_rate_limit(f"client_onboarding:{ip or normalized}", 10, 3600):
        raise ClientOnboardingError("Too many onboarding attempts. Try again later.", "rate_limited", 429)

    await _assert_email_available(db, normalized)

    try:
        otp_meta = await request_otp(OtpPurpose.client_onboarding_email, normalized, ip=ip)
    except OtpCooldownError as exc:
        raise _otp_cooldown_error(exc) from exc
    except OtpRateLimitError as exc:
        raise ClientOnboardingError(str(exc), "rate_limited", 429) from exc

    token = await create_client_onboarding_draft(
        email=normalized,
        actor_user_id=str(actor.id),
        mitra_owner_user_id=str(owner.id),
    )
    return {"onboarding_token": token, **otp_meta}


async def resend_client_onboarding_email_otp(
    *,
    onboarding_token: str,
    ip: str | None,
) -> dict[str, int]:
    draft = await _load_draft(onboarding_token)
    if draft.get("email_verified"):
        raise ClientOnboardingError("Email is already verified.", "email_already_verified", 400)
    try:
        return await request_otp(OtpPurpose.client_onboarding_email, draft["email"], ip=ip)
    except OtpCooldownError as exc:
        raise _otp_cooldown_error(exc) from exc
    except OtpRateLimitError as exc:
        raise ClientOnboardingError(str(exc), "rate_limited", 429) from exc


async def verify_client_onboarding_email(
    *,
    onboarding_token: str,
    otp: str,
) -> dict[str, bool]:
    draft = await _load_draft(onboarding_token)
    if not await verify_otp(OtpPurpose.client_onboarding_email, draft["email"], otp):
        raise ClientOnboardingError("Invalid or expired verification code.", "invalid_otp", 401)
    await update_client_onboarding_draft(onboarding_token, {"email_verified": True})
    return {"verified": True}


async def send_client_onboarding_mobile_otp(
    db: AsyncSession,
    *,
    onboarding_token: str,
    mobile: str,
    ip: str | None,
) -> dict[str, int]:
    draft = await _load_draft(onboarding_token)
    if not draft.get("email_verified"):
        raise ClientOnboardingError("Verify email before adding a mobile number.", "email_not_verified", 400)
    normalized = _normalize_mobile(mobile)
    await _assert_phone_available(db, normalized)
    await update_client_onboarding_draft(onboarding_token, {"mobile": normalized, "mobile_verified": False})
    try:
        return await request_otp(OtpPurpose.client_onboarding_mobile, normalized, ip=ip)
    except OtpCooldownError as exc:
        raise _otp_cooldown_error(exc) from exc
    except OtpRateLimitError as exc:
        raise ClientOnboardingError(str(exc), "rate_limited", 429) from exc


async def resend_client_onboarding_mobile_otp(
    *,
    onboarding_token: str,
    ip: str | None,
) -> dict[str, int]:
    draft = await _load_draft(onboarding_token)
    mobile = draft.get("mobile")
    if not mobile:
        raise ClientOnboardingError("Enter a mobile number first.", "mobile_missing", 400)
    if draft.get("mobile_verified"):
        raise ClientOnboardingError("Mobile is already verified.", "mobile_already_verified", 400)
    try:
        return await request_otp(OtpPurpose.client_onboarding_mobile, mobile, ip=ip)
    except OtpCooldownError as exc:
        raise _otp_cooldown_error(exc) from exc
    except OtpRateLimitError as exc:
        raise ClientOnboardingError(str(exc), "rate_limited", 429) from exc


async def verify_client_onboarding_mobile(
    *,
    onboarding_token: str,
    otp: str,
) -> dict[str, bool]:
    draft = await _load_draft(onboarding_token)
    mobile = draft.get("mobile")
    if not mobile:
        raise ClientOnboardingError("Enter a mobile number first.", "mobile_missing", 400)
    if not await verify_otp(OtpPurpose.client_onboarding_mobile, mobile, otp):
        raise ClientOnboardingError("Invalid or expired verification code.", "invalid_otp", 401)
    await update_client_onboarding_draft(onboarding_token, {"mobile_verified": True})
    return {"verified": True}


async def submit_client_onboarding(
    db: AsyncSession,
    *,
    actor: User,
    onboarding_token: str,
    ip: str | None,
) -> dict[str, Any]:
    await _assert_actor_can_onboard_clients(db, actor)
    draft = await _load_draft(onboarding_token)
    if str(draft.get("actor_user_id")) != str(actor.id):
        raise ClientOnboardingError("Invalid onboarding session.", "onboarding_invalid", 403)
    if not draft.get("email_verified") or not draft.get("mobile_verified"):
        raise ClientOnboardingError(
            "Complete email and mobile verification before submitting.",
            "verification_incomplete",
            400,
        )

    email = draft["email"]
    mobile = draft["mobile"]
    await _assert_email_available(db, email)
    await _assert_phone_available(db, mobile)

    owner = await db.get(User, draft["mitra_owner_user_id"])
    if owner is None:
        raise ClientOnboardingError("Book owner not found.", "mitra_owner_missing", 404)

    now = utcnow()
    random_password = secrets.token_urlsafe(24)
    user = User(
        email=email,
        phone=mobile,
        role=UserRole.user,
        status=UserStatus.active,
        email_verified_at=now,
        phone_verified_at=now,
        password_hash=hash_password(random_password),
    )
    db.add(user)
    await db.flush()
    await assign_client_id(db, user)
    await db.flush()

    link = await create_distributor_client_link(
        db,
        client_user=user,
        actor=actor,
        mitra_owner=owner,
    )

    await send_investor_set_password_email(user)

    db.add(
        AuditLog(
            user_id=actor.id,
            event_type=AuditEventType.admin_action_requested,
            ip_address=ip,
            metadata_={
                "kind": "distributor_client_onboarded",
                "client_user_id": str(user.id),
                "client_id": user.client_id,
                "mitra_client_id": link.mitra_client_id,
                "mitra_user_id": str(link.mitra_user_id),
            },
        )
    )
    await delete_client_onboarding_draft(onboarding_token)
    await db.flush()

    return {
        "client_user_id": user.id,
        "client_id": user.client_id,
        "mitra_client_id": link.mitra_client_id,
        "email": user.email,
        "mobile": user.phone or "",
    }
