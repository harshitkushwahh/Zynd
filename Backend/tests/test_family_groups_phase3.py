from __future__ import annotations

from datetime import timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.family_groups.activity_service import list_family_group_activity
from app.application.family_groups.errors import FamilyGroupError
from app.application.family_groups.group_service import create_family_group
from app.application.family_groups.invite_reminder_service import run_family_invite_reminder_batch
from app.application.family_groups.invite_service import (
    accept_family_group_invite,
    create_family_group_invite,
)
from app.application.family_groups.membership_service import update_group_member
from app.application.messaging.scheduled_events import begin_event_batch, discard_scheduled_events, take_scheduled_events
from app.infrastructure.persistence.family_group_models import (
    FamilyGroupActivityType,
    FamilyGroupInvite,
    FamilyGroupMemberRole,
)
from tests.test_family_groups_phase0 import _create_user


async def _group_with_member(db_session: AsyncSession):
    head = await _create_user(db_session, prefix="engage-head")
    member = await _create_user(db_session, prefix="engage-member")
    group = await create_family_group(db_session, user=head, title="Engagement Family")
    invite = await create_family_group_invite(
        db_session,
        group_id=group["id"],
        inviter=head,
        invitee_email=member.email,
        intended_role=FamilyGroupMemberRole.viewer,
    )
    token = invite["share_url"].rsplit("/", 1)[-1]
    await accept_family_group_invite(db_session, token=token, user=member)
    return head, member, group


@pytest.mark.asyncio
async def test_accept_invite_records_activity(db_session: AsyncSession, fake_redis) -> None:
    head, member, group = await _group_with_member(db_session)

    feed = await list_family_group_activity(
        db_session,
        group_id=group["id"],
        user_id=head.id,
    )

    event_types = {item["event_type"] for item in feed["items"]}
    assert FamilyGroupActivityType.invite_sent.value in event_types
    assert FamilyGroupActivityType.invite_accepted.value in event_types
    assert FamilyGroupActivityType.member_joined.value in event_types
    assert any("joined" in str(item["message"]).lower() for item in feed["items"])


@pytest.mark.asyncio
async def test_head_sets_member_nickname(db_session: AsyncSession, fake_redis) -> None:
    head, member, group = await _group_with_member(db_session)

    updated = await update_group_member(
        db_session,
        group_id=group["id"],
        actor=head,
        target_user_id=member.id,
        display_nickname="Priya",
        nickname_provided=True,
    )

    assert updated["display_nickname"] == "Priya"
    assert updated["display_name"] == "Priya"


@pytest.mark.asyncio
async def test_member_sets_own_nickname(db_session: AsyncSession, fake_redis) -> None:
    head, member, group = await _group_with_member(db_session)

    updated = await update_group_member(
        db_session,
        group_id=group["id"],
        actor=member,
        target_user_id=member.id,
        display_nickname="Me in family",
        nickname_provided=True,
    )

    assert updated["display_nickname"] == "Me in family"


@pytest.mark.asyncio
async def test_member_cannot_set_other_nickname(db_session: AsyncSession, fake_redis) -> None:
    head, member, group = await _group_with_member(db_session)

    with pytest.raises(FamilyGroupError) as exc_info:
        await update_group_member(
            db_session,
            group_id=group["id"],
            actor=member,
            target_user_id=head.id,
            display_nickname="Boss",
            nickname_provided=True,
        )

    assert exc_info.value.code == "forbidden"


@pytest.mark.asyncio
async def test_invite_reminder_is_idempotent(db_session: AsyncSession, fake_redis) -> None:
    begin_event_batch()
    head = await _create_user(db_session, prefix="reminder-head")
    invitee = await _create_user(db_session, prefix="reminder-target")
    group = await create_family_group(db_session, user=head, title="Reminder Family")
    invite_payload = await create_family_group_invite(
        db_session,
        group_id=group["id"],
        inviter=head,
        invitee_email=invitee.email,
    )

    invite = await db_session.get(FamilyGroupInvite, invite_payload["id"])
    assert invite is not None
    invite.created_at = invite.created_at - timedelta(hours=49)
    await db_session.flush()
    discard_scheduled_events()

    first = await run_family_invite_reminder_batch(db_session)
    assert first["sent"] == 1
    assert len(take_scheduled_events()) == 1

    second = await run_family_invite_reminder_batch(db_session)
    assert second["sent"] == 0

    await db_session.refresh(invite)
    assert invite.reminder_count == 1
    assert invite.reminder_sent_at is not None
