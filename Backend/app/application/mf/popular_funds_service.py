from __future__ import annotations

import math
import uuid
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.catalog_display_service import product_category_effective_clause
from app.application.mf.catalog_governance_service import invest_visibility_sql_clause
from app.application.mf.collection_return_score import has_minimum_return_history, weighted_return_score
from app.core.config import get_settings
from app.infrastructure.persistence.mf_models import (
    Category,
    CategoryKind,
    FundAmc,
    FundCompositeRank,
    FundNavMetrics,
    MutualFund,
    Product,
    ProductCategory,
    ProductDisplayContent,
    SchemeAum,
)

DEFAULT_POPULAR_LIMIT = 5


@dataclass
class _PopularCandidate:
    product: Product
    fund: MutualFund
    amc: FundAmc
    metrics: FundNavMetrics | None
    category_slug: str | None
    display_content: ProductDisplayContent | None = None
    best_rank: int | None = None
    is_featured: bool = False
    latest_aum_inr: Decimal | None = None


def compute_popularity_score(
    metrics: FundNavMetrics | None,
    *,
    latest_aum_inr: Decimal | None,
    best_rank: int | None,
    is_featured: bool,
) -> Decimal | None:
    return_score = weighted_return_score(metrics)
    if return_score is None or not has_minimum_return_history(metrics):
        return None

    score = return_score
    if latest_aum_inr is not None and latest_aum_inr > 0:
        aum_boost = min(math.log10(float(latest_aum_inr) / 1e7), 1.5)
        score += Decimal(str(round(aum_boost, 4)))
    if best_rank is not None and best_rank <= 20:
        score += Decimal(str(round((21 - best_rank) * 0.05, 4)))
    if is_featured:
        score += Decimal("0.5")
    return score


async def _load_latest_aum_map(session: AsyncSession, fund_ids: list[int]) -> dict[int, Decimal]:
    if not fund_ids:
        return {}

    rows = (
        await session.execute(
            select(SchemeAum.fund_id, SchemeAum.aum_inr, SchemeAum.as_of_date)
            .where(SchemeAum.fund_id.in_(fund_ids))
            .order_by(SchemeAum.fund_id, SchemeAum.as_of_date.desc())
        )
    ).all()

    latest: dict[int, Decimal] = {}
    for fund_id, aum_inr, _as_of in rows:
        if fund_id not in latest:
            latest[fund_id] = Decimal(str(aum_inr))
    return latest


async def list_popular_invest_funds(
    session: AsyncSession,
    *,
    limit: int = DEFAULT_POPULAR_LIMIT,
) -> list[dict]:
    from app.application.mf.invest_home_service import _serialize_fund_summary

    settings = get_settings()
    limit = min(max(limit, 1), 24)

    rows = (
        await session.execute(
            select(
                Product,
                MutualFund,
                FundAmc,
                FundNavMetrics,
                FundCompositeRank.rank_position,
                Category.slug,
                ProductCategory.is_featured,
                ProductDisplayContent,
            )
            .join(MutualFund, MutualFund.product_id == Product.id)
            .join(FundAmc, FundAmc.id == MutualFund.amc_id)
            .outerjoin(FundNavMetrics, FundNavMetrics.fund_id == MutualFund.id)
            .outerjoin(ProductCategory, ProductCategory.product_id == Product.id)
            .outerjoin(Category, Category.id == ProductCategory.category_id)
            .outerjoin(
                FundCompositeRank,
                (FundCompositeRank.fund_id == MutualFund.id)
                & (FundCompositeRank.category_id == ProductCategory.category_id),
            )
            .outerjoin(ProductDisplayContent, ProductDisplayContent.product_id == Product.id)
            .where(
                invest_visibility_sql_clause(),
                Category.category_kind == CategoryKind.browse,
                Category.is_visible.is_(True),
                product_category_effective_clause(),
            )
        )
    ).all()

    candidates: dict[uuid.UUID, _PopularCandidate] = {}
    for product, fund, amc, metrics, rank_position, category_slug, is_featured, display_content in rows:
        entry = candidates.get(product.id)
        if entry is None:
            candidates[product.id] = _PopularCandidate(
                product=product,
                fund=fund,
                amc=amc,
                metrics=metrics,
                category_slug=category_slug,
                display_content=display_content,
                best_rank=rank_position,
                is_featured=bool(is_featured),
            )
            continue

        if rank_position is not None:
            if entry.best_rank is None or rank_position < entry.best_rank:
                entry.best_rank = rank_position
        if is_featured:
            entry.is_featured = True
        if entry.category_slug is None and category_slug:
            entry.category_slug = category_slug
        if entry.display_content is None and display_content is not None:
            entry.display_content = display_content

    fund_ids = [entry.fund.id for entry in candidates.values()]
    aum_map = await _load_latest_aum_map(session, fund_ids)

    scored: list[tuple[Decimal, _PopularCandidate]] = []
    for entry in candidates.values():
        score = compute_popularity_score(
            entry.metrics,
            latest_aum_inr=aum_map.get(entry.fund.id),
            best_rank=entry.best_rank,
            is_featured=entry.is_featured,
        )
        if score is not None:
            scored.append((score, entry))

    scored.sort(key=lambda item: item[0], reverse=True)

    return [
        _serialize_fund_summary(
            entry.product,
            entry.fund,
            entry.amc,
            entry.metrics,
            entry.best_rank,
            entry.category_slug,
            settings=settings,
            is_featured=entry.is_featured,
            display_content=entry.display_content,
        )
        for _score, entry in scored[:limit]
    ]
