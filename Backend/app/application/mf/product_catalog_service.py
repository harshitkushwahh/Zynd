from __future__ import annotations

import logging
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.category_mapping import category_slug_for_sebi, should_exclude_from_catalog
from app.infrastructure.persistence.mf_models import (
    Category,
    MutualFund,
    Product,
    ProductCategory,
    ProductLifecycleStatus,
    ProductType,
)

logger = logging.getLogger(__name__)


async def _next_product_code(session: AsyncSession) -> str:
    count = await session.scalar(select(func.count()).select_from(Product)) or 0
    return f"PRD{count + 1:06d}"


async def ensure_product_for_fund(session: AsyncSession, fund: MutualFund, *, amc_name: str) -> Product | None:
    if fund.product_id:
        product = await session.get(Product, fund.product_id)
        return product

    if should_exclude_from_catalog(scheme_name=fund.scheme_name, plan_type=fund.plan_type):
        return None

    product = Product(
        id=uuid.uuid4(),
        code=await _next_product_code(session),
        name=fund.scheme_name,
        short_description=f"Mutual Fund - {fund.scheme_name}",
        provider=amc_name,
        product_type=ProductType.mutual_fund,
        lifecycle_status=ProductLifecycleStatus.draft,
    )
    session.add(product)
    await session.flush()
    fund.product_id = product.id

    slug = category_slug_for_sebi(fund.sebi_category)
    category = await session.scalar(select(Category).where(Category.slug == slug))
    if category:
        session.add(ProductCategory(product_id=product.id, category_id=category.id))

    return product
