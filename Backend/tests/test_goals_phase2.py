from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.family_groups.activity_service import list_family_group_activity
from app.application.family_groups.errors import FamilyGroupError
from app.application.family_groups.group_service import create_family_group
from app.application.family_groups.invite_service import accept_family_group_invite, create_family_group_invite
from app.application.family_groups.membership_service import update_group_member
from app.application.goals.errors import GoalError
from app.application.goals.family_goal_service import (
    add_family_goal_contribution,
    archive_family_goal,
    count_active_family_goals,
    create_family_goal,
    get_family_goal_contributions,
    list_family_goals,
)
from app.application.goals.goal_template_seed_service import ensure_goal_template_seed
from app.infrastructure.persistence.family_group_models import (
    FamilyGroupActivityType,
    FamilyGroupMemberRole,
)
from tests.test_family_groups_phase0 import _create_user
from tests.test_goals_phase1 import _future_date


async def _group_with_roles(db_session: AsyncSession):
    head = await _create_user(db_session, prefix="fg-head")
    contributor = await _create_user(db_session, prefix="fg-contrib")
    viewer = await _create_user(db_session, prefix="fg-viewer")
    group = await create_family_group(db_session, user=head, title="Goals Family")

    for user, role in ((contributor, FamilyGroupMemberRole.contributor), (viewer, FamilyGroupMemberRole.viewer)):
        invite = await create_family_group_invite(
            db_session,
            group_id=group["id"],
            inviter=head,
            invitee_email=user.email,
            intended_role=role,
        )
        token = invite["share_url"].rsplit("/", 1)[-1]
        await accept_family_group_invite(db_session, token=token, user=user)

    return head, contributor, viewer, group


@pytest.mark.asyncio
async def test_head_can_create_family_goal(db_session: AsyncSession) -> None:
    await ensure_goal_template_seed(db_session)
    head, _, _, group = await _group_with_roles(db_session)

    goal = await create_family_goal(
        db_session,
        group_id=group["id"],
        user_id=head.id,
        title="Family Wedding Fund",
        target_amount_inr=1_000_000,
        target_date=_future_date(36),
        tag="wedding",
        priority=1,
    )

    assert goal["family_group_id"] == str(group["id"])
    assert goal["created_by_user_id"] == str(head.id)
    assert goal["title"] == "Family Wedding Fund"
    assert await count_active_family_goals(db_session, group_id=group["id"]) == 1


@pytest.mark.asyncio
async def test_contributor_cannot_create_family_goal(db_session: AsyncSession) -> None:
    head, contributor, _, group = await _group_with_roles(db_session)

    with pytest.raises(FamilyGroupError) as exc_info:
        await create_family_goal(
            db_session,
            group_id=group["id"],
            user_id=contributor.id,
            title="Not allowed",
            target_amount_inr=100_000,
            target_date=_future_date(24),
        )

    assert exc_info.value.code == "forbidden"


@pytest.mark.asyncio
async def test_contributor_can_add_manual_contribution(db_session: AsyncSession) -> None:
    head, contributor, viewer, group = await _group_with_roles(db_session)
    goal = await create_family_goal(
        db_session,
        group_id=group["id"],
        user_id=head.id,
        title="Education Fund",
        target_amount_inr=500_000,
        target_date=_future_date(48),
    )

    await add_family_goal_contribution(
        db_session,
        group_id=group["id"],
        goal_id=goal["id"],
        user_id=contributor.id,
        amount_inr=25_000,
        note="Monthly top-up",
    )

    contributions = await get_family_goal_contributions(
        db_session,
        group_id=group["id"],
        goal_id=goal["id"],
        user_id=viewer.id,
    )

    assert contributions["total_contributed_inr"] == 25_000
    assert len(contributions["member_totals"]) == 1
    assert contributions["member_totals"][0]["user_id"] == str(contributor.id)
    assert len(contributions["items"]) == 1


@pytest.mark.asyncio
async def test_viewer_cannot_contribute(db_session: AsyncSession) -> None:
    head, _, viewer, group = await _group_with_roles(db_session)
    goal = await create_family_goal(
        db_session,
        group_id=group["id"],
        user_id=head.id,
        title="Travel Fund",
        target_amount_inr=300_000,
        target_date=_future_date(24),
    )

    with pytest.raises(GoalError) as exc_info:
        await add_family_goal_contribution(
            db_session,
            group_id=group["id"],
            goal_id=goal["id"],
            user_id=viewer.id,
            amount_inr=5_000,
        )

    assert exc_info.value.code == "forbidden"


@pytest.mark.asyncio
async def test_family_goal_activity_is_recorded(db_session: AsyncSession) -> None:
    head, contributor, _, group = await _group_with_roles(db_session)
    goal = await create_family_goal(
        db_session,
        group_id=group["id"],
        user_id=head.id,
        title="Home Fund",
        target_amount_inr=2_000_000,
        target_date=_future_date(120),
    )
    await add_family_goal_contribution(
        db_session,
        group_id=group["id"],
        goal_id=goal["id"],
        user_id=contributor.id,
        amount_inr=10_000,
    )
    await archive_family_goal(
        db_session,
        group_id=group["id"],
        goal_id=goal["id"],
        user_id=head.id,
    )

    feed = await list_family_group_activity(
        db_session,
        group_id=group["id"],
        user_id=head.id,
    )
    event_types = {item["event_type"] for item in feed["items"]}
    assert FamilyGroupActivityType.goal_created.value in event_types
    assert FamilyGroupActivityType.goal_contribution_added.value in event_types
    assert FamilyGroupActivityType.goal_archived.value in event_types


@pytest.mark.asyncio
async def test_list_family_goals_for_all_members(db_session: AsyncSession) -> None:
    head, _, viewer, group = await _group_with_roles(db_session)
    await create_family_goal(
        db_session,
        group_id=group["id"],
        user_id=head.id,
        title="Shared Goal",
        target_amount_inr=400_000,
        target_date=_future_date(30),
    )

    head_items = await list_family_goals(db_session, group_id=group["id"], user_id=head.id)
    viewer_items = await list_family_goals(db_session, group_id=group["id"], user_id=viewer.id)

    assert len(head_items) == 1
    assert len(viewer_items) == 1
    assert head_items[0]["title"] == "Shared Goal"
