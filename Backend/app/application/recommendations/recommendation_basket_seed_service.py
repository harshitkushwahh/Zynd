from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.dev_admin_seed_service import DEV_ADMIN_EMAIL
from app.application.mf.catalog_governance_service import invest_visibility_sql_clause
from app.application.recommendations.basket_admin_service import (
    create_basket,
    list_baskets,
    publish_config,
    replace_basket_funds,
)
from app.application.recommendations.publish_readiness import get_publish_readiness
from app.infrastructure.persistence.mf_models import FundAmc, MutualFund, Product
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.recommendation_models import RecommendationConfig
from app.infrastructure.persistence.risk_profile_models import RiskTier

MIN_INVESTABLE_PER_BASKET = 5
DEFAULT_POOL_SIZE = 10

_DEV_BASKETS: tuple[tuple[RiskTier, str, str], ...] = (
    (RiskTier.conservative, "Steady Core", "steady-core"),
    (RiskTier.moderate, "Balanced Core", "balanced-core"),
    (RiskTier.growth, "Growth Core", "growth-core"),
    (RiskTier.aggressive, "Aggressive Core", "aggressive-core"),
    (RiskTier.secure, "Secure Core", "secure-core"),
)


async def _load_investable_product_ids(session: AsyncSession, *, limit: int) -> list[UUID]:
    stmt = (
        select(Product.id)
        .join(MutualFund, MutualFund.product_id == Product.id)
        .join(FundAmc, FundAmc.id == MutualFund.amc_id)
        .where(invest_visibility_sql_clause())
        .order_by(Product.name)
        .limit(limit)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def ensure_recommendation_baskets_seed(session: AsyncSession) -> dict[str, Any]:
    admin = await session.scalar(select(User).where(User.email == DEV_ADMIN_EMAIL))
    if admin is None:
        raise RuntimeError(
            f"Dev admin ({DEV_ADMIN_EMAIL}) not found. Run: python -m app.jobs.run_dev_admin_seed"
        )

    config = await session.get(RecommendationConfig, 1)
    if config is None:
        session.add(RecommendationConfig(id=1, published_version=0))
        await session.flush()

    catalog_ids = await _load_investable_product_ids(session, limit=24)
    if len(catalog_ids) < MIN_INVESTABLE_PER_BASKET:
        return {
            "skipped": True,
            "reason": "insufficient_investable_funds_in_catalog",
            "catalog_count": len(catalog_ids),
            "required": MIN_INVESTABLE_PER_BASKET,
        }

    pool_ids = catalog_ids[:DEFAULT_POOL_SIZE]
    created: list[dict[str, str]] = []
    skipped_tiers: list[str] = []

    for tier, name, slug in _DEV_BASKETS:
        existing = await list_baskets(session, tier=tier)
        ready = any(
            basket.get("is_active")
            and int(basket.get("investable_fund_count") or 0) >= MIN_INVESTABLE_PER_BASKET
            for basket in existing
        )
        if ready:
            skipped_tiers.append(tier.value)
            continue

        basket = await create_basket(
            session,
            admin_user_id=admin.id,
            tier=tier,
            name=name,
            slug=slug,
        )
        await replace_basket_funds(
            session,
            UUID(basket["id"]),
            admin_user_id=admin.id,
            funds=[
                {"product_id": str(product_id), "sort_order": index}
                for index, product_id in enumerate(pool_ids)
            ],
        )
        created.append({"tier": tier.value, "basket_id": basket["id"], "name": name})

    published = False
    publish_version: int | None = None
    readiness = await get_publish_readiness(session)
    if readiness["can_publish"]:
        config_row = await session.get(RecommendationConfig, 1)
        should_publish = bool(created) or int(config_row.published_version or 0) == 0
        if should_publish:
            published_payload = await publish_config(session, admin_user_id=admin.id)
            published = True
            publish_version = int(published_payload["published_version"])

    return {
        "skipped": False,
        "catalog_count": len(catalog_ids),
        "created_baskets": created,
        "skipped_tiers_with_existing_ready_baskets": skipped_tiers,
        "published": published,
        "published_version": publish_version,
        "can_publish": readiness["can_publish"],
    }
