from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.recommendations.funds_for_you_service import (
    FUNDS_FOR_YOU_COUNT,
    count_investable_basket_funds,
    get_published_version,
)
from app.infrastructure.persistence.recommendation_models import RecommendationBasket
from app.infrastructure.persistence.risk_profile_models import RiskTier

MIN_PUBLISHABLE_POOL_FUNDS = FUNDS_FOR_YOU_COUNT


async def get_publish_readiness(session: AsyncSession) -> dict[str, Any]:
    result = await session.execute(
        select(RecommendationBasket)
        .where(RecommendationBasket.is_active.is_(True))
        .order_by(RecommendationBasket.tier, RecommendationBasket.sort_order, RecommendationBasket.created_at)
    )
    active_baskets = list(result.scalars().all())

    issues: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    tier_summaries: list[dict[str, Any]] = []

    if not active_baskets:
        issues.append(
            {
                "code": "no_active_baskets",
                "message": "At least one active basket is required before publishing.",
            }
        )

    baskets_by_tier: dict[RiskTier, list[RecommendationBasket]] = {tier: [] for tier in RiskTier}
    for basket in active_baskets:
        baskets_by_tier[basket.tier].append(basket)

    for tier in RiskTier:
        tier_baskets = baskets_by_tier[tier]
        short_baskets: list[dict[str, Any]] = []
        ready_basket_count = 0

        for basket in tier_baskets:
            investable_count = await count_investable_basket_funds(session, basket.id)
            if investable_count < MIN_PUBLISHABLE_POOL_FUNDS:
                short_baskets.append(
                    {
                        "basket_id": str(basket.id),
                        "basket_name": basket.name,
                        "investable_fund_count": investable_count,
                        "required_fund_count": MIN_PUBLISHABLE_POOL_FUNDS,
                    }
                )
                issues.append(
                    {
                        "code": "short_pool",
                        "tier": tier.value,
                        "basket_id": str(basket.id),
                        "basket_name": basket.name,
                        "investable_fund_count": investable_count,
                        "required_fund_count": MIN_PUBLISHABLE_POOL_FUNDS,
                        "message": (
                            f"{basket.name} ({tier.value}) has {investable_count} investable funds; "
                            f"at least {MIN_PUBLISHABLE_POOL_FUNDS} are required."
                        ),
                    }
                )
            else:
                ready_basket_count += 1

        if not tier_baskets:
            warnings.append(
                {
                    "code": "tier_without_baskets",
                    "tier": tier.value,
                    "message": f"No active baskets configured for {tier.value} tier.",
                }
            )

        tier_summaries.append(
            {
                "tier": tier.value,
                "active_basket_count": len(tier_baskets),
                "ready_basket_count": ready_basket_count,
                "short_baskets": short_baskets,
            }
        )

    return {
        "can_publish": len(issues) == 0,
        "published_version": await get_published_version(session),
        "required_fund_count": MIN_PUBLISHABLE_POOL_FUNDS,
        "tiers": tier_summaries,
        "issues": issues,
        "warnings": warnings,
    }
