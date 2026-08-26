from __future__ import annotations

from datetime import timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.rbac_service import DISTRIBUTOR_CONSOLE_ROLE_KEYS
from app.application.auth.auth_client_policy import (
    AuthClientKind,
    invite_target_console,
    is_admin_device_fingerprint,
    is_distributor_device_fingerprint,
    resolve_auth_client_kind,
    validate_invite_client_for_role,
)
from app.application.auth.auth_session_context import complete_authenticated_login
from app.application.auth.errors import AuthError
from app.application.auth.mfa_service import (
    build_provisioning_uri,
    generate_totp_secret,
    save_pending_mfa_enrollment,
    verify_totp_code,
)
from app.application.referral.referral_qr_service import generate_referral_qr_png
from app.application.auth.pin_service import store_pin_unlock, validate_pin_format
from app.application.documents.client_id_service import (
    assign_client_id,
    assign_zynd_persona_client_id,
    zynd_persona_role_code_for_admin_role,
)
from app.application.ports.email_gateway import send_security_email
from app.application.shared.datetime_utils import utcnow
from app.core.config import Settings, get_settings
from app.infrastructure.persistence.admin_invite_onboarding_store import (
    create_admin_invite_onboarding_draft,
    delete_admin_invite_onboarding_draft,
    get_admin_invite_onboarding_draft,
    update_admin_invite_onboarding_draft,
)
from app.infrastructure.persistence.admin_invite_token_store import (
    create_admin_invite_token,
    delete_admin_invite_token,
    get_admin_invite_token,
)
from app.infrastructure.persistence.models import (
    AdminInvitation,
    AdminInvitationStatus,
    AdminRole,
    AuditEventType,
    AuditLog,
    User,
    UserBackupCode,
    UserRole,
    UserStatus,
)
from app.infrastructure.security.pending_auth import (
    consume_pending_auth,
    generate_backup_codes,
    generate_pending_token,
    peek_pending_auth,
    store_pending_auth,
)
from app.infrastructure.security.hibp_service import (
    HibpUnavailableError,
    PasswordPwnedError,
    ensure_password_not_pwned,
)
from app.infrastructure.security.password_policy import (
    PasswordStrengthError,
    validate_password_strength,
)
from app.infrastructure.security.passwords import hash_password

INVITE_VALIDITY = timedelta(hours=72)


