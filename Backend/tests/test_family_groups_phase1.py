from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.family_groups.errors import FamilyGroupError
from app.application.family_groups.group_service import create_family_group
from app.application.family_groups.invite_service import (
    accept_family_group_invite,
    create_family_group_invite,
    decline_family_group_invite,
    preview_family_group_invite,
)
from app.infrastructure.persistence.family_group_models import FamilyGroupMemberRole
from app.infrastructure.persistence.models import User, UserRole, UserStatus
from tests.test_family_groups_phase0 import _create_user


@pytest.mark.asyncio
async def test_create_invite_returns_share_url(db_session: AsyncSession, fake_redis) -> None:
    head = await _create_user(db_session, prefix="invite-head")
    invitee = await _create_user(db_session, prefix="invite-target")

    group = await create_family_group(db_session, user=head, title="Invite Family")
    payload = await create_family_group_invite(
        db_session,
        group_id=group["id"],
        inviter=head,
        invitee_email=invitee.email,
        intended_role=FamilyGroupMemberRole.viewer,
        intended_badge_key="son",
    )

    assert payload["status"] == "pending"
    assert payload["intended_role"] == "viewer"
    assert payload["intended_badge_key"] == "son"
    assert payload["share_url"]


@pytest.mark.asyncio
async def test_accept_invite_adds_member(db_session: AsyncSession, fake_redis) -> None:
    head = await _create_user(db_session, prefix="accept-head")
    invitee = await _create_user(db_session, prefix="accept-target")

    group = await create_family_group(db_session, user=head, title="Accept Family")
    invite = await create_family_group_invite(
        db_session,
        group_id=group["id"],
        inviter=head,
        invitee_email=invitee.email,
        intended_role=FamilyGroupMemberRole.contributor,
        intended_badge_key="wife",
    )

    token = invite["share_url"].rsplit("/", 1)[-1]
    preview = await preview_family_group_invite(db_session, token=token)
    assert preview["group_title"] == "Accept Family"

    joined = await accept_family_group_invite(db_session, token=token, user=invitee)
    assert joined["my_role"] == "contributor"
    assert joined["member_count"] == 2


@pytest.mark.asyncio
async def test_decline_invite_marks_declined(db_session: AsyncSession, fake_redis) -> None:
    head = await _create_user(db_session, prefix="decline-head")
    invitee = await _create_user(db_session, prefix="decline-target")

    group = await create_family_group(db_session, user=head, title="Decline Family")
    invite = await create_family_group_invite(
        db_session,
        group_id=group["id"],
        inviter=head,
        invitee_email=invitee.email,
    )
    token = invite["share_url"].rsplit("/", 1)[-1]

    result = await decline_family_group_invite(db_session, token=token, user=invitee)
    assert result["ok"] is True

    with pytest.raises(FamilyGroupError) as exc_info:
        await accept_family_group_invite(db_session, token=token, user=invitee)

    assert exc_info.value.code == "invalid_invite"


@pytest.mark.asyncio
async def test_cannot_invite_existing_member(db_session: AsyncSession, fake_redis) -> None:
    head = await _create_user(db_session, prefix="member-head")
    invitee = await _create_user(db_session, prefix="member-target")

    group = await create_family_group(db_session, user=head, title="Member Family")
    first = await create_family_group_invite(
        db_session,
        group_id=group["id"],
        inviter=head,
        invitee_email=invitee.email,
    )
    token = first["share_url"].rsplit("/", 1)[-1]
    await accept_family_group_invite(db_session, token=token, user=invitee)

    with pytest.raises(FamilyGroupError) as exc_info:
        await create_family_group_invite(
            db_session,
            group_id=group["id"],
            inviter=head,
            invitee_email=invitee.email,
        )

    assert exc_info.value.code == "already_member"


@pytest.mark.asyncio
async def test_group_capacity_includes_pending_invites(db_session: AsyncSession, fake_redis) -> None:
    head = await _create_user(db_session, prefix="capacity-head")
    group = await create_family_group(db_session, user=head, title="Capacity Family")

    for index in range(11):
        invitee = User(
            email=f"capacity-{index}-{uuid4()}@example.com",
            password_hash="hash",
            role=UserRole.user,
            status=UserStatus.active,
        )
        db_session.add(invitee)
        await db_session.flush()
        await create_family_group_invite(
            db_session,
            group_id=group["id"],
            inviter=head,
            invitee_email=invitee.email,
        )

    overflow = User(
        email=f"capacity-overflow-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(overflow)
    await db_session.flush()

    with pytest.raises(FamilyGroupError) as exc_info:
        await create_family_group_invite(
            db_session,
            group_id=group["id"],
            inviter=head,
            invitee_email=overflow.email,
        )

    assert exc_info.value.code == "group_full"


@pytest.mark.asyncio
async def test_self_invite_is_rejected(db_session: AsyncSession, fake_redis) -> None:
    head = await _create_user(db_session, prefix="self-head")
    group = await create_family_group(db_session, user=head, title="Self Family")

    with pytest.raises(FamilyGroupError) as exc_info:
        await create_family_group_invite(
            db_session,
            group_id=group["id"],
            inviter=head,
            invitee_email=head.email,
        )

    assert exc_info.value.code == "self_invite"
