from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.audit_service import write_audit
from app.application.family_groups.activity_service import record_family_group_activity
from app.application.family_groups.display import (
    count_active_members,
    now_utc,
    resolve_member_display_name,
    resolve_family_group_avatar_url,
)
from app.application.family_groups.errors import FamilyGroupError
from app.application.family_groups.family_notification_service import notify_family_member_removed
from app.application.family_groups.invite_service import _mark_expired_invites, _serialize_invite, count_pending_invites
from app.application.referral.referral_notification_service import mask_referee_email
from app.infrastructure.persistence.family_group_models import (
    FamilyGroup,
    FamilyGroupActivity,
    FamilyGroupActivityType,
    FamilyGroupInvite,
    FamilyGroupInviteStatus,
    FamilyGroupMember,
    FamilyGroupMemberRole,
    FamilyGroupMemberStatus,
    FamilyGroupStatus,
)
from app.infrastructure.persistence.models import AuditEventType, User


def _user_display_name(user: User | None) -> str | None:
    if not user:
        return None
    parts = [user.first_name, user.last_name]
    name = " ".join(part for part in parts if part).strip()
    return name or mask_referee_email(user.email)


async def _get_group_head(db: AsyncSession, group_id: UUID) -> tuple[FamilyGroupMember | None, User | None]:
    result = await db.execute(
        select(FamilyGroupMember, User)
        .join(User, User.id == FamilyGroupMember.user_id)
        .where(
            FamilyGroupMember.group_id == group_id,
            FamilyGroupMember.status == FamilyGroupMemberStatus.active,
            FamilyGroupMember.role == FamilyGroupMemberRole.head,
        )
        .limit(1)
    )
    row = result.first()
    if not row:
        return None, None
    return row[0], row[1]


async def _serialize_admin_group_summary(db: AsyncSession, group: FamilyGroup) -> dict[str, Any]:
    member_count = await count_active_members(db, group.id)
    pending_invite_count = await count_pending_invites(db, group.id)
    _head_member, head_user = await _get_group_head(db, group.id)

    return {
        "id": group.id,
        "title": group.title,
        "tag": group.tag,
        "status": group.status.value,
        "member_count": member_count,
        "pending_invite_count": pending_invite_count,
        "head_user_id": head_user.id if head_user else None,
        "head_display_name": _user_display_name(head_user),
        "head_email_masked": mask_referee_email(head_user.email) if head_user else None,
        "created_by_user_id": group.created_by_user_id,
        "created_at": group.created_at,
        "updated_at": group.updated_at,
        "archived_at": group.archived_at,
    }


