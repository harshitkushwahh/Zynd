from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.catalog_governance_service import invest_visibility_sql_clause
from app.application.mf.invest_home_service import _serialize_fund_summary
from app.application.mf.invest_nfo_mappers import serialize_nfo_block
from app.core.config import get_settings
from app.infrastructure.persistence.mf_models import (
    FundAmc,
    FundNavMetrics,
    MutualFund,
    NfoOffer,
    NfoOfferStatus,
    Product,
    ProductDisplayContent,
)

STATUS_FILTERS = {
    "open": NfoOfferStatus.open,
    "upcoming": NfoOfferStatus.upcoming,
    "closed": NfoOfferStatus.closed,
    "recently_allotted": NfoOfferStatus.allotted,
    "allotted": NfoOfferStatus.allotted,
}


def attach_nfo(payload: dict, offer: NfoOffer | None) -> dict:
    block = serialize_nfo_block(offer)
    if block is not None:
        payload["nfo"] = block
    return payload


async def load_nfo_by_product_ids(
    session: AsyncSession,
    product_ids: list[uuid.UUID],
) -> dict[uuid.UUID, NfoOffer]:
    if not product_ids:
        return {}
    rows = (
        await session.execute(
            select(NfoOffer).where(
                NfoOffer.product_id.in_(product_ids),
                NfoOffer.is_hidden.is_(False),
            )
        )
    ).scalars()
    return {row.product_id: row for row in rows}


async def list_invest_nfo(
    session: AsyncSession,
    *,
    status: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    settings = get_settings()
    stmt = (
        select(Product, MutualFund, FundAmc, FundNavMetrics, NfoOffer, ProductDisplayContent)
        .join(MutualFund, MutualFund.product_id == Product.id)
        .join(FundAmc, FundAmc.id == MutualFund.amc_id)
        .join(NfoOffer, NfoOffer.product_id == Product.id)
        .outerjoin(FundNavMetrics, FundNavMetrics.fund_id == MutualFund.id)
        .outerjoin(ProductDisplayContent, ProductDisplayContent.product_id == Product.id)
        .where(invest_visibility_sql_clause(), NfoOffer.is_hidden.is_(False))
    )
    if status:
        mapped = STATUS_FILTERS.get(status.lower())
        if mapped is None:
            raise ValueError("invalid_nfo_status")
        stmt = stmt.where(NfoOffer.status == mapped)
    else:
        stmt = stmt.where(
            NfoOffer.status.in_(
                (NfoOfferStatus.open, NfoOfferStatus.upcoming, NfoOfferStatus.closed)
            )
        )

    rows = list((await session.execute(stmt.order_by(NfoOffer.is_featured.desc(), Product.name))).all())
    total = len(rows)
    offset = (page - 1) * page_size
    page_rows = rows[offset : offset + page_size]
    items = [
        attach_nfo(
            _serialize_fund_summary(
                product,
                fund,
                amc,
                metrics,
                None,
                "nfo",
                settings=settings,
                is_featured=offer.is_featured,
                display_content=display_content,
            ),
            offer,
        )
        for product, fund, amc, metrics, offer, display_content in page_rows
    ]
    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "has_more": offset + page_size < total,
    }


async def get_invest_nfo_detail(session: AsyncSession, product_id: uuid.UUID) -> dict | None:
    from app.application.mf.invest_home_service import get_invest_fund_detail

    payload = await get_invest_fund_detail(session, product_id)
    if not payload:
        return None
    offer = await session.scalar(select(NfoOffer).where(NfoOffer.product_id == product_id))
    return attach_nfo(payload, offer)


async def list_featured_nfo(session: AsyncSession, *, limit: int = 6) -> list[dict]:
    payload = await list_invest_nfo(session, status="open", page=1, page_size=limit)
    featured = [item for item in payload["items"] if item.get("nfo", {}).get("is_featured")]
    return featured or payload["items"][:limit]
