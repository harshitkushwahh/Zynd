from __future__ import annotations

from datetime import timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.audit_service import write_audit
from app.application.family_groups.constants import (
    FAMILY_GROUP_BADGE_PRESETS,
    FAMILY_GROUP_INVITE_VALIDITY_DAYS,
    MAX_FAMILY_GROUP_MEMBERS,
)
from app.application.family_groups.activity_service import record_family_group_activity
from app.application.family_groups.display import (
    get_active_membership,
    get_family_group_or_raise,
    now_utc,
    require_group_head,
)
from app.application.family_groups.errors import FamilyGroupError
from app.application.family_groups.family_notification_service import (
    notify_family_invite_accepted,
    notify_family_invite_declined,
    notify_family_invite_received,
)
from app.application.ports.email_gateway import send_security_email
from app.application.referral.referral_notification_service import mask_referee_email
from app.core.config import Settings, get_settings
from app.infrastructure.persistence.family_group_models import (
    FamilyGroup,
    FamilyGroupActivityType,
    FamilyGroupInvite,
    FamilyGroupInviteStatus,
    FamilyGroupMember,
    FamilyGroupMemberRole,
    FamilyGroupMemberStatus,
)
from app.infrastructure.persistence.family_invite_token_store import (
    create_family_invite_token,
    delete_family_invite_token,
    get_family_invite_token,
)
from app.infrastructure.persistence.models import AuditEventType, User, UserStatus