def _now():
    return utcnow()


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _invite_url(token: str, *, role_key: str, settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    if role_key in DISTRIBUTOR_CONSOLE_ROLE_KEYS:
        base = settings.distributor_frontend_url.rstrip("/")
    else:
        base = settings.admin_frontend_url.rstrip("/")
    return f"{base}/accept-invite?token={token}"


def _resolve_invite_auth_client(*, header: str | None, fingerprint: str | None) -> AuthClientKind:
    if header:
        return resolve_auth_client_kind(header=header, fingerprint=fingerprint)
    if is_distributor_device_fingerprint(fingerprint):
        return "distributor"
    if is_admin_device_fingerprint(fingerprint):
        return "admin"
    return "web"


def _invitation_to_dict(
    invitation: AdminInvitation,
    *,
    role_name: str | None = None,
    inviter_name: str | None = None,
) -> dict[str, Any]:
    return {
        "id": invitation.id,
        "email": invitation.email,
        "first_name": invitation.first_name,
        "last_name": invitation.last_name,
        "role_key": invitation.role_key,
        "role_name": role_name,
        "status": invitation.status.value,
        "invited_by": invitation.invited_by,
        "inviter_name": inviter_name,
        "accepted_user_id": invitation.accepted_user_id,
        "expires_at": invitation.expires_at,
        "accepted_at": invitation.accepted_at,
        "revoked_at": invitation.revoked_at,
        "created_at": invitation.created_at,
        "updated_at": invitation.updated_at,
    }


async def _get_role_name(db: AsyncSession, role_key: str) -> str | None:
    result = await db.execute(select(AdminRole).where(AdminRole.key == role_key))
    role = result.scalar_one_or_none()
    return role.name if role else None


async def _get_inviter_name(db: AsyncSession, user_id: UUID | None) -> str | None:
    if not user_id:
        return None
    user = await db.get(User, user_id)
    if not user:
        return None
    parts = [user.first_name, user.last_name]
    name = " ".join(part for part in parts if part)
    return name or user.email


async def _mark_expired_invitations(db: AsyncSession) -> None:
    now = _now()
    result = await db.execute(
        select(AdminInvitation).where(
            AdminInvitation.status == AdminInvitationStatus.pending,
            AdminInvitation.expires_at <= now,
        )
    )
    for invitation in result.scalars().all():
        invitation.status = AdminInvitationStatus.expired
        invitation.updated_at = now


async def _ensure_email_available(db: AsyncSession, email: str) -> None:
    existing = await db.execute(select(User).where(User.email == email))
    user = existing.scalar_one_or_none()
    if not user:
        return
    if user.role == UserRole.user:
        raise ValueError(
            "This email is already used by a customer account. "
            "Admin accounts must use a separate email."
        )
    raise ValueError("An admin account with this email already exists.")


async def _ensure_no_active_invite(db: AsyncSession, email: str) -> None:
    now = _now()
    result = await db.execute(
        select(AdminInvitation).where(
            AdminInvitation.email == email,
            AdminInvitation.status == AdminInvitationStatus.pending,
            AdminInvitation.expires_at > now,
        )
    )
    if result.scalar_one_or_none():
        raise ValueError("A pending invitation already exists for this email.")


async def _load_invitation_for_token(db: AsyncSession, token: str) -> AdminInvitation:
    invitation_id = await get_admin_invite_token(token)
    if not invitation_id:
        raise AuthError("Invalid or expired invitation link.", "invalid_invite_token", 400)

    invitation = await db.get(AdminInvitation, UUID(invitation_id))
    if not invitation:
        raise AuthError("Invalid or expired invitation link.", "invalid_invite_token", 400)

    now = _now()
    if invitation.status == AdminInvitationStatus.revoked:
        raise AuthError("This invitation was revoked.", "invite_revoked", 400)
    if invitation.status == AdminInvitationStatus.accepted:
        raise AuthError("This invitation has already been used.", "invite_already_used", 400)
    if invitation.status == AdminInvitationStatus.expired or invitation.expires_at <= now:
        invitation.status = AdminInvitationStatus.expired
        invitation.updated_at = now
        raise AuthError("This invitation has expired.", "invite_expired", 400)

    return invitation


async def _send_invite_email(
    *,
    invitation: AdminInvitation,
    token: str,
    inviter_name: str | None,
    role_name: str | None,
) -> None:
    settings = get_settings()
    invite_url = _invite_url(token, role_key=invitation.role_key, settings=settings)
    inviter_label = inviter_name or "A ZYND administrator"
    role_label = role_name or invitation.role_key
    if invitation.role_key in DISTRIBUTOR_CONSOLE_ROLE_KEYS:
        subject = "You're invited to the Zynd Mitra console"
        product_label = "Zynd Mitra console"
    else:
        subject = "You're invited to the ZYND Admin Console"
        product_label = "ZYND Admin Console"
    await send_security_email(
        to_email=invitation.email,
        subject=subject,
        body=(
            f"{inviter_label} invited you to join the {product_label} as {role_label}.\n\n"
            f"Open this secure link to set up your account:\n{invite_url}\n\n"
            "The link expires in 72 hours and can only be used once.\n"
            "If you were not expecting this invitation, you can ignore this email."
        ),
    )


async def create_admin_invitation(
    db: AsyncSession,
    *,
    actor: User,
    email: str,
    role_key: str,
    first_name: str | None = None,
    last_name: str | None = None,
    ip: str | None = None,
) -> dict[str, Any]:
    from app.application.admin.rbac_service import ensure_rbac_seed

    await ensure_rbac_seed(db)
    await _mark_expired_invitations(db)

    normalized_email = _normalize_email(email)
    if not normalized_email:
        raise ValueError("Email is required.")

    role_name = await _get_role_name(db, role_key)
    if not role_name:
        raise ValueError("Selected team role was not found.")

    await _ensure_email_available(db, normalized_email)
    await _ensure_no_active_invite(db, normalized_email)

    now = _now()
    invitation = AdminInvitation(
        email=normalized_email,
        first_name=first_name.strip() if first_name else None,
        last_name=last_name.strip() if last_name else None,
        role_key=role_key,
        status=AdminInvitationStatus.pending,
        invited_by=actor.id,
        expires_at=now + INVITE_VALIDITY,
    )
    db.add(invitation)
    await db.flush()

    token = await create_admin_invite_token(str(invitation.id))
    inviter_name = await _get_inviter_name(db, actor.id)
    await _send_invite_email(
        invitation=invitation,
        token=token,
        inviter_name=inviter_name,
        role_name=role_name,
    )

    db.add(
        AuditLog(
            user_id=actor.id,
            event_type=AuditEventType.admin_action_requested,
            ip_address=ip,
            metadata_={
                "kind": "admin_invitation_sent",
                "invitation_id": str(invitation.id),
                "email": normalized_email,
                "role_key": role_key,
            },
        )
    )
    await db.flush()

    return _invitation_to_dict(
        invitation,
        role_name=role_name,
        inviter_name=inviter_name,
    )


async def list_admin_invitations(db: AsyncSession) -> list[dict[str, Any]]:
    await _mark_expired_invitations(db)
    result = await db.execute(
        select(AdminInvitation).order_by(AdminInvitation.created_at.desc())
    )
    items: list[dict[str, Any]] = []
    for invitation in result.scalars().all():
        role_name = await _get_role_name(db, invitation.role_key)
        inviter_name = await _get_inviter_name(db, invitation.invited_by)
        items.append(
            _invitation_to_dict(
                invitation,
                role_name=role_name,
                inviter_name=inviter_name,
            )
        )
    return items


async def revoke_admin_invitation(
    db: AsyncSession,
    *,
    actor: User,
    invitation_id: UUID,
    ip: str | None = None,
) -> dict[str, Any]:
    invitation = await db.get(AdminInvitation, invitation_id)
    if not invitation:
        raise ValueError("Invitation not found.")
    if invitation.status != AdminInvitationStatus.pending:
        raise ValueError("Only pending invitations can be revoked.")

    now = _now()
    invitation.status = AdminInvitationStatus.revoked
    invitation.revoked_at = now
    invitation.updated_at = now

    db.add(
        AuditLog(
            user_id=actor.id,
            event_type=AuditEventType.admin_action_requested,
            ip_address=ip,
            metadata_={
                "kind": "admin_invitation_revoked",
                "invitation_id": str(invitation.id),
                "email": invitation.email,
            },
        )
    )
    await db.flush()

    return _invitation_to_dict(
        invitation,
        role_name=await _get_role_name(db, invitation.role_key),
        inviter_name=await _get_inviter_name(db, invitation.invited_by),
    )


async def resend_admin_invitation(
    db: AsyncSession,
    *,
    actor: User,
    invitation_id: UUID,
    ip: str | None = None,
) -> dict[str, Any]:
    invitation = await db.get(AdminInvitation, invitation_id)
    if not invitation:
        raise ValueError("Invitation not found.")
    if invitation.status != AdminInvitationStatus.pending:
        raise ValueError("Only pending invitations can be resent.")

    now = _now()
    if invitation.expires_at <= now:
        invitation.status = AdminInvitationStatus.expired
        invitation.updated_at = now
        raise ValueError("This invitation has expired. Send a new invitation instead.")

    await _ensure_email_available(db, invitation.email)
    invitation.expires_at = now + INVITE_VALIDITY
    invitation.updated_at = now
    await db.flush()

    token = await create_admin_invite_token(str(invitation.id))
    inviter_name = await _get_inviter_name(db, invitation.invited_by)
    role_name = await _get_role_name(db, invitation.role_key)
    await _send_invite_email(
        invitation=invitation,
        token=token,
        inviter_name=inviter_name,
        role_name=role_name,
    )

    db.add(
        AuditLog(
            user_id=actor.id,
            event_type=AuditEventType.admin_action_requested,
            ip_address=ip,
            metadata_={
                "kind": "admin_invitation_resent",
                "invitation_id": str(invitation.id),
                "email": invitation.email,
            },
        )
    )
    await db.flush()

    return _invitation_to_dict(
        invitation,
        role_name=role_name,
        inviter_name=inviter_name,
    )


async def validate_admin_invite_token(db: AsyncSession, *, token: str) -> dict[str, Any]:
    invitation = await _load_invitation_for_token(db, token)
    role_name = await _get_role_name(db, invitation.role_key)
    inviter_name = await _get_inviter_name(db, invitation.invited_by)
    return {
        "email": invitation.email,
        "first_name": invitation.first_name,
        "last_name": invitation.last_name,
        "role_key": invitation.role_key,
        "role_name": role_name,
        "inviter_name": inviter_name,
        "expires_at": invitation.expires_at,
        "target_console": invite_target_console(invitation.role_key),
    }


async def _get_onboarding_draft(onboarding_token: str) -> dict[str, Any]:
    draft = await get_admin_invite_onboarding_draft(onboarding_token)
    if not draft:
        raise AuthError(
            "Onboarding session expired. Start again from your invitation link.",
            "onboarding_expired",
            410,
        )
    return draft


async def _validate_draft_invitation(db: AsyncSession, draft: dict[str, Any]) -> AdminInvitation:
    invitation = await db.get(AdminInvitation, UUID(draft["invitation_id"]))
    if not invitation:
        raise AuthError("Invalid or expired invitation link.", "invalid_invite_token", 400)

    now = _now()
    if invitation.status == AdminInvitationStatus.revoked:
        raise AuthError("This invitation was revoked.", "invite_revoked", 400)
    if invitation.status == AdminInvitationStatus.accepted:
        raise AuthError("This invitation has already been used.", "invite_already_used", 400)
    if invitation.status == AdminInvitationStatus.expired or invitation.expires_at <= now:
        invitation.status = AdminInvitationStatus.expired
        invitation.updated_at = now
        raise AuthError("This invitation has expired.", "invite_expired", 400)

    return invitation


async def start_admin_invite_onboarding(
    db: AsyncSession,
    *,
    token: str,
    first_name: str,
    last_name: str | None,
    password: str,
) -> dict[str, Any]:
    invitation = await _load_invitation_for_token(db, token)

    if not first_name.strip():
        raise AuthError("First name is required.", "invalid_name", 400)
    try:
        validate_password_strength(password)
    except PasswordStrengthError as exc:
        raise AuthError(str(exc), "invalid_password", 400) from exc

    try:
        await ensure_password_not_pwned(password)
    except PasswordPwnedError as exc:
        raise AuthError(str(exc), "password_pwned", 400) from exc
    except HibpUnavailableError as exc:
        raise AuthError(str(exc), "hibp_unavailable", 503) from exc

    await _ensure_email_available(db, invitation.email)

    onboarding_token, expires_in = await create_admin_invite_onboarding_draft(
        invitation_id=str(invitation.id),
        invite_token=token,
        email=invitation.email,
        first_name=first_name.strip(),
        last_name=last_name.strip() if last_name else invitation.last_name,
        password_hash=hash_password(password),
        role_key=invitation.role_key,
    )
    return {
        "next": "onboarding",
        "onboarding_token": onboarding_token,
        "expires_in": expires_in,
    }


async def admin_invite_onboarding_mfa_start(
    db: AsyncSession,
    *,
    onboarding_token: str,
) -> dict[str, Any]:
    draft = await _get_onboarding_draft(onboarding_token)
    invitation = await _validate_draft_invitation(db, draft)
    if draft.get("mfa_secret"):
        raise AuthError("MFA is already configured for this setup.", "mfa_already_enabled", 409)

    settings = get_settings()
    secret = generate_totp_secret()
    enroll_token = generate_pending_token()
    await store_pending_auth(
        "admin_invite_mfa_enroll",
        enroll_token,
        {"onboarding_token": onboarding_token, "secret": secret},
        settings.mfa_pending_ttl_seconds,
    )
    return {
        "enroll_token": enroll_token,
        "qr_uri": build_provisioning_uri(secret, invitation.email),
        "manual_secret": secret,
        "expires_in": settings.mfa_pending_ttl_seconds,
    }


async def admin_invite_onboarding_mfa_qr(
    db: AsyncSession,
    *,
    onboarding_token: str,
    enroll_token: str,
    size: int = 512,
) -> bytes:
    draft = await _get_onboarding_draft(onboarding_token)
    invitation = await _validate_draft_invitation(db, draft)
    if draft.get("mfa_secret"):
        raise AuthError("MFA is already configured for this setup.", "mfa_already_enabled", 409)

    payload = await peek_pending_auth("admin_invite_mfa_enroll", enroll_token)
    if not payload or payload.get("onboarding_token") != onboarding_token:
        raise AuthError("Enrollment session expired. Start again.", "enroll_expired", 410)

    secret = payload["secret"]
    qr_uri = build_provisioning_uri(secret, invitation.email)
    return generate_referral_qr_png(qr_uri, size=size)


async def admin_invite_onboarding_mfa_confirm(
    db: AsyncSession,
    *,
    onboarding_token: str,
    enroll_token: str,
    totp_code: str,
) -> dict[str, Any]:
    draft = await _get_onboarding_draft(onboarding_token)
    await _validate_draft_invitation(db, draft)

    payload = await consume_pending_auth("admin_invite_mfa_enroll", enroll_token)
    if not payload or payload.get("onboarding_token") != onboarding_token:
        raise AuthError("Enrollment session expired. Start again.", "enroll_expired", 410)

    secret = payload["secret"]
    if not verify_totp_code(secret, totp_code):
        raise AuthError("Invalid authenticator code.", "invalid_totp", 400)

    plain_codes = generate_backup_codes()
    code_hashes = [hash_password(code) for code in plain_codes]
    updated = await update_admin_invite_onboarding_draft(
        onboarding_token,
        {
            "mfa_secret": secret,
            "backup_code_hashes": code_hashes,
            "mfa_confirmed_at": _now().isoformat(),
        },
    )
    if not updated:
        raise AuthError(
            "Onboarding session expired. Start again from your invitation link.",
            "onboarding_expired",
            410,
        )

    return {"enrolled": True, "backup_codes": plain_codes}


async def complete_admin_invite_onboarding(
    db: AsyncSession,
    *,
    onboarding_token: str,
    pin: str,
    confirm_pin: str,
    totp_code: str,
    device_fingerprint: str,
    user_agent: str | None,
    client_header: str | None = None,
    ip: str | None = None,
) -> dict[str, Any]:
    from app.application.admin.rbac_service import assign_role_to_admin_user

    draft = await _get_onboarding_draft(onboarding_token)
    invitation = await _validate_draft_invitation(db, draft)
    invite_token = draft["invite_token"]
    client = _resolve_invite_auth_client(header=client_header, fingerprint=device_fingerprint)
    validate_invite_client_for_role(role_key=invitation.role_key, client=client)

    mfa_secret = draft.get("mfa_secret")
    backup_code_hashes = draft.get("backup_code_hashes")
    if not mfa_secret or not backup_code_hashes:
        raise AuthError("Complete MFA setup before finishing onboarding.", "mfa_required", 400)

    if pin != confirm_pin:
        raise AuthError("PIN entries do not match.", "pin_mismatch", 400)
    validate_pin_format(pin)

    if not verify_totp_code(mfa_secret, totp_code):
        raise AuthError("Valid authenticator code required.", "invalid_totp", 401)

    await _ensure_email_available(db, invitation.email)

    now = _now()
    user = User(
        email=invitation.email,
        password_hash=draft["password_hash"],
        first_name=draft["first_name"],
        last_name=draft.get("last_name"),
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
        mfa_enrolled_at=now,
        pin_hash=hash_password(pin),
        pin_set_at=now,
    )
    persona_role_code = zynd_persona_role_code_for_admin_role(invitation.role_key)
    if persona_role_code:
        await assign_zynd_persona_client_id(
            db,
            user,
            role_code=persona_role_code,
            first_name=user.first_name,
            last_name=user.last_name,
        )
    else:
        await assign_client_id(db, user)
    db.add(user)
    await db.flush()

    await save_pending_mfa_enrollment(db, user_id=user.id, secret=mfa_secret)
    for code_hash in backup_code_hashes:
        db.add(UserBackupCode(user_id=user.id, code_hash=code_hash))

    await assign_role_to_admin_user(db, user_id=user.id, role_key=invitation.role_key)

    invitation.status = AdminInvitationStatus.accepted
    invitation.accepted_at = now
    invitation.accepted_user_id = user.id
    invitation.updated_at = now
    if not invitation.first_name:
        invitation.first_name = user.first_name
    if not invitation.last_name and user.last_name:
        invitation.last_name = user.last_name

    await delete_admin_invite_token(invite_token)
    await delete_admin_invite_onboarding_draft(onboarding_token)

    db.add(
        AuditLog(
            user_id=user.id,
            event_type=AuditEventType.admin_action_requested,
            ip_address=ip,
            metadata_={
                "kind": "admin_invitation_accepted",
                "invitation_id": str(invitation.id),
                "role_key": invitation.role_key,
            },
        )
    )
    await db.flush()

    login_result = await complete_authenticated_login(
        db,
        user=user,
        device_fingerprint=device_fingerprint,
        user_agent=user_agent,
        ip=ip,
    )
    await store_pin_unlock(user.id, login_result["session_id"])
    return login_result


async def accept_admin_invitation(
    db: AsyncSession,
    *,
    token: str,
    first_name: str,
    last_name: str | None,
    password: str,
    device_fingerprint: str,
    user_agent: str | None,
    client_header: str | None = None,
    ip: str | None = None,
) -> dict[str, Any]:
    _ = user_agent, ip
    invitation = await _load_invitation_for_token(db, token)
    client = _resolve_invite_auth_client(header=client_header, fingerprint=device_fingerprint)
    validate_invite_client_for_role(role_key=invitation.role_key, client=client)
    return await start_admin_invite_onboarding(
        db,
        token=token,
        first_name=first_name,
        last_name=last_name,
        password=password,
    )
