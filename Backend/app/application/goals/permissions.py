"""Family goal permission helpers."""

from __future__ import annotations

from app.infrastructure.persistence.family_group_models import FamilyGroupMemberRole


def can_create_family_goal(role: FamilyGroupMemberRole) -> bool:
    return role == FamilyGroupMemberRole.head


def can_manage_family_goal(role: FamilyGroupMemberRole) -> bool:
    return role == FamilyGroupMemberRole.head


def can_contribute_to_family_goal(role: FamilyGroupMemberRole) -> bool:
    return role in {FamilyGroupMemberRole.head, FamilyGroupMemberRole.contributor}


def can_view_family_goals(role: FamilyGroupMemberRole) -> bool:
    return role in {
        FamilyGroupMemberRole.head,
        FamilyGroupMemberRole.contributor,
        FamilyGroupMemberRole.viewer,
    }
