from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import and_, or_

from app.infrastructure.persistence.mf_models import ProductCategory


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def product_category_effective_clause(now: datetime | None = None):
    moment = now or utc_now()
    return and_(
        or_(ProductCategory.effective_from.is_(None), ProductCategory.effective_from <= moment),
        or_(ProductCategory.effective_until.is_(None), ProductCategory.effective_until > moment),
    )


def curated_fund_order_columns():
    """Order: featured → featured_rank → display_order → composite rank → name."""
    from app.infrastructure.persistence.mf_models import FundCompositeRank, Product

    return [
        ProductCategory.is_featured.desc(),
        ProductCategory.featured_rank.asc().nulls_last(),
        ProductCategory.display_order.asc().nulls_last(),
        FundCompositeRank.rank_position.asc().nulls_last(),
        Product.name.asc(),
    ]
