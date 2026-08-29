from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.family_groups.admin_service import (
    admin_force_archive_family_group,
    admin_force_remove_group_member,
    get_admin_family_group_detail,
    get_admin_family_group_invite_detail,
    list_admin_family_group_invites,
    list_admin_family_groups,
    list_admin_user_family_groups,
)
from app.application.family_groups.errors import FamilyGroupError
from app.application.family_groups.group_service import create_family_group
from app.application.family_groups.invite_service import create_family_group_invite
from app.infrastructure.persistence.family_group_models import (
    FamilyGroupMemberRole,
    FamilyGroupStatus,
)
from tests.test_family_groups_phase0 import _create_user


@pytest.mark.asyncio
async def test_list_admin_family_groups(db_session: AsyncSession) -> None:
    head = await _create_user(db_session, prefix="admin-list-head")
    await create_family_group(db_session, user=head, title="Admin List Family")

    items = await list_admin_family_groups(db_session, search="Admin List")
    assert len(items) >= 1
    assert items[0]["title"] == "Admin List Family"
    assert items[0]["status"] == FamilyGroupStatus.active.value


@pytest.mark.asyncio
async def test_get_admin_family_group_detail(db_session: AsyncSession) -> None:
    head = await _create_user(db_session, prefix="admin-detail-head")
    created = await create_family_group(db_session, user=head, title="Detail Family")

    detail = await get_admin_family_group_detail(db_session, group_id=created["id"])
    assert detail["title"] == "Detail Family"
    assert len(detail["members"]) == 1
    assert detail["members"][0]["role"] == "head"


@pytest.mark.asyncio
async def test_admin_force_archive_family_group(db_session: AsyncSession) -> None:
    head = await _create_user(db_session, prefix="admin-archive-head")
    admin = await _create_user(db_session, prefix="admin-archive-admin")
    created = await create_family_group(db_session, user=head, title="Archive Family")

    detail = await admin_force_archive_family_group(
        db_session,
        group_id=created["id"],
        admin=admin,
    )
    assert detail["status"] == FamilyGroupStatus.archived.value
    assert detail["archived_at"] is not None


@pytest.mark.asyncio
async def test_admin_force_remove_group_member(db_session: AsyncSession, fake_redis) -> None:
    head = await _create_user(db_session, prefix="admin-remove-head")
    member = await _create_user(db_session, prefix="admin-remove-member")
    admin = await _create_user(db_session, prefix="admin-remove-admin")
    created = await create_family_group(db_session, user=head, title="Remove Family")

    pending = await create_family_group_invite(
        db_session,
        group_id=created["id"],
        inviter=head,
        invitee_email=member.email,
        intended_role=FamilyGroupMemberRole.viewer,
    )
    from app.application.family_groups.invite_service import accept_family_group_invite

    token = pending["share_url"].rsplit("/", 1)[-1]
    await accept_family_group_invite(db_session, token=token, user=member)

    detail_before = await get_admin_family_group_detail(db_session, group_id=created["id"])
    assert len(detail_before["members"]) == 2

    result = await admin_force_remove_group_member(
        db_session,
        group_id=created["id"],
        target_user_id=member.id,
        admin=admin,
    )
    assert result["ok"] is True

    detail_after = await get_admin_family_group_detail(db_session, group_id=created["id"])
    assert len(detail_after["members"]) == 1


@pytest.mark.asyncio
async def test_list_admin_user_family_groups(db_session: AsyncSession) -> None:
    head = await _create_user(db_session, prefix="admin-user-head")
    created = await create_family_group(db_session, user=head, title="User Groups Family")

    payload = await list_admin_user_family_groups(db_session, user_id=head.id)
    assert payload["user_id"] == head.id
    assert len(payload["memberships"]) == 1
    membership = payload["memberships"][0]
    assert membership["group_id"] == created["id"]
    assert membership["role"] == "head"
    assert "members_preview" in membership
    assert "active_goals_count" in membership
    assert "progress_pct" in membership
    assert len(payload["created_groups"]) == 1
    created_card = payload["created_groups"][0]
    assert created_card["id"] == created["id"]
    assert "description" in created_card
    assert "avatar_url" in created_card
    assert "members_preview" in created_card
    assert "active_goals_count" in created_card
    assert "progress_pct" in created_card


@pytest.mark.asyncio
async def test_list_admin_user_family_groups_user_not_found(db_session: AsyncSession) -> None:
    from uuid import uuid4

    with pytest.raises(FamilyGroupError) as exc_info:
        await list_admin_user_family_groups(db_session, user_id=uuid4())
    assert exc_info.value.code == "user_not_found"


@pytest.mark.asyncio
async def test_get_admin_family_group_invite_detail(db_session: AsyncSession) -> None:
    head = await _create_user(db_session, prefix="admin-invite-head")
    invitee = await _create_user(db_session, prefix="admin-invite-target")
    created = await create_family_group(db_session, user=head, title="Invite Journey Family")
    pending = await create_family_group_invite(
        db_session,
        group_id=created["id"],
        inviter=head,
        invitee_email=invitee.email,
        intended_role=FamilyGroupMemberRole.viewer,
    )

    detail = await get_admin_family_group_invite_detail(db_session, invite_id=pending["id"])
    assert detail["id"] == pending["id"]
    assert detail["group_title"] == "Invite Journey Family"
    assert detail["status"] == "pending"
    assert detail["invited_by_user_id"] == head.id
    assert [step["id"] for step in detail["journey"]] == ["sent", "awaiting", "expires"]
    assert detail["journey"][1]["state"] == "current"
