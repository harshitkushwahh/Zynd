from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.audit_service import write_audit
from app.application.family_groups.activity_service import record_family_group_activity
from app.application.family_groups.constants import MAX_FAMILY_GROUP_NICKNAME_LENGTH
from app.application.family_groups.display import (
    count_active_members,
    get_active_membership,
    now_utc,
    require_group_head,
    require_group_member,
    serialize_family_group,
)
from app.application.family_groups.errors import FamilyGroupError
from app.application.family_groups.family_notification_service import (
    notify_family_head_transferred,
    notify_family_member_removed,
    notify_family_member_role_changed,
)
from app.application.family_groups.group_service import list_group_members_preview
from app.application.family_groups.invite_service import validate_family_group_badge
from app.application.family_groups.permissions import (
    MANAGEABLE_MEMBER_ROLES,
    can_remove_member,
    can_update_member_role,
)
from app.infrastructure.persistence.family_group_models import (
    FamilyGroupActivityType,
    FamilyGroupMember,
    FamilyGroupMemberRole,
    FamilyGroupMemberStatus,
    FamilyGroupStatus,
)
from app.infrastructure.persistence.models import AuditEventType, User


async def _get_target_member_or_raise(
    db: AsyncSession,
    *,
    group_id: UUID,
    target_user_id: UUID,
) -> FamilyGroupMember:
    membership = await get_active_membership(db, group_id=group_id, user_id=target_user_id)
    if not membership:
        raise FamilyGroupError("member_not_found", "Group member not found.", status_code=404)
    return membership


def _validate_nickname(nickname: str | None) -> str | None:
    if nickname is None:
        return None
    trimmed = nickname.strip()
    if not trimmed:
        return None
    if len(trimmed) > MAX_FAMILY_GROUP_NICKNAME_LENGTH:
        raise FamilyGroupError(
            "invalid_nickname",
            f"Nickname must be at most {MAX_FAMILY_GROUP_NICKNAME_LENGTH} characters.",
            status_code=400,
        )
    return trimmed


def _can_update_nickname(
    *,
    actor: User,
    actor_role: FamilyGroupMemberRole,
    target_user_id: UUID,
) -> bool:
    if actor.id == target_user_id:
        return True
    return actor_role == FamilyGroupMemberRole.head


async def update_group_member(
    db: AsyncSession,
    *,
    group_id: UUID,
    actor: User,
    target_user_id: UUID,
    role: FamilyGroupMemberRole | None = None,
    badge_key: str | None = None,
    badge_label: str | None = None,
    clear_badge: bool = False,
    display_nickname: str | None = None,
    clear_nickname: bool = False,
    nickname_provided: bool = False,
    ip: str | None = None,
) -> dict[str, object]:
    if (
        role is None
        and not clear_badge
        and badge_key is None
        and not nickname_provided
    ):
        raise FamilyGroupError("invalid_request", "No fields to update.")

    group, actor_membership = await require_group_member(db, group_id=group_id, user_id=actor.id)
    target = await _get_target_member_or_raise(db, group_id=group_id, target_user_id=target_user_id)

    role_or_badge_update = role is not None or clear_badge or badge_key is not None
    if role_or_badge_update:
        if actor_membership.role != FamilyGroupMemberRole.head:
            raise FamilyGroupError(
                "forbidden",
                "Only the group head can update roles and badges.",
                status_code=403,
            )
        if not can_update_member_role(
            actor_role=actor_membership.role,
            target_role=target.role,
            actor_user_id=actor.id,
            target_user_id=target_user_id,
        ):
            raise FamilyGroupError(
                "forbidden",
                "You cannot update this member.",
                status_code=403,
            )
    if nickname_provided and not _can_update_nickname(
        actor=actor,
        actor_role=actor_membership.role,
        target_user_id=target_user_id,
    ):
        raise FamilyGroupError(
            "forbidden",
            "You cannot update this member's nickname.",
            status_code=403,
        )

    previous_role = target.role.value
    previous_badge_key = target.badge_key
    previous_badge_label = target.badge_label
    previous_nickname = target.display_nickname

    if role is not None:
        if role == FamilyGroupMemberRole.head:
            raise FamilyGroupError(
                "invalid_role",
                "Use transfer-head to assign the head role.",
                status_code=400,
            )
        if role not in MANAGEABLE_MEMBER_ROLES:
            raise FamilyGroupError("invalid_role", "Invalid member role.", status_code=400)
        target.role = role

    if clear_badge:
        target.badge_key = None
        target.badge_label = None
    elif badge_key is not None:
        validated_key, validated_label = validate_family_group_badge(
            badge_key=badge_key,
            badge_label=badge_label,
        )
        target.badge_key = validated_key
        target.badge_label = validated_label

    if nickname_provided:
        if clear_nickname:
            target.display_nickname = None
            target.nickname_set_by_user_id = None
        else:
            target.display_nickname = _validate_nickname(display_nickname)
            target.nickname_set_by_user_id = actor.id

    await db.flush()

    target_user = await db.get(User, target_user_id)
    if target_user and role is not None and target.role.value != previous_role:
        notify_family_member_role_changed(
            member=target_user,
            group_title=group.title,
            group_id=group_id,
            new_role=target.role.value,
        )

    if role is not None and target.role.value != previous_role:
        await record_family_group_activity(
            db,
            group_id=group_id,
            event_type=FamilyGroupActivityType.role_changed,
            actor_user_id=actor.id,
            target_user_id=target_user_id,
            metadata={"role": target.role.value},
        )

    badge_changed = (target.badge_key, target.badge_label) != (previous_badge_key, previous_badge_label)
    if badge_changed and (clear_badge or badge_key is not None):
        await record_family_group_activity(
            db,
            group_id=group_id,
            event_type=FamilyGroupActivityType.badge_changed,
            actor_user_id=actor.id,
            target_user_id=target_user_id,
            metadata={
                "badge_key": target.badge_key,
                "badge_label": target.badge_label,
            },
        )

    if nickname_provided and target.display_nickname != previous_nickname:
        await record_family_group_activity(
            db,
            group_id=group_id,
            event_type=FamilyGroupActivityType.nickname_changed,
            actor_user_id=actor.id,
            target_user_id=target_user_id,
            metadata={"nickname": target.display_nickname},
        )

    await write_audit(
        db,
        event_type=AuditEventType.family_group_member_role_changed,
        user_id=actor.id,
        ip=ip,
        metadata={
            "group_id": str(group_id),
            "target_user_id": str(target_user_id),
            "role": target.role.value,
            "badge_key": target.badge_key,
            "badge_label": target.badge_label,
            "display_nickname": target.display_nickname,
        },
    )

    members = await list_group_members_preview(db, group_id=group_id, user_id=actor.id)
    for member in members:
        if member["user_id"] == target_user_id:
            return member
    raise FamilyGroupError("member_not_found", "Group member not found.", status_code=404)


