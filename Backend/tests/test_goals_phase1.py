from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.goals.goal_calculator_service import calculate_goal_plan
from app.application.goals.goal_service import create_personal_goal, list_personal_goals, update_personal_goal, archive_personal_goal, restore_personal_goal, delete_personal_goal
from app.application.goals.goal_template_seed_service import ensure_goal_template_seed
from app.application.goals.goal_template_service import list_goal_templates
from app.main import app
from tests.test_family_groups_phase0 import _create_user


def _future_date(months: int = 60) -> date:
    today = date.today()
    year = today.year + (today.month + months - 1) // 12
    month = (today.month + months - 1) % 12 + 1
    day = min(today.day, 28)
    return date(year, month, day)


@pytest.mark.asyncio
async def test_update_and_archive_personal_goal(db_session: AsyncSession) -> None:
    user = await _create_user(db_session, prefix="goals-update")
    created = await create_personal_goal(
        db_session,
        user_id=user.id,
        title="Update me",
        target_amount_inr=250_000,
        target_date=_future_date(30),
    )
    updated = await update_personal_goal(
        db_session,
        goal_id=created["id"],
        user_id=user.id,
        priority=1,
        current_amount_inr=20_000,
    )
    assert updated["priority"] == 1
    assert updated["current_amount_inr"] == 20_000

    archived = await archive_personal_goal(
        db_session,
        goal_id=created["id"],
        user_id=user.id,
    )
    assert archived["status"] == "archived"


@pytest.mark.asyncio
async def test_restore_and_delete_archived_personal_goal(db_session: AsyncSession) -> None:
    user = await _create_user(db_session, prefix="goals-restore-delete")
    created = await create_personal_goal(
        db_session,
        user_id=user.id,
        title="Archive cycle",
        target_amount_inr=150_000,
        target_date=_future_date(24),
    )
    await archive_personal_goal(
        db_session,
        goal_id=created["id"],
        user_id=user.id,
    )

    restored = await restore_personal_goal(
        db_session,
        goal_id=created["id"],
        user_id=user.id,
    )
    assert restored["status"] == "active"

    await archive_personal_goal(
        db_session,
        goal_id=created["id"],
        user_id=user.id,
    )
    await delete_personal_goal(
        db_session,
        goal_id=created["id"],
        user_id=user.id,
    )

    items = await list_personal_goals(db_session, user_id=user.id, include_archived=True)
    assert items == []


@pytest.mark.asyncio
async def test_goal_template_seed_is_idempotent(db_session: AsyncSession) -> None:
    await ensure_goal_template_seed(db_session)
    first = await list_goal_templates(db_session, include_inactive=True)
    await ensure_goal_template_seed(db_session)
    second = await list_goal_templates(db_session, include_inactive=True)
    assert len(first) == 6
    assert len(second) == 6
    slugs = {item["slug"] for item in second}
    assert slugs == {"car", "travel", "education", "wedding", "home", "retirement"}


@pytest.mark.asyncio
async def test_calculate_goal_plan_returns_required_sip(db_session: AsyncSession) -> None:
    result = calculate_goal_plan(
        target_amount_inr=Decimal("1000000"),
        target_date=_future_date(60),
        existing_savings_inr=Decimal("100000"),
        expected_return_pct=Decimal("12"),
    )
    assert result["duration_months"] >= 59
    assert result["required_monthly_sip_inr"] > 0
    assert result["required_lumpsum_inr"] >= 0
    assert len(result["milestones"]) >= 1


def test_calculate_goal_plan_accepts_float_inputs() -> None:
    result = calculate_goal_plan(
        target_amount_inr=500_000.0,
        target_date=_future_date(36),
        existing_savings_inr=0.0,
        expected_return_pct=12.0,
    )
    assert result["required_monthly_sip_inr"] > 0
    assert result["projected_value_inr"] >= result["target_amount_inr"] * 0.99


def test_calculate_goal_plan_when_savings_cover_target() -> None:
    target = Decimal("20000000")
    result = calculate_goal_plan(
        target_amount_inr=target,
        target_date=_future_date(180),
        existing_savings_inr=target,
        expected_return_pct=Decimal("100"),
    )
    assert result["required_monthly_sip_inr"] == 0
    assert result["required_lumpsum_inr"] == 0
    assert result["projected_value_inr"] == float(target)


@pytest.mark.asyncio
async def test_create_personal_goal_with_template(db_session: AsyncSession) -> None:
    await ensure_goal_template_seed(db_session)
    user = await _create_user(db_session, prefix="goals-user")
    templates = await list_goal_templates(db_session)
    car_template = next(item for item in templates if item["slug"] == "car")

    goal = await create_personal_goal(
        db_session,
        user_id=user.id,
        title="My Car Fund",
        target_amount_inr=800_000,
        target_date=_future_date(48),
        template_id=car_template["id"],
        tag="priority",
        priority=1,
        existing_savings_inr=50_000,
    )

    assert goal["title"] == "My Car Fund"
    assert goal["template"]["slug"] == "car"
    assert goal["tag"] == "priority"
    assert goal["priority"] == 1
    assert goal["progress_pct"] > 0


@pytest.mark.asyncio
async def test_list_personal_goals_orders_by_priority(db_session: AsyncSession) -> None:
    user = await _create_user(db_session, prefix="goals-list")
    await create_personal_goal(
        db_session,
        user_id=user.id,
        title="Low priority",
        target_amount_inr=100_000,
        target_date=_future_date(24),
        priority=5,
    )
    await create_personal_goal(
        db_session,
        user_id=user.id,
        title="High priority",
        target_amount_inr=200_000,
        target_date=_future_date(36),
        priority=1,
    )

    items = await list_personal_goals(db_session, user_id=user.id)
    assert items[0]["title"] == "High priority"
    assert items[1]["title"] == "Low priority"


@pytest.mark.asyncio
async def test_goals_api_requires_auth() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        unauthenticated = await client.get("/api/v1/goals/templates")
        assert unauthenticated.status_code == 401

        calc = await client.post(
            "/api/v1/goals/calculate",
            json={
                "target_amount_inr": 500000,
                "target_date": _future_date(36).isoformat(),
                "existing_savings_inr": 25000,
                "expected_return_pct": 10,
            },
        )
        assert calc.status_code == 401
