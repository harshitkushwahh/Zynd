"""Tests for recommendation publish readiness."""

from __future__ import annotations

from uuid import UUID, uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.recommendations.basket_admin_service import create_basket, publish_config, replace_basket_funds
from app.application.recommendations.errors import RecommendationError
from app.application.recommendations.publish_readiness import get_publish_readiness
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.risk_profile_models import RiskTier
from tests.test_funds_for_you_service import _create_investable_fund, _seed_eligible_user


async def _admin_user(db_session: AsyncSession) -> User:
    user = User(
        id=uuid4(),
        email=f"admin-{uuid4()}@example.com",
        phone=f"+9197{uuid4().int % 10_000_000_000:010d}"[-12:],
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.mark.asyncio
async def test_publish_readiness_blocks_without_baskets(db_session: AsyncSession) -> None:
    readiness = await get_publish_readiness(db_session)

    assert readiness["can_publish"] is False
    assert any(issue["code"] == "no_active_baskets" for issue in readiness["issues"])


@pytest.mark.asyncio
async def test_publish_readiness_blocks_short_pool(db_session: AsyncSession) -> None:
    admin = await _admin_user(db_session)
    basket = await create_basket(
        db_session,
        admin_user_id=admin.id,
        tier=RiskTier.moderate,
        name="Short Pool",
    )
    product, _, _ = await _create_investable_fund(db_session, label="solo")
    await replace_basket_funds(
        db_session,
        basket_id=UUID(basket["id"]),
        admin_user_id=admin.id,
        funds=[{"product_id": str(product.id), "sort_order": 0}],
    )

    readiness = await get_publish_readiness(db_session)

    assert readiness["can_publish"] is False
    assert any(issue["code"] == "short_pool" for issue in readiness["issues"])


@pytest.mark.asyncio
async def test_publish_config_rejects_when_not_ready(db_session: AsyncSession) -> None:
    admin = await _admin_user(db_session)

    with pytest.raises(RecommendationError) as exc_info:
        await publish_config(db_session, admin_user_id=admin.id)

    assert exc_info.value.code == "publish_blocked"


@pytest.mark.asyncio
async def test_publish_readiness_allows_ready_basket(db_session: AsyncSession) -> None:
    admin = await _admin_user(db_session)
    basket = await create_basket(
        db_session,
        admin_user_id=admin.id,
        tier=RiskTier.moderate,
        name="Ready Basket",
    )
    funds = []
    for index in range(5):
        product, _, _ = await _create_investable_fund(db_session, label=f"fund-{index}")
        funds.append({"product_id": str(product.id), "sort_order": index})
    await replace_basket_funds(
        db_session,
        basket_id=UUID(basket["id"]),
        admin_user_id=admin.id,
        funds=funds,
    )

    readiness = await get_publish_readiness(db_session)

    assert readiness["can_publish"] is True
    assert readiness["issues"] == []
    published = await publish_config(db_session, admin_user_id=admin.id)
    assert published["published_version"] == 1