async def remove_group_member(
    db: AsyncSession,
    *,
    group_id: UUID,
    actor: User,
    target_user_id: UUID,
    ip: str | None = None,
) -> dict[str, bool]:
    group, head_membership = await require_group_head(db, group_id=group_id, user_id=actor.id)
    target = await _get_target_member_or_raise(db, group_id=group_id, target_user_id=target_user_id)

    if not can_remove_member(
        actor_role=head_membership.role,
        target_role=target.role,
        actor_user_id=actor.id,
        target_user_id=target_user_id,
    ):
        raise FamilyGroupError(
            "forbidden",
            "You cannot remove this member.",
            status_code=403,
        )

    target.status = FamilyGroupMemberStatus.removed
    await db.flush()

    removed_user = await db.get(User, target_user_id)
    if removed_user:
        notify_family_member_removed(
            member=removed_user,
            group_title=group.title,
            group_id=group_id,
            removed_by=actor,
        )

    await record_family_group_activity(
        db,
        group_id=group_id,
        event_type=FamilyGroupActivityType.member_removed,
        actor_user_id=actor.id,
        target_user_id=target_user_id,
    )

    await write_audit(
        db,
        event_type=AuditEventType.family_group_member_removed,
        user_id=actor.id,
        ip=ip,
        metadata={
            "group_id": str(group_id),
            "target_user_id": str(target_user_id),
        },
    )

    return {"ok": True}


async def leave_family_group(
    db: AsyncSession,
    *,
    group_id: UUID,
    user: User,
    ip: str | None = None,
) -> dict[str, object]:
    group, membership = await require_group_member(db, group_id=group_id, user_id=user.id)
    active_count = await count_active_members(db, group_id)

    if membership.role == FamilyGroupMemberRole.head and active_count > 1:
        raise FamilyGroupError(
            "head_must_transfer",
            "Transfer head role to another member before leaving.",
            status_code=409,
        )

    group_archived = False
    if membership.role == FamilyGroupMemberRole.head and active_count == 1:
        group.status = FamilyGroupStatus.archived
        group.archived_at = now_utc()
        group_archived = True
        await record_family_group_activity(
            db,
            group_id=group_id,
            event_type=FamilyGroupActivityType.group_archived,
            actor_user_id=user.id,
        )

    membership.status = FamilyGroupMemberStatus.removed
    await db.flush()

    await record_family_group_activity(
        db,
        group_id=group_id,
        event_type=FamilyGroupActivityType.member_left,
        target_user_id=user.id,
    )

    await write_audit(
        db,
        event_type=AuditEventType.family_group_member_left,
        user_id=user.id,
        ip=ip,
        metadata={
            "group_id": str(group_id),
            "group_archived": group_archived,
        },
    )

    return {"ok": True, "group_archived": group_archived}


async def transfer_group_head(
    db: AsyncSession,
    *,
    group_id: UUID,
    actor: User,
    new_head_user_id: UUID,
    ip: str | None = None,
) -> dict[str, object]:
    group, head_membership = await require_group_head(db, group_id=group_id, user_id=actor.id)

    if new_head_user_id == actor.id:
        raise FamilyGroupError(
            "invalid_request",
            "Choose a different member to become head.",
            status_code=400,
        )

    new_head_membership = await _get_target_member_or_raise(
        db,
        group_id=group_id,
        target_user_id=new_head_user_id,
    )
    if new_head_membership.role == FamilyGroupMemberRole.head:
        raise FamilyGroupError(
            "invalid_request",
            "This member is already the group head.",
            status_code=400,
        )

    head_membership.role = FamilyGroupMemberRole.contributor
    new_head_membership.role = FamilyGroupMemberRole.head
    await db.flush()

    new_head_user = await db.get(User, new_head_user_id)
    if new_head_user:
        notify_family_head_transferred(
            former_head=actor,
            new_head=new_head_user,
            group_title=group.title,
            group_id=group_id,
        )

    await record_family_group_activity(
        db,
        group_id=group_id,
        event_type=FamilyGroupActivityType.head_transferred,
        actor_user_id=actor.id,
        target_user_id=new_head_user_id,
    )

    await write_audit(
        db,
        event_type=AuditEventType.family_group_head_transferred,
        user_id=actor.id,
        ip=ip,
        metadata={
            "group_id": str(group_id),
            "former_head_user_id": str(actor.id),
            "new_head_user_id": str(new_head_user_id),
        },
    )

    return await serialize_family_group(db, group, viewer_user_id=actor.id)
