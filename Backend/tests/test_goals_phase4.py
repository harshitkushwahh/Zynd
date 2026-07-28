from __future__ import annotations

import uuid
from decimal import Decimal
from types import SimpleNamespace

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.family_groups.family_group_portfolio_service import get_family_group_portfolio
from app.application.family_groups.group_service import create_family_group, list_group_members_preview
from app.application.goals.family_goal_service import add_family_goal_contribution, create_family_goal
from app.application.goals.goal_funding_service import apply_family_goal_metadata
from app.application.goals.goal_portfolio_service import linked_active_sip_monthly_inr
from app.infrastructure.persistence.mf_transaction_models import MfSipPlanStatus
from tests.test_family_groups_phase0 import _create_user
from tests.test_goals_phase2 import _group_with_roles
from tests.test_goals_phase1 import _future_date


@pytest.mark.asyncio
async def test_family_group_portfolio_empty_group(db_session: AsyncSession) -> None:
    head = await _create_user(db_session, prefix="portfolio-head")
    group = await create_family_group(db_session, user=head, title="Portfolio Family")

    portfolio = await get_family_group_portfolio(
        db_session,
        group_id=group["id"],
        user_id=head.id,
    )

    assert portfolio["total_current_value_inr"] == 0
    assert portfolio["total_invested_inr"] == 0
    assert portfolio["active_sips_count"] == 0
    assert portfolio["active_goals_count"] == 0
    assert portfolio["has_holdings_data"] is False
    assert portfolio["slices"] == []


@pytest.mark.asyncio
async def test_member_contribution_totals_surface_for_head(db_session: AsyncSession) -> None:
    head, contributor, _, group = await _group_with_roles(db_session)
    goal = await create_family_goal(
        db_session,
        group_id=group["id"],
        user_id=head.id,
        title="Shared Fund",
        target_amount_inr=500_000,
        target_date=_future_date(36),
    )
    await add_family_goal_contribution(
        db_session,
        group_id=group["id"],
        goal_id=goal["id"],
        user_id=contributor.id,
        amount_inr=12_500,
    )

    members = await list_group_members_preview(
        db_session,
        group_id=group["id"],
        user_id=head.id,
    )
    contributor_row = next(item for item in members if item["user_id"] == contributor.id)
    assert contributor_row["contribution_amount"] == 12_500


@pytest.mark.asyncio
async def test_linked_active_sip_monthly_sums_goal_plans(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    head, contributor, _, group = await _group_with_roles(db_session)
    goal = await create_family_goal(
        db_session,
        group_id=group["id"],
        user_id=head.id,
        title="SIP Goal",
        target_amount_inr=300_000,
        target_date=_future_date(24),
    )
    plan = SimpleNamespace(
        user_id=contributor.id,
        amount_inr=Decimal("5000"),
        status=MfSipPlanStatus.active,
        metadata_=apply_family_goal_metadata({}, family_goal_id=uuid.UUID(goal["id"])),
    )

    class _Scalars:
        def __init__(self, items):
            self._items = items

        def __iter__(self):
            return iter(self._items)

    class _Result:
        def scalars(self):
            return _Scalars([plan])

    async def fake_execute(_stmt, *_args, **_kwargs):
        return _Result()

    monkeypatch.setattr(db_session, "execute", fake_execute)

    total = await linked_active_sip_monthly_inr(
        db_session,
        user_id=contributor.id,
        goal_id=uuid.UUID(goal["id"]),
    )
    assert total == Decimal("5000")
