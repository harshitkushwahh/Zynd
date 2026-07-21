from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.family_groups.errors import FamilyGroupError
from app.application.family_groups.group_service import create_family_group, list_group_members_preview
from app.application.family_groups.invite_service import accept_family_group_invite
from app.application.family_groups.nominee_bridge_service import (
    add_nominee_to_family_group,
    preview_nominee_family_group_add,
)
from tests.test_family_groups_phase0 import _create_user


@pytest.mark.asyncio
async def test_preview_no_groups(db_session: AsyncSession) -> None:
    user = await _create_user(db_session, prefix="kyc-no-group")
    payload = await preview_nominee_family_group_add(
        db_session,
        user=user,
        nominee_email="nominee@example.com",
        nominee_name="Priya Sharma",
        relationship="Spouse",
        kyc_nominee_id="nominee-1",
    )
    assert payload["status"] == "no_groups"
    assert payload["suggested_badge_key"] == "custom"


@pytest.mark.asyncio
async def test_preview_ok_for_single_head_group(db_session: AsyncSession, fake_redis) -> None:
    head = await _create_user(db_session, prefix="kyc-head")
    await create_family_group(db_session, user=head, title="KYC Family")

    payload = await preview_nominee_family_group_add(
        db_session,
        user=head,
        nominee_email="nominee@example.com",
        nominee_name="Priya Sharma",
        relationship="Son",
        kyc_nominee_id="nominee-2",
    )
    assert payload["status"] == "ok"
    assert payload["suggested_badge_key"] == "son"


@pytest.mark.asyncio
async def test_add_nominee_creates_invite(db_session: AsyncSession, fake_redis) -> None:
    head = await _create_user(db_session, prefix="kyc-invite-head")
    await create_family_group(db_session, user=head, title="Invite Family")

    result = await add_nominee_to_family_group(
        db_session,
        user=head,
        nominee_email="family.nominee@example.com",
        nominee_name="Rahul Sharma",
        relationship="Son",
        kyc_nominee_id="nominee-3",
        action="invite",
    )
    assert result["ok"] is True
    assert result["action"] == "invite"
    assert result["invite"]["status"] == "pending"


@pytest.mark.asyncio
async def test_skip_nominee_is_idempotent(db_session: AsyncSession) -> None:
    user = await _create_user(db_session, prefix="kyc-skip")
    skipped = await add_nominee_to_family_group(
        db_session,
        user=user,
        nominee_email="skip@example.com",
        nominee_name="Skip Nominee",
        relationship="Other",
        kyc_nominee_id="nominee-4",
        action="skip",
    )
    assert skipped["action"] == "skip"

    skipped_again = await add_nominee_to_family_group(
        db_session,
        user=user,
        nominee_email="skip@example.com",
        nominee_name="Skip Nominee",
        relationship="Other",
        kyc_nominee_id="nominee-4",
        action="skip",
    )
    assert skipped_again["action"] == "skip"

    preview = await preview_nominee_family_group_add(
        db_session,
        user=user,
        nominee_email="skip@example.com",
        nominee_name="Skip Nominee",
        relationship="Other",
        kyc_nominee_id="nominee-4",
    )
    assert preview["status"] == "no_groups"

    invited = await add_nominee_to_family_group(
        db_session,
        user=user,
        nominee_email="skip@example.com",
        nominee_name="Skip Nominee",
        relationship="Other",
        kyc_nominee_id="nominee-4",
        create_group_title="Skip Family",
        action="invite",
    )
    assert invited["action"] == "invite"

    handled_preview = await preview_nominee_family_group_add(
        db_session,
        user=user,
        nominee_email="skip@example.com",
        nominee_name="Skip Nominee",
        relationship="Other",
        kyc_nominee_id="nominee-4",
    )
    assert handled_preview["status"] == "already_handled"


@pytest.mark.asyncio
async def test_create_group_and_invite_nominee(db_session: AsyncSession, fake_redis) -> None:
    head = await _create_user(db_session, prefix="kyc-create-head")
    result = await add_nominee_to_family_group(
        db_session,
        user=head,
        nominee_email="new.family@example.com",
        nominee_name="New Nominee",
        relationship="Daughter",
        kyc_nominee_id="nominee-5",
        create_group_title="Nominee Family",
        action="invite",
    )
    assert result["ok"] is True
    assert result["group"]["title"] == "Nominee Family"


@pytest.mark.asyncio
async def test_skip_then_invite_on_review_reprompt(db_session: AsyncSession, fake_redis) -> None:
    head = await _create_user(db_session, prefix="kyc-reprompt")
    await create_family_group(db_session, user=head, title="Reprompt Family")

    await add_nominee_to_family_group(
        db_session,
        user=head,
        nominee_email="reprompt@example.com",
        nominee_name="Reprompt Nominee",
        relationship="Spouse",
        kyc_nominee_id="nominee-reprompt",
        action="skip",
    )

    preview = await preview_nominee_family_group_add(
        db_session,
        user=head,
        nominee_email="reprompt@example.com",
        nominee_name="Reprompt Nominee",
        relationship="Spouse",
        kyc_nominee_id="nominee-reprompt",
    )
    assert preview["status"] == "ok"

    result = await add_nominee_to_family_group(
        db_session,
        user=head,
        nominee_email="reprompt@example.com",
        nominee_name="Reprompt Nominee",
        relationship="Spouse",
        kyc_nominee_id="nominee-reprompt",
        action="invite",
    )
    assert result["ok"] is True
    assert result["action"] == "invite"

    head = await _create_user(db_session, prefix="kyc-nick-head")
    invitee = await _create_user(db_session, prefix="kyc-nick-target")
    await create_family_group(db_session, user=head, title="Nickname Family")

    invite_result = await add_nominee_to_family_group(
        db_session,
        user=head,
        nominee_email=invitee.email,
        nominee_name="Display Nick",
        relationship="Wife",
        kyc_nominee_id="nominee-6",
        action="invite",
    )
    token = invite_result["invite"]["share_url"].rsplit("/", 1)[-1]
    await accept_family_group_invite(db_session, token=token, user=invitee)

    members = await list_group_members_preview(
        db_session,
        group_id=invite_result["group"]["id"],
        user_id=head.id,
    )
    joined = next(member for member in members if member["user_id"] == invitee.id)
    assert joined["display_nickname"] == "Display Nick"