async def list_admin_family_groups(
    db: AsyncSession,
    *,
    status: FamilyGroupStatus | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    await _mark_expired_invites(db)
    query = select(FamilyGroup).order_by(FamilyGroup.created_at.desc())
    if status is not None:
        query = query.where(FamilyGroup.status == status)
    if search:
        normalized = search.strip()
        if normalized:
            query = query.where(FamilyGroup.title.ilike(f"%{normalized}%"))

    bounded_limit = max(1, min(limit, 200))
    query = query.offset(max(offset, 0)).limit(bounded_limit)
    groups = list((await db.execute(query)).scalars().all())
    return [await _serialize_admin_group_summary(db, group) for group in groups]


async def _get_group_or_raise(db: AsyncSession, group_id: UUID) -> FamilyGroup:
    group = await db.get(FamilyGroup, group_id)
    if not group:
        raise FamilyGroupError("group_not_found", "Family group not found.", status_code=404)
    return group


async def get_admin_family_group_detail(
    db: AsyncSession,
    *,
    group_id: UUID,
) -> dict[str, Any]:
    await _mark_expired_invites(db, group_id=group_id)
    group = await _get_group_or_raise(db, group_id)
    summary = await _serialize_admin_group_summary(db, group)
    avatar_url = await resolve_family_group_avatar_url(db, avatar_document_id=group.avatar_document_id)

    member_rows = await db.execute(
        select(FamilyGroupMember, User)
        .join(User, User.id == FamilyGroupMember.user_id)
        .where(
            FamilyGroupMember.group_id == group_id,
            FamilyGroupMember.status == FamilyGroupMemberStatus.active,
        )
        .order_by(FamilyGroupMember.joined_at.asc())
    )
    members: list[dict[str, Any]] = []
    for member, user_row in member_rows.all():
        members.append(
            {
                "user_id": user_row.id,
                "display_name": resolve_member_display_name(member, user_row),
                "display_nickname": member.display_nickname,
                "email_masked": mask_referee_email(user_row.email),
                "role": member.role.value,
                "badge_key": member.badge_key,
                "badge_label": member.badge_label,
                "joined_at": member.joined_at,
            }
        )

    invite_rows = await db.execute(
        select(FamilyGroupInvite)
        .where(FamilyGroupInvite.group_id == group_id)
        .order_by(FamilyGroupInvite.created_at.desc())
        .limit(100)
    )
    invites = [_serialize_invite(invite) for invite in invite_rows.scalars().all()]

    activity_rows = await db.execute(
        select(FamilyGroupActivity)
        .where(FamilyGroupActivity.group_id == group_id)
        .order_by(FamilyGroupActivity.created_at.desc(), FamilyGroupActivity.id.desc())
        .limit(20)
    )
    activity = [
        {
            "id": row.id,
            "event_type": row.event_type.value,
            "message": row.message,
            "actor_user_id": row.actor_user_id,
            "target_user_id": row.target_user_id,
            "created_at": row.created_at,
        }
        for row in activity_rows.scalars().all()
    ]

    creator = await db.get(User, group.created_by_user_id)
    return {
        **summary,
        "description": group.description,
        "avatar_url": avatar_url,
        "creator_display_name": _user_display_name(creator),
        "creator_email_masked": mask_referee_email(creator.email) if creator else None,
        "members": members,
        "invites": invites,
        "activity": activity,
    }


async def list_admin_family_group_invites(
    db: AsyncSession,
    *,
    status: FamilyGroupInviteStatus | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    await _mark_expired_invites(db)
    query = (
        select(FamilyGroupInvite, FamilyGroup)
        .join(FamilyGroup, FamilyGroup.id == FamilyGroupInvite.group_id)
        .order_by(FamilyGroupInvite.created_at.desc())
    )
    if status is not None:
        query = query.where(FamilyGroupInvite.status == status)
    if search:
        normalized = search.strip().lower()
        if normalized:
            query = query.where(
                or_(
                    FamilyGroup.title.ilike(f"%{normalized}%"),
                    func.lower(FamilyGroupInvite.invitee_email).like(f"%{normalized}%"),
                )
            )

    bounded_limit = max(1, min(limit, 200))
    query = query.offset(max(offset, 0)).limit(bounded_limit)
    payload: list[dict[str, Any]] = []
    for invite, group in (await db.execute(query)).all():
        serialized = _serialize_invite(invite)
        payload.append(
            {
                **serialized,
                "group_title": group.title,
                "group_status": group.status.value,
            }
        )
    return payload


async def list_admin_user_family_groups(
    db: AsyncSession,
    *,
    user_id: UUID,
) -> dict[str, Any]:
    user = await db.get(User, user_id)
    if not user:
        raise FamilyGroupError("user_not_found", "User not found.", status_code=404)

    await _mark_expired_invites(db)

    membership_rows = await db.execute(
        select(FamilyGroup, FamilyGroupMember)
        .join(FamilyGroupMember, FamilyGroupMember.group_id == FamilyGroup.id)
        .where(
            FamilyGroupMember.user_id == user_id,
            FamilyGroupMember.status == FamilyGroupMemberStatus.active,
        )
        .order_by(FamilyGroup.created_at.desc())
    )
    memberships: list[dict[str, Any]] = []
    for group, member in membership_rows.all():
        memberships.append(
            {
                "group_id": group.id,
                "title": group.title,
                "tag": group.tag,
                "status": group.status.value,
                "role": member.role.value,
                "badge_label": member.badge_label,
                "member_count": await count_active_members(db, group.id),
                "joined_at": member.joined_at,
            }
        )

    created_rows = await db.execute(
        select(FamilyGroup)
        .where(FamilyGroup.created_by_user_id == user_id)
        .order_by(FamilyGroup.created_at.desc())
    )
    created_groups: list[dict[str, Any]] = []
    for group in created_rows.scalars().all():
        created_groups.append(await _serialize_admin_group_summary(db, group))

    return {
        "user_id": user_id,
        "memberships": memberships,
        "created_groups": created_groups,
    }


async def admin_force_archive_family_group(
    db: AsyncSession,
    *,
    group_id: UUID,
    admin: User,
    ip: str | None = None,
) -> dict[str, Any]:
    group = await _get_group_or_raise(db, group_id)
    if group.status == FamilyGroupStatus.archived:
        return await get_admin_family_group_detail(db, group_id=group_id)

    group.status = FamilyGroupStatus.archived
    group.archived_at = now_utc()
    await db.flush()
    await db.refresh(group)

    await write_audit(
        db,
        event_type=AuditEventType.family_group_archived,
        user_id=admin.id,
        ip=ip,
        metadata={
            "group_id": str(group.id),
            "admin_action": True,
            "admin_user_id": str(admin.id),
        },
    )
    await record_family_group_activity(
        db,
        group_id=group.id,
        event_type=FamilyGroupActivityType.group_archived,
        actor_user_id=admin.id,
        message="Support archived the group",
    )

    return await get_admin_family_group_detail(db, group_id=group_id)


async def admin_force_remove_group_member(
    db: AsyncSession,
    *,
    group_id: UUID,
    target_user_id: UUID,
    admin: User,
    ip: str | None = None,
) -> dict[str, bool]:
    group = await _get_group_or_raise(db, group_id)
    if group.status == FamilyGroupStatus.archived:
        raise FamilyGroupError("group_archived", "This family group is archived.", status_code=409)

    result = await db.execute(
        select(FamilyGroupMember).where(
            FamilyGroupMember.group_id == group_id,
            FamilyGroupMember.user_id == target_user_id,
            FamilyGroupMember.status == FamilyGroupMemberStatus.active,
        )
    )
    target = result.scalar_one_or_none()
    if not target:
        raise FamilyGroupError("member_not_found", "Group member not found.", status_code=404)

    target.status = FamilyGroupMemberStatus.removed
    await db.flush()

    removed_user = await db.get(User, target_user_id)
    if removed_user:
        notify_family_member_removed(
            member=removed_user,
            group_title=group.title,
            group_id=group_id,
            removed_by=admin,
        )

    await record_family_group_activity(
        db,
        group_id=group_id,
        event_type=FamilyGroupActivityType.member_removed,
        actor_user_id=admin.id,
        target_user_id=target_user_id,
        message=f"Support removed {_user_display_name(removed_user) or 'a member'}",
    )
    await write_audit(
        db,
        event_type=AuditEventType.family_group_member_removed,
        user_id=admin.id,
        ip=ip,
        metadata={
            "group_id": str(group_id),
            "target_user_id": str(target_user_id),
            "admin_action": True,
            "admin_user_id": str(admin.id),
        },
    )
    return {"ok": True}
