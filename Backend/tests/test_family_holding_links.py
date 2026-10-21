from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from types import SimpleNamespace

from app.application.family_groups.family_group_portfolio_service import get_family_group_portfolio
from app.application.family_groups.family_holding_link_service import (
    apply_family_link_metadata,
    materialize_family_link_from_order,
    remove_family_holding_link,
    upsert_family_holding_link,
)
from app.application.goals.constants import FAMILY_GOAL_METADATA_KEY, FAMILY_GROUP_METADATA_KEY
from app.application.goals.family_goal_service import create_family_goal, get_family_goal_contributions
from app.infrastructure.persistence.family_group_models import FamilyHoldingLink
from tests.test_goals_phase1 import _future_date
from tests.test_goals_phase2 import _group_with_roles


def _uuid(value: uuid.UUID | str) -> uuid.UUID:
    return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))


def _holding(folio: str, isin: str, current: float) -> dict:
    return {
        "id": f"{folio}::{isin}",
        "folio_number": folio,
        "isin": isin,
        "fund_name": f"Fund {isin[-4:]}",
        "units": 10,
        "current_value_inr": current,
        "invested_inr": current,
        "nav": 10,
        "source": "zynd",
    }


@pytest.mark.asyncio
async def test_family_portfolio_counts_only_linked_holding(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    head, contributor, _, group = await _group_with_roles(db_session)
    goal = await create_family_goal(
        db_session,
        group_id=group["id"],
        user_id=head.id,
        title="House",
        target_amount_inr=500_000,
        target_date=_future_date(36),
    )
    await upsert_family_holding_link(
        db_session,
        user_id=contributor.id,
        folio_number="44851151/97",
        isin="INF200K01RD1",
        family_group_id=_uuid(group["id"]),
        goal_id=_uuid(goal["id"]),
    )

    async def fake_holdings(_db, *, user_id):
        if user_id == contributor.id:
            return {
                "holdings": [
                    _holding("44851151/97", "INF200K01RD1", 15000),
                    _holding("99999999/01", "INF200K01RE9", 80000),
                ]
            }
        return {"holdings": [_holding("11111111/01", "INF200K01RF6", 40000)]}

    monkeypatch.setattr(
        "app.application.mf.portfolio_holdings_service.list_user_portfolio_holdings",
        fake_holdings,
    )

    portfolio = await get_family_group_portfolio(
        db_session,
        group_id=group["id"],
        user_id=head.id,
    )
    assert portfolio["total_current_value_inr"] == 15000
    assert portfolio["has_holdings_data"] is True
    assert len(portfolio["holdings"]) == 1
    assert portfolio["holdings"][0]["goal_id"] == str(_uuid(goal["id"]))
    assert portfolio["goal_funded_inr"] == 15000

    contributions = await get_family_goal_contributions(
        db_session,
        group_id=group["id"],
        goal_id=goal["id"],
        user_id=head.id,
    )
    assert contributions["total_contributed_inr"] == 15000
    assert contributions["member_totals"][0]["holdings"][0]["scheme_name"] == "Fund 1RD1"


@pytest.mark.asyncio
async def test_portfolio_only_link_is_not_goal_progress(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    head, contributor, _, group = await _group_with_roles(db_session)
    await upsert_family_holding_link(
        db_session,
        user_id=contributor.id,
        folio_number="44851151/97",
        isin="INF200K01RD1",
        family_group_id=_uuid(group["id"]),
        goal_id=None,
    )

    async def fake_holdings(_db, *, user_id):
        return {"holdings": [_holding("44851151/97", "INF200K01RD1", 9000)]}

    monkeypatch.setattr(
        "app.application.mf.portfolio_holdings_service.list_user_portfolio_holdings",
        fake_holdings,
    )

    portfolio = await get_family_group_portfolio(
        db_session,
        group_id=group["id"],
        user_id=head.id,
    )
    assert portfolio["total_current_value_inr"] == 9000
    assert portfolio["holdings"][0]["goal_id"] is None
    assert portfolio["goal_funded_inr"] == 0


@pytest.mark.asyncio
async def test_removed_link_is_not_recreated_from_order_metadata(db_session: AsyncSession) -> None:
    head, contributor, _, group = await _group_with_roles(db_session)
    await upsert_family_holding_link(
        db_session,
        user_id=contributor.id,
        folio_number="44851151/97",
        isin="INF200K01RD1",
        family_group_id=_uuid(group["id"]),
        goal_id=None,
    )
    await remove_family_holding_link(
        db_session,
        user_id=contributor.id,
        folio_number="44851151/97",
        isin="INF200K01RD1",
    )

    order = SimpleNamespace(
        user_id=contributor.id,
        fund_id=None,
        fp_scheme_id="INF200K01RD1",
        metadata_=apply_family_link_metadata(
            {"folio_number": "44851151/97"},
            family_group_id=_uuid(group["id"]),
            family_goal_id=None,
        ),
    )

    created = await materialize_family_link_from_order(db_session, order)
    assert created is None
    row = await db_session.scalar(select(FamilyHoldingLink).where(FamilyHoldingLink.user_id == contributor.id))
    assert row is not None
    assert row.removed_at is not None
    assert apply_family_link_metadata({}, family_group_id=_uuid(group["id"]), family_goal_id=None)[
        FAMILY_GROUP_METADATA_KEY
    ]
    assert FAMILY_GOAL_METADATA_KEY not in apply_family_link_metadata(
        {},
        family_group_id=_uuid(group["id"]),
        family_goal_id=None,
    )
