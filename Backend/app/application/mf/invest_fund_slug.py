from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.amfi_nav_parser import slugify
from app.application.mf.catalog_governance_service import invest_visibility_sql_clause
from app.infrastructure.persistence.mf_models import MutualFund, Product, ProductDisplayContent


def fund_public_slug(*, name: str, seo_slug: str | None = None) -> str:
    return seo_slug or slugify(name)


async def resolve_invest_fund_product_id(session: AsyncSession, identifier: str) -> uuid.UUID | None:
    ref = identifier.strip()
    if not ref:
        return None

    try:
        product_id = uuid.UUID(ref)
    except ValueError:
        product_id = None
    else:
        exists = await session.scalar(
            select(Product.id)
            .join(MutualFund, MutualFund.product_id == Product.id)
            .where(Product.id == product_id, invest_visibility_sql_clause())
        )
        if exists:
            return product_id

    seo_match = await session.scalar(
        select(Product.id)
        .join(MutualFund, MutualFund.product_id == Product.id)
        .join(ProductDisplayContent, ProductDisplayContent.product_id == Product.id)
        .where(
            ProductDisplayContent.seo_slug == ref,
            invest_visibility_sql_clause(),
        )
    )
    if seo_match:
        return seo_match

    rows = (
        await session.execute(
            select(Product.id, Product.name, ProductDisplayContent.seo_slug)
            .join(MutualFund, MutualFund.product_id == Product.id)
            .outerjoin(ProductDisplayContent, ProductDisplayContent.product_id == Product.id)
            .where(invest_visibility_sql_clause())
        )
    ).all()
    for row_product_id, name, seo_slug in rows:
        if fund_public_slug(name=name, seo_slug=seo_slug) == ref:
            return row_product_id

    return None
