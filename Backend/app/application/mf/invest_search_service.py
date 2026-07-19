from __future__ import annotations

from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.catalog_governance_service import invest_visibility_sql_clause
from app.application.mf.invest_home_service import _serialize_fund_summary
from app.core.config import get_settings
from app.infrastructure.persistence.mf_models import (
    Category,
    FundAmc,
    FundCompositeRank,
    FundNavMetrics,
    MutualFund,
    Product,
    ProductCategory,
    ProductDisplayContent,
)


async def refresh_product_search_vectors(session: AsyncSession) -> int:
    await session.execute(
        text(
            """
            UPDATE products p
            SET invest_search_vector = to_tsvector(
                'simple',
                coalesce(p.name, '') || ' ' || coalesce(p.code, '') || ' ' ||
                coalesce(mf.scheme_name, '') || ' ' || coalesce(mf.isin_growth, '') || ' ' ||
                coalesce(amc.name, '')
            )
            FROM mutual_funds mf
            JOIN fund_amcs amc ON amc.id = mf.amc_id
            WHERE mf.product_id = p.id
            """
        )
    )
    count = int(await session.scalar(select(func.count()).select_from(Product)) or 0)
    return count


async def search_invest_funds(
    session: AsyncSession,
    *,
    query: str,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    query = query.strip()
    if len(query) < 2:
        return {"items": [], "page": page, "page_size": page_size, "total": 0, "has_more": False, "query": query}

    page = max(page, 1)
    page_size = min(max(page_size, 1), 50)
    offset = (page - 1) * page_size
    ts_query = func.plainto_tsquery("simple", query)
    like_pattern = f"%{query}%"

    base = (
        select(
            Product,
            MutualFund,
            FundAmc,
            FundNavMetrics,
            FundCompositeRank.rank_position,
            Category.slug,
            ProductCategory.is_featured,
            ProductCategory.display_order,
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
            or_(
                Product.invest_search_vector.op("@@")(ts_query),
                Product.name.ilike(like_pattern),
                MutualFund.scheme_name.ilike(like_pattern),
                MutualFund.isin_growth.ilike(like_pattern),
                FundAmc.name.ilike(like_pattern),
            ),
        )
    )

    total = int(await session.scalar(select(func.count()).select_from(base.subquery())) or 0)
    rows = (
        await session.execute(
            base.order_by(FundCompositeRank.rank_position.asc().nullslast(), Product.name)
            .offset(offset)
            .limit(page_size)
        )
    ).all()

    settings = get_settings()
    items = [
        _serialize_fund_summary(
            product,
            fund,
            amc,
            metrics,
            rank_position,
            category,
            settings=settings,
            is_featured=is_featured,
            display_order=display_order,
            display_content=display_content,
        )
        for product, fund, amc, metrics, rank_position, category, is_featured, display_order, display_content in rows
    ]

    return {
        "query": query,
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "has_more": offset + len(items) < total,
    }
