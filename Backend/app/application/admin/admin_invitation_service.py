from __future__ import annotations

from datetime import timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.auth_session_context import complete_authenticated_login
from app.application.auth.errors import AuthError
from app.application.documents.client_id_service import assign_client_id
from app.application.ports.email_gateway import send_security_email
from app.application.shared.datetime_utils import utcnow
from app.core.config import Settings, get_settings
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
    UserRole,
    UserStatus,
)
from app.infrastructure.security.hibp_service import (
    HibpUnavailableError,
    PasswordPwnedError,
    ensure_password_not_pwned,
)
from app.infrastructure.security.passwords import hash_password

INVITE_VALIDITY = timedelta(hours=72)


def _now():
    return utcnow()


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _invite_url(token: str, settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    base = settings.admin_frontend_url.rstrip("/")
    return f"{base}/accept-invite?token={token}"


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
    invite_url = _invite_url(token, settings)
    inviter_label = inviter_name or "A ZYND administrator"
    role_label = role_name or invitation.role_key
    await send_security_email(
        to_email=invitation.email,
        subject="You're invited to the ZYND Admin Console",
        body=(
            f"{inviter_label} invited you to join the ZYND Admin Console as {role_label}.\n\n"
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
    }


async def accept_admin_invitation(
    db: AsyncSession,
    *,
    token: str,
    first_name: str,
    last_name: str | None,
    password: str,
    device_fingerprint: str,
    user_agent: str | None,
    ip: str | None = None,
) -> dict[str, Any]:
    from app.application.admin.rbac_service import assign_role_to_admin_user

    invitation = await _load_invitation_for_token(db, token)

    if not first_name.strip():
        raise AuthError("First name is required.", "invalid_name", 400)
    if len(password) < 8:
        raise AuthError("Password must be at least 8 characters.", "invalid_password", 400)

    try:
        await ensure_password_not_pwned(password)
    except PasswordPwnedError as exc:
        raise AuthError(str(exc), "password_pwned", 400) from exc
    except HibpUnavailableError as exc:
        raise AuthError(str(exc), "hibp_unavailable", 503) from exc

    await _ensure_email_available(db, invitation.email)

    now = _now()
    user = User(
        email=invitation.email,
        password_hash=hash_password(password),
        first_name=first_name.strip(),
        last_name=last_name.strip() if last_name else invitation.last_name,
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    await assign_client_id(db, user)
    db.add(user)
    await db.flush()

    await assign_role_to_admin_user(db, user_id=user.id, role_key=invitation.role_key)

    invitation.status = AdminInvitationStatus.accepted
    invitation.accepted_at = now
    invitation.accepted_user_id = user.id
    invitation.updated_at = now
    if not invitation.first_name:
        invitation.first_name = user.first_name
    if not invitation.last_name and user.last_name:
        invitation.last_name = user.last_name

    await delete_admin_invite_token(token)

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
    return login_result