INVITE_ROLES = frozenset({FamilyGroupMemberRole.contributor, FamilyGroupMemberRole.viewer})


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _invite_url(token: str, settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    base = settings.frontend_url.rstrip("/")
    return f"{base}/g/{token}"


def _display_name(user: User) -> str:
    parts = [user.first_name, user.last_name]
    name = " ".join(part for part in parts if part).strip()
    return name or mask_referee_email(user.email)


def _serialize_badge_presets() -> list[dict[str, str]]:
    return [{"key": key, "label": label} for key, label in FAMILY_GROUP_BADGE_PRESETS]


def _serialize_invite(invite: FamilyGroupInvite, *, share_url: str | None = None) -> dict[str, Any]:
    return {
        "id": invite.id,
        "group_id": invite.group_id,
        "invitee_email": mask_referee_email(invite.invitee_email) if invite.invitee_email else None,
        "invitee_user_id": invite.invitee_user_id,
        "intended_role": invite.intended_role.value,
        "intended_badge_key": invite.intended_badge_key,
        "intended_badge_label": invite.intended_badge_label,
        "status": invite.status.value,
        "expires_at": invite.expires_at,
        "share_url": share_url,
        "created_at": invite.created_at,
    }


async def count_pending_invites(db: AsyncSession, group_id: UUID) -> int:
    await _mark_expired_invites(db, group_id=group_id)
    result = await db.execute(
        select(func.count())
        .select_from(FamilyGroupInvite)
        .where(
            FamilyGroupInvite.group_id == group_id,
            FamilyGroupInvite.status == FamilyGroupInviteStatus.pending,
        )
    )
    return int(result.scalar_one())


async def assert_group_has_capacity(db: AsyncSession, group_id: UUID, *, additional: int = 1) -> None:
    from app.application.family_groups.display import count_active_members

    active = await count_active_members(db, group_id)
    pending = await count_pending_invites(db, group_id)
    if active + pending + additional > MAX_FAMILY_GROUP_MEMBERS:
        raise FamilyGroupError(
            "group_full",
            f"This group can have at most {MAX_FAMILY_GROUP_MEMBERS} members including pending invites.",
            status_code=409,
        )


async def _mark_expired_invites(db: AsyncSession, *, group_id: UUID | None = None) -> None:
    now = now_utc()
    query = select(FamilyGroupInvite).where(
        FamilyGroupInvite.status == FamilyGroupInviteStatus.pending,
        FamilyGroupInvite.expires_at <= now,
    )
    if group_id is not None:
        query = query.where(FamilyGroupInvite.group_id == group_id)
    result = await db.execute(query)
    for invite in result.scalars().all():
        invite.status = FamilyGroupInviteStatus.expired
        invite.updated_at = now


async def _get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def _ensure_not_already_member(
    db: AsyncSession,
    *,
    group_id: UUID,
    user_id: UUID | None,
    email: str | None,
) -> None:
    if user_id:
        membership = await get_active_membership(db, group_id=group_id, user_id=user_id)
        if membership:
            raise FamilyGroupError(
                "already_member",
                "This person is already a member of the group.",
                status_code=409,
            )

    if email:
        user = await _get_user_by_email(db, email)
        if user:
            membership = await get_active_membership(db, group_id=group_id, user_id=user.id)
            if membership:
                raise FamilyGroupError(
                    "already_member",
                    "This person is already a member of the group.",
                    status_code=409,
                )


async def _ensure_no_pending_invite(
    db: AsyncSession,
    *,
    group_id: UUID,
    user_id: UUID | None,
    email: str | None,
) -> None:
    await _mark_expired_invites(db, group_id=group_id)
    filters = [
        FamilyGroupInvite.group_id == group_id,
        FamilyGroupInvite.status == FamilyGroupInviteStatus.pending,
    ]
    conditions = []
    if user_id:
        conditions.append(FamilyGroupInvite.invitee_user_id == user_id)
    if email:
        conditions.append(FamilyGroupInvite.invitee_email == email)
    if not conditions:
        return

    result = await db.execute(select(FamilyGroupInvite).where(*filters, or_(*conditions)))
    if result.scalar_one_or_none():
        raise FamilyGroupError(
            "invite_pending",
            "A pending invitation already exists for this person.",
            status_code=409,
        )


def validate_family_group_badge(
    *, badge_key: str | None, badge_label: str | None
) -> tuple[str | None, str | None]:
    if not badge_key:
        return None, None
    normalized_key = badge_key.strip().lower()
    preset_keys = {key for key, _label in FAMILY_GROUP_BADGE_PRESETS}
    if normalized_key not in preset_keys:
        raise FamilyGroupError("invalid_badge", "Invalid badge selection.", status_code=400)
    if normalized_key == "custom":
        label = (badge_label or "").strip()
        if not label:
            raise FamilyGroupError("invalid_badge", "Custom badge label is required.", status_code=400)
        if len(label) > 64:
            raise FamilyGroupError("invalid_badge", "Custom badge label is too long.", status_code=400)
        return normalized_key, label
    preset_label = dict(FAMILY_GROUP_BADGE_PRESETS)[normalized_key]
    return normalized_key, preset_label


async def _load_invite_for_token(db: AsyncSession, token: str) -> FamilyGroupInvite:
    invite_id = await get_family_invite_token(token)
    if not invite_id:
        raise FamilyGroupError("invalid_invite", "Invalid or expired invitation link.", status_code=400)

    invite = await db.get(FamilyGroupInvite, UUID(invite_id))
    if not invite:
        raise FamilyGroupError("invalid_invite", "Invalid or expired invitation link.", status_code=400)

    await _mark_expired_invites(db, group_id=invite.group_id)
    await db.refresh(invite)

    if invite.status == FamilyGroupInviteStatus.revoked:
        raise FamilyGroupError("invite_revoked", "This invitation was revoked.", status_code=400)
    if invite.status == FamilyGroupInviteStatus.accepted:
        raise FamilyGroupError("invite_already_used", "This invitation has already been used.", status_code=400)
    if invite.status == FamilyGroupInviteStatus.declined:
        raise FamilyGroupError("invite_declined", "This invitation was declined.", status_code=400)
    if invite.status == FamilyGroupInviteStatus.expired or invite.expires_at <= now_utc():
        invite.status = FamilyGroupInviteStatus.expired
        invite.updated_at = now_utc()
        raise FamilyGroupError("invite_expired", "This invitation has expired.", status_code=400)

    return invite


async def _assert_invite_matches_user(invite: FamilyGroupInvite, user: User) -> None:
    if invite.invitee_user_id and invite.invitee_user_id != user.id:
        raise FamilyGroupError(
            "invite_mismatch",
            "This invitation was sent to a different account.",
            status_code=403,
        )
    if invite.invitee_email and _normalize_email(invite.invitee_email) != _normalize_email(user.email):
        raise FamilyGroupError(
            "invite_mismatch",
            "This invitation was sent to a different email address.",
            status_code=403,
        )


async def _send_invite_email(
    *,
    invite: FamilyGroupInvite,
    token: str,
    group: FamilyGroup,
    inviter: User,
    subject_prefix: str = "",
) -> None:
    if not invite.invitee_email:
        return
    settings = get_settings()
    invite_url = _invite_url(token, settings)
    await send_security_email(
        to_email=invite.invitee_email,
        subject=f"{subject_prefix}You're invited to join {group.title} on Zynd",
        body=(
            f"{_display_name(inviter)} invited you to join the family group \"{group.title}\" "
            f"as {invite.intended_role.value}.\n\n"
            f"Open this link to join:\n{invite_url}\n\n"
            f"The link expires in {FAMILY_GROUP_INVITE_VALIDITY_DAYS} days.\n"
            "If you were not expecting this invitation, you can ignore this email."
        ),
    )


async def create_family_group_invite(
    db: AsyncSession,
    *,
    group_id: UUID,
    inviter: User,
    invitee_email: str | None = None,
    intended_role: FamilyGroupMemberRole = FamilyGroupMemberRole.viewer,
    intended_badge_key: str | None = None,
    intended_badge_label: str | None = None,
    ip: str | None = None,
) -> dict[str, Any]:
    group, _membership = await require_group_head(db, group_id=group_id, user_id=inviter.id)

    if intended_role not in INVITE_ROLES:
        raise FamilyGroupError(
            "invalid_role",
            "Invites can only assign contributor or viewer roles.",
            status_code=400,
        )

    normalized_email = _normalize_email(invitee_email) if invitee_email else None
    if not normalized_email:
        raise FamilyGroupError("invalid_email", "Invitee email is required.", status_code=400)

    invitee_user = await _get_user_by_email(db, normalized_email)
    if invitee_user and invitee_user.id == inviter.id:
        raise FamilyGroupError("self_invite", "You cannot invite yourself.", status_code=400)
    if invitee_user and invitee_user.status != UserStatus.active:
        raise FamilyGroupError("invitee_unavailable", "This account cannot be invited right now.", status_code=409)

    badge_key, badge_label = validate_family_group_badge(
        badge_key=intended_badge_key,
        badge_label=intended_badge_label,
    )

    await assert_group_has_capacity(db, group_id)
    await _ensure_not_already_member(
        db,
        group_id=group_id,
        user_id=invitee_user.id if invitee_user else None,
        email=normalized_email,
    )
    await _ensure_no_pending_invite(
        db,
        group_id=group_id,
        user_id=invitee_user.id if invitee_user else None,
        email=normalized_email,
    )

    invite = FamilyGroupInvite(
        group_id=group_id,
        invitee_email=normalized_email,
        invitee_user_id=invitee_user.id if invitee_user else None,
        intended_role=intended_role,
        intended_badge_key=badge_key,
        intended_badge_label=badge_label,
        invited_by_user_id=inviter.id,
        status=FamilyGroupInviteStatus.pending,
        expires_at=now_utc() + timedelta(days=FAMILY_GROUP_INVITE_VALIDITY_DAYS),
    )
    db.add(invite)
    await db.flush()

    token = await create_family_invite_token(str(invite.id))
    share_url = _invite_url(token)

    await write_audit(
        db,
        event_type=AuditEventType.family_group_invite_sent,
        user_id=inviter.id,
        ip=ip,
        metadata={
            "group_id": str(group_id),
            "invite_id": str(invite.id),
            "invitee_email": mask_referee_email(normalized_email),
            "intended_role": intended_role.value,
        },
    )

    if invitee_user:
        notify_family_invite_received(
            invitee=invitee_user,
            inviter=inviter,
            group_title=group.title,
            invite_id=invite.id,
            invite_token=token,
            intended_role=intended_role.value,
        )
    else:
        await _send_invite_email(invite=invite, token=token, group=group, inviter=inviter)

    await record_family_group_activity(
        db,
        group_id=group_id,
        event_type=FamilyGroupActivityType.invite_sent,
        actor_user_id=inviter.id,
        metadata={
            "invite_id": str(invite.id),
            "invitee_email_masked": mask_referee_email(normalized_email),
            "role": intended_role.value,
        },
    )

    return _serialize_invite(invite, share_url=share_url)


async def list_group_invites(
    db: AsyncSession,
    *,
    group_id: UUID,
    user_id: UUID,
) -> list[dict[str, Any]]:
    await require_group_head(db, group_id=group_id, user_id=user_id)
    await _mark_expired_invites(db, group_id=group_id)

    result = await db.execute(
        select(FamilyGroupInvite)
        .where(
            FamilyGroupInvite.group_id == group_id,
            FamilyGroupInvite.status.in_(
                [
                    FamilyGroupInviteStatus.pending,
                    FamilyGroupInviteStatus.accepted,
                    FamilyGroupInviteStatus.declined,
                    FamilyGroupInviteStatus.revoked,
                ]
            ),
        )
        .order_by(FamilyGroupInvite.created_at.desc())
    )
    return [_serialize_invite(invite) for invite in result.scalars().all()]


async def list_pending_invites_for_user(
    db: AsyncSession,
    *,
    user_id: UUID,
) -> list[dict[str, Any]]:
    user = await db.get(User, user_id)
    if not user:
        return []

    await _mark_expired_invites(db)
    result = await db.execute(
        select(FamilyGroupInvite, FamilyGroup, User)
        .join(FamilyGroup, FamilyGroup.id == FamilyGroupInvite.group_id)
        .join(User, User.id == FamilyGroupInvite.invited_by_user_id)
        .where(
            FamilyGroupInvite.status == FamilyGroupInviteStatus.pending,
            FamilyGroupInvite.expires_at > now_utc(),
            or_(
                FamilyGroupInvite.invitee_user_id == user_id,
                FamilyGroupInvite.invitee_email == _normalize_email(user.email),
            ),
        )
        .order_by(FamilyGroupInvite.created_at.desc())
    )

    payload: list[dict[str, Any]] = []
    for invite, group, inviter in result.all():
        payload.append(
            {
                "id": invite.id,
                "group_id": group.id,
                "group_title": group.title,
                "inviter_name": _display_name(inviter),
                "intended_role": invite.intended_role.value,
                "intended_badge_key": invite.intended_badge_key,
                "intended_badge_label": invite.intended_badge_label,
                "expires_at": invite.expires_at,
                "created_at": invite.created_at,
            }
        )
    return payload


async def preview_family_group_invite(
    db: AsyncSession,
    *,
    token: str,
) -> dict[str, Any]:
    invite = await _load_invite_for_token(db, token)
    group = await get_family_group_or_raise(db, invite.group_id)
    inviter = await db.get(User, invite.invited_by_user_id)

    return {
        "group_id": group.id,
        "group_title": group.title,
        "inviter_name": _display_name(inviter) if inviter else "A family member",
        "intended_role": invite.intended_role.value,
        "intended_badge_key": invite.intended_badge_key,
        "intended_badge_label": invite.intended_badge_label,
        "expires_at": invite.expires_at,
        "invitee_email_masked": mask_referee_email(invite.invitee_email) if invite.invitee_email else None,
    }


async def _accept_invite_record(
    db: AsyncSession,
    *,
    invite: FamilyGroupInvite,
    user: User,
    ip: str | None = None,
) -> dict[str, Any]:
    group = await get_family_group_or_raise(db, invite.group_id)
    await _assert_invite_matches_user(invite, user)

    existing = await get_active_membership(db, group_id=group.id, user_id=user.id)
    if existing:
        raise FamilyGroupError("already_member", "You are already a member of this group.", status_code=409)

    await assert_group_has_capacity(db, group.id, additional=0)

    member = FamilyGroupMember(
        group_id=group.id,
        user_id=user.id,
        role=invite.intended_role,
        badge_key=invite.intended_badge_key,
        badge_label=invite.intended_badge_label,
        invited_by_user_id=invite.invited_by_user_id,
        status=FamilyGroupMemberStatus.active,
    )
    db.add(member)

    invite.status = FamilyGroupInviteStatus.accepted
    invite.accepted_at = now_utc()
    invite.accepted_user_id = user.id
    invite.updated_at = now_utc()
    await db.flush()

    inviter = await db.get(User, invite.invited_by_user_id)
    if inviter:
        notify_family_invite_accepted(
            head=inviter,
            invitee=user,
            group_title=group.title,
            invite_id=invite.id,
        )

    from app.application.family_groups.nominee_bridge_service import apply_nominee_nickname_on_join

    await apply_nominee_nickname_on_join(
        db,
        group_id=group.id,
        user_id=user.id,
        email=user.email,
    )

    await write_audit(
        db,
        event_type=AuditEventType.family_group_invite_accepted,
        user_id=user.id,
        ip=ip,
        metadata={"group_id": str(group.id), "invite_id": str(invite.id)},
    )

    await record_family_group_activity(
        db,
        group_id=group.id,
        event_type=FamilyGroupActivityType.invite_accepted,
        target_user_id=user.id,
        metadata={"role": invite.intended_role.value},
    )
    await record_family_group_activity(
        db,
        group_id=group.id,
        event_type=FamilyGroupActivityType.member_joined,
        target_user_id=user.id,
        metadata={"role": invite.intended_role.value},
    )

    from app.application.family_groups.display import serialize_family_group

    return await serialize_family_group(db, group, viewer_user_id=user.id)


async def accept_family_group_invite(
    db: AsyncSession,
    *,
    token: str,
    user: User,
    ip: str | None = None,
) -> dict[str, Any]:
    invite = await _load_invite_for_token(db, token)
    result = await _accept_invite_record(db, invite=invite, user=user, ip=ip)
    await delete_family_invite_token(token)
    return result


async def accept_family_group_invite_by_id(
    db: AsyncSession,
    *,
    invite_id: UUID,
    user: User,
    ip: str | None = None,
) -> dict[str, Any]:
    invite = await db.get(FamilyGroupInvite, invite_id)
    if not invite:
        raise FamilyGroupError("invite_not_found", "Invitation not found.", status_code=404)
    await _mark_expired_invites(db, group_id=invite.group_id)
    await db.refresh(invite)
    if invite.status != FamilyGroupInviteStatus.pending:
        raise FamilyGroupError("invalid_invite", "This invitation is no longer active.", status_code=400)
    if invite.expires_at <= now_utc():
        invite.status = FamilyGroupInviteStatus.expired
        raise FamilyGroupError("invite_expired", "This invitation has expired.", status_code=400)
    return await _accept_invite_record(db, invite=invite, user=user, ip=ip)


async def decline_family_group_invite(
    db: AsyncSession,
    *,
    token: str,
    user: User,
    ip: str | None = None,
) -> dict[str, Any]:
    invite = await _load_invite_for_token(db, token)
    group = await get_family_group_or_raise(db, invite.group_id)
    await _assert_invite_matches_user(invite, user)

    invite.status = FamilyGroupInviteStatus.declined
    invite.declined_at = now_utc()
    invite.updated_at = now_utc()
    await db.flush()

    await delete_family_invite_token(token)

    inviter = await db.get(User, invite.invited_by_user_id)
    if inviter:
        notify_family_invite_declined(
            head=inviter,
            invitee=user,
            group_title=group.title,
            invite_id=invite.id,
        )

    await write_audit(
        db,
        event_type=AuditEventType.family_group_invite_declined,
        user_id=user.id,
        ip=ip,
        metadata={"group_id": str(group.id), "invite_id": str(invite.id)},
    )

    await record_family_group_activity(
        db,
        group_id=group.id,
        event_type=FamilyGroupActivityType.invite_declined,
        target_user_id=user.id,
    )

    return {"ok": True}


async def decline_family_group_invite_by_id(
    db: AsyncSession,
    *,
    invite_id: UUID,
    user: User,
    ip: str | None = None,
) -> dict[str, Any]:
    invite = await db.get(FamilyGroupInvite, invite_id)
    if not invite:
        raise FamilyGroupError("invite_not_found", "Invitation not found.", status_code=404)
    if invite.status != FamilyGroupInviteStatus.pending:
        raise FamilyGroupError("invalid_invite", "This invitation is no longer active.", status_code=400)
    group = await get_family_group_or_raise(db, invite.group_id)
    await _assert_invite_matches_user(invite, user)

    invite.status = FamilyGroupInviteStatus.declined
    invite.declined_at = now_utc()
    invite.updated_at = now_utc()
    await db.flush()

    inviter = await db.get(User, invite.invited_by_user_id)
    if inviter:
        notify_family_invite_declined(
            head=inviter,
            invitee=user,
            group_title=group.title,
            invite_id=invite.id,
        )

    await write_audit(
        db,
        event_type=AuditEventType.family_group_invite_declined,
        user_id=user.id,
        ip=ip,
        metadata={"group_id": str(group.id), "invite_id": str(invite.id)},
    )

    await record_family_group_activity(
        db,
        group_id=group.id,
        event_type=FamilyGroupActivityType.invite_declined,
        target_user_id=user.id,
    )

    return {"ok": True}


async def revoke_family_group_invite(
    db: AsyncSession,
    *,
    group_id: UUID,
    invite_id: UUID,
    user: User,
    ip: str | None = None,
) -> dict[str, Any]:
    await require_group_head(db, group_id=group_id, user_id=user.id)
    invite = await db.get(FamilyGroupInvite, invite_id)
    if not invite or invite.group_id != group_id:
        raise FamilyGroupError("invite_not_found", "Invitation not found.", status_code=404)
    if invite.status != FamilyGroupInviteStatus.pending:
        raise FamilyGroupError("invite_not_pending", "Only pending invitations can be revoked.", status_code=409)

    invite.status = FamilyGroupInviteStatus.revoked
    invite.revoked_at = now_utc()
    invite.updated_at = now_utc()
    await db.flush()

    await write_audit(
        db,
        event_type=AuditEventType.family_group_invite_revoked,
        user_id=user.id,
        ip=ip,
        metadata={"group_id": str(group_id), "invite_id": str(invite_id)},
    )

    await record_family_group_activity(
        db,
        group_id=group_id,
        event_type=FamilyGroupActivityType.invite_revoked,
        actor_user_id=user.id,
        metadata={
            "invite_id": str(invite_id),
            "invitee_email_masked": mask_referee_email(invite.invitee_email)
            if invite.invitee_email
            else None,
        },
    )

    return _serialize_invite(invite)


async def resend_family_group_invite(
    db: AsyncSession,
    *,
    group_id: UUID,
    invite_id: UUID,
    user: User,
    ip: str | None = None,
) -> dict[str, Any]:
    group, _membership = await require_group_head(db, group_id=group_id, user_id=user.id)
    invite = await db.get(FamilyGroupInvite, invite_id)
    if not invite or invite.group_id != group_id:
        raise FamilyGroupError("invite_not_found", "Invitation not found.", status_code=404)
    if invite.status != FamilyGroupInviteStatus.pending:
        raise FamilyGroupError("invite_not_pending", "Only pending invitations can be resent.", status_code=409)

    invite.expires_at = now_utc() + timedelta(days=FAMILY_GROUP_INVITE_VALIDITY_DAYS)
    invite.updated_at = now_utc()
    await db.flush()

    token = await create_family_invite_token(str(invite.id))
    share_url = _invite_url(token)

    invitee_user = await db.get(User, invite.invitee_user_id) if invite.invitee_user_id else None
    if invitee_user:
        notify_family_invite_received(
            invitee=invitee_user,
            inviter=user,
            group_title=group.title,
            invite_id=invite.id,
            invite_token=token,
            intended_role=invite.intended_role.value,
        )
    else:
        await _send_invite_email(invite=invite, token=token, group=group, inviter=user)

    await write_audit(
        db,
        event_type=AuditEventType.family_group_invite_sent,
        user_id=user.id,
        ip=ip,
        metadata={"group_id": str(group_id), "invite_id": str(invite_id), "action": "resent"},
    )

    return _serialize_invite(invite, share_url=share_url)


def list_badge_presets() -> list[dict[str, str]]:
    return _serialize_badge_presets()
