"""Family group role permission helpers."""

from __future__ import annotations

from app.infrastructure.persistence.family_group_models import FamilyGroupMemberRole

MANAGEABLE_MEMBER_ROLES = {
    FamilyGroupMemberRole.contributor,
    FamilyGroupMemberRole.viewer,
}


def can_manage_members(role: FamilyGroupMemberRole) -> bool:
    return role == FamilyGroupMemberRole.head


def can_edit_group(role: FamilyGroupMemberRole) -> bool:
    return role == FamilyGroupMemberRole.head


def can_update_member_role(
    *,
    actor_role: FamilyGroupMemberRole,
    target_role: FamilyGroupMemberRole,
    actor_user_id,
    target_user_id,
) -> bool:
    if actor_role != FamilyGroupMemberRole.head:
        return False
    if actor_user_id == target_user_id:
        return False
    if target_role == FamilyGroupMemberRole.head:
        return False
    return True


def can_remove_member(
    *,
    actor_role: FamilyGroupMemberRole,
    target_role: FamilyGroupMemberRole,
    actor_user_id,
    target_user_id,
) -> bool:
    if actor_role != FamilyGroupMemberRole.head:
        return False
    if actor_user_id == target_user_id:
        return False
    if target_role == FamilyGroupMemberRole.head:
        return False
    return True


def can_transfer_head(role: FamilyGroupMemberRole) -> bool:
    return role == FamilyGroupMemberRole.head
