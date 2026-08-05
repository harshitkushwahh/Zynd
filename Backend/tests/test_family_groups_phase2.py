from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.family_groups.errors import FamilyGroupError
from app.application.family_groups.group_service import (
    create_family_group,
    get_family_group_for_user,
)
from app.application.family_groups.invite_service import (
    accept_family_group_invite,
    create_family_group_invite,
)
from app.application.family_groups.membership_service import (
    leave_family_group,
    remove_group_member,
    transfer_group_head,
    update_group_member,
)
from app.infrastructure.persistence.family_group_models import FamilyGroupMemberRole
from tests.test_family_groups_phase0 import _create_user


async def _group_with_member(db_session: AsyncSession):
    head = await _create_user(db_session, prefix="gov-head")
    member = await _create_user(db_session, prefix="gov-member")
    group = await create_family_group(db_session, user=head, title="Governance Family")
    invite = await create_family_group_invite(
        db_session,
        group_id=group["id"],
        inviter=head,
        invitee_email=member.email,
        intended_role=FamilyGroupMemberRole.viewer,
        intended_badge_key="son",
    )
    token = invite["share_url"].rsplit("/", 1)[-1]
    await accept_family_group_invite(db_session, token=token, user=member)
    return head, member, group


@pytest.mark.asyncio
async def test_head_updates_member_role_and_badge(db_session: AsyncSession, fake_redis) -> None:
    head, member, group = await _group_with_member(db_session)

    updated = await update_group_member(
        db_session,
        group_id=group["id"],
        actor=head,
        target_user_id=member.id,
        role=FamilyGroupMemberRole.contributor,
        badge_key="wife",
    )

    assert updated["role"] == "contributor"
    assert updated["badge_key"] == "wife"


@pytest.mark.asyncio
async def test_cannot_assign_head_role_via_patch(db_session: AsyncSession, fake_redis) -> None:
    head, member, group = await _group_with_member(db_session)

    with pytest.raises(FamilyGroupError) as exc_info:
        await update_group_member(
            db_session,
            group_id=group["id"],
            actor=head,
            target_user_id=member.id,
            role=FamilyGroupMemberRole.head,
        )

    assert exc_info.value.code == "invalid_role"


@pytest.mark.asyncio
async def test_head_removes_member(db_session: AsyncSession, fake_redis) -> None:
    head, member, group = await _group_with_member(db_session)

    result = await remove_group_member(
        db_session,
        group_id=group["id"],
        actor=head,
        target_user_id=member.id,
    )
    assert result["ok"] is True

    detail = await get_family_group_for_user(db_session, group_id=group["id"], user_id=head.id)
    assert detail["member_count"] == 1


@pytest.mark.asyncio
async def test_non_head_cannot_remove_member(db_session: AsyncSession, fake_redis) -> None:
    head, member, group = await _group_with_member(db_session)

    with pytest.raises(FamilyGroupError) as exc_info:
        await remove_group_member(
            db_session,
            group_id=group["id"],
            actor=member,
            target_user_id=head.id,
        )

    assert exc_info.value.code == "forbidden"


@pytest.mark.asyncio
async def test_member_leaves_group(db_session: AsyncSession, fake_redis) -> None:
    head, member, group = await _group_with_member(db_session)

    result = await leave_family_group(db_session, group_id=group["id"], user=member)
    assert result["ok"] is True
    assert result["group_archived"] is False

    with pytest.raises(FamilyGroupError) as exc_info:
        await get_family_group_for_user(db_session, group_id=group["id"], user_id=member.id)

    assert exc_info.value.code in {"forbidden", "group_not_found"}


@pytest.mark.asyncio
async def test_head_cannot_leave_with_other_members(db_session: AsyncSession, fake_redis) -> None:
    head, _member, group = await _group_with_member(db_session)

    with pytest.raises(FamilyGroupError) as exc_info:
        await leave_family_group(db_session, group_id=group["id"], user=head)

    assert exc_info.value.code == "head_must_transfer"


@pytest.mark.asyncio
async def test_solo_head_leave_archives_group(db_session: AsyncSession) -> None:
    head = await _create_user(db_session, prefix="solo-head")
    group = await create_family_group(db_session, user=head, title="Solo Family")

    result = await leave_family_group(db_session, group_id=group["id"], user=head)
    assert result["ok"] is True
    assert result["group_archived"] is True

    with pytest.raises(FamilyGroupError) as exc_info:
        await get_family_group_for_user(db_session, group_id=group["id"], user_id=head.id)

    assert exc_info.value.code in {"forbidden", "group_not_found"}


@pytest.mark.asyncio
async def test_head_transfer_updates_roles(db_session: AsyncSession, fake_redis) -> None:
    head, member, group = await _group_with_member(db_session)

    payload = await transfer_group_head(
        db_session,
        group_id=group["id"],
        actor=head,
        new_head_user_id=member.id,
    )

    assert payload["my_role"] == "contributor"

    member_view = await get_family_group_for_user(
        db_session,
        group_id=group["id"],
        user_id=member.id,
    )
    assert member_view["my_role"] == "head"


@pytest.mark.asyncio
async def test_non_head_cannot_transfer_head(db_session: AsyncSession, fake_redis) -> None:
    head, member, group = await _group_with_member(db_session)

    with pytest.raises(FamilyGroupError) as exc_info:
        await transfer_group_head(
            db_session,
            group_id=group["id"],
            actor=member,
            new_head_user_id=head.id,
        )

    assert exc_info.value.code == "forbidden"
