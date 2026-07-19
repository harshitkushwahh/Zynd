from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.catalog_governance_service import invest_visibility_sql_clause
from app.infrastructure.persistence.mf_models import FundAmc, MutualFund, Product, SchemeNav


async def resolve_fund_by_product_id(
    session: AsyncSession,
    product_id: uuid.UUID,
) -> tuple[Product, MutualFund, FundAmc] | None:
    row = (
        await session.execute(
            select(Product, MutualFund, FundAmc)
            .join(MutualFund, MutualFund.product_id == Product.id)
            .join(FundAmc, FundAmc.id == MutualFund.amc_id)
            .where(Product.id == product_id, invest_visibility_sql_clause())
        )
    ).first()
    if not row:
        return None
    return row[0], row[1], row[2]


async def load_fund_nav_history(
    session: AsyncSession,
    *,
    fund_id: int,
    from_date: date | None = None,
    to_date: date | None = None,
) -> list[tuple[date, Decimal]]:
    query = (
        select(SchemeNav.nav_date, SchemeNav.nav_value)
        .where(SchemeNav.fund_id == fund_id)
        .order_by(SchemeNav.nav_date)
    )
    if from_date is not None:
        query = query.where(SchemeNav.nav_date >= from_date)
    if to_date is not None:
        query = query.where(SchemeNav.nav_date <= to_date)

    rows = (await session.execute(query)).all()
    return [(nav_date, Decimal(str(nav_value))) for nav_date, nav_value in rows]
