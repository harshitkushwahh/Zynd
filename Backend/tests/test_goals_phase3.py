from __future__ import annotations

import uuid
from decimal import Decimal
from types import SimpleNamespace

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.goals.errors import GoalError
from app.application.goals.family_goal_service import create_family_goal, get_family_goal_contributions
from app.application.goals.goal_funding_service import (
    FAMILY_GOAL_METADATA_KEY,
    apply_family_goal_metadata,
    list_linkable_family_goals,
    record_contribution_from_order,
    record_contribution_from_sip_plan,
    validate_family_goal_link,
)
from app.infrastructure.persistence.family_group_models import FamilyGroupMemberRole
from app.infrastructure.persistence.goal_models import GoalContribution, GoalContributionSourceType
from tests.test_family_groups_phase0 import _create_user
from tests.test_goals_phase2 import _group_with_roles
from tests.test_goals_phase1 import _future_date


@pytest.mark.asyncio
async def test_list_linkable_family_goals_for_contributors(db_session: AsyncSession) -> None:
    head, contributor, viewer, group = await _group_with_roles(db_session)
    goal = await create_family_goal(
        db_session,
        group_id=group["id"],
        user_id=head.id,
        title="Linkable Goal",
        target_amount_inr=500_000,
        target_date=_future_date(36),
    )

    contributor_items = await list_linkable_family_goals(db_session, user_id=contributor.id)
    viewer_items = await list_linkable_family_goals(db_session, user_id=viewer.id)

    assert len(contributor_items) == 1
    assert contributor_items[0]["goal_id"] == goal["id"]
    assert contributor_items[0]["group_title"] == group["title"]
    assert contributor_items[0]["my_role"] == FamilyGroupMemberRole.contributor.value
    assert viewer_items == []


@pytest.mark.asyncio
async def test_viewer_cannot_link_payment_to_family_goal(db_session: AsyncSession) -> None:
    head, _, viewer, group = await _group_with_roles(db_session)
    goal = await create_family_goal(
        db_session,
        group_id=group["id"],
        user_id=head.id,
        title="Protected Goal",
        target_amount_inr=200_000,
        target_date=_future_date(24),
    )

    with pytest.raises(GoalError) as exc_info:
        await validate_family_goal_link(
            db_session,
            user_id=viewer.id,
            family_goal_id=uuid.UUID(goal["id"]),
        )

    assert exc_info.value.code == "forbidden"


@pytest.mark.asyncio
async def test_record_contribution_from_lumpsum_order(db_session: AsyncSession) -> None:
    head, contributor, _, group = await _group_with_roles(db_session)
    goal = await create_family_goal(
        db_session,
        group_id=group["id"],
        user_id=head.id,
        title="Wedding Fund",
        target_amount_inr=1_000_000,
        target_date=_future_date(48),
    )

    order = SimpleNamespace(
        id=uuid.uuid4(),
        user_id=contributor.id,
        amount_inr=Decimal("15000"),
        metadata_=apply_family_goal_metadata({}, family_goal_id=uuid.UUID(goal["id"])),
    )

    contribution = await record_contribution_from_order(db_session, order)
    assert contribution is not None
    assert contribution.amount_inr == Decimal("15000")
    assert contribution.source_type == GoalContributionSourceType.lumpsum_order
    assert contribution.source_id == order.id

    duplicate = await record_contribution_from_order(db_session, order)
    assert duplicate is None

    contributions = await get_family_goal_contributions(
        db_session,
        group_id=group["id"],
        goal_id=goal["id"],
        user_id=head.id,
    )
    assert contributions["total_contributed_inr"] == 15_000
    assert len(contributions["items"]) == 1


@pytest.mark.asyncio
async def test_record_contribution_from_sip_plan(db_session: AsyncSession) -> None:
    head, contributor, _, group = await _group_with_roles(db_session)
    goal = await create_family_goal(
        db_session,
        group_id=group["id"],
        user_id=head.id,
        title="Education Fund",
        target_amount_inr=800_000,
        target_date=_future_date(60),
    )

    plan = SimpleNamespace(
        id=uuid.uuid4(),
        user_id=contributor.id,
        amount_inr=Decimal("5000"),
        metadata_=apply_family_goal_metadata({}, family_goal_id=uuid.UUID(goal["id"])),
    )

    contribution = await record_contribution_from_sip_plan(db_session, plan)
    assert contribution is not None
    assert contribution.source_type == GoalContributionSourceType.sip_plan

    stored = await db_session.scalar(
        select(GoalContribution).where(
            GoalContribution.source_type == GoalContributionSourceType.sip_plan,
            GoalContribution.source_id == plan.id,
        )
    )
    assert stored is not None
    assert stored.note == "SIP plan linked"


@pytest.mark.asyncio
async def test_apply_family_goal_metadata_roundtrip() -> None:
    goal_id = uuid.uuid4()
    payload = apply_family_goal_metadata({"user_ip": "127.0.0.1"}, family_goal_id=goal_id)
    assert payload[FAMILY_GOAL_METADATA_KEY] == str(goal_id)
    assert payload["user_ip"] == "127.0.0.1"

    cleared = apply_family_goal_metadata(payload, family_goal_id=None)
    assert FAMILY_GOAL_METADATA_KEY not in cleared
    assert cleared["user_ip"] == "127.0.0.1"
