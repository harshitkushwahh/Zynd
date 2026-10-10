from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.category_mapping import scheme_category_for_nfo
from app.application.mf.invest_catalog_invalidation import notify_invest_catalog_changed
from app.infrastructure.persistence.mf_models import (
    FundAmc,
    MutualFund,
    NfoOffer,
    NfoOfferStatus,
    Product,
)

VALID_STATUSES = {item.value for item in NfoOfferStatus}


def _serialize_admin_offer(
    offer: NfoOffer,
    *,
    product: Product,
    fund: MutualFund,
    amc: FundAmc,
) -> dict:
    return {
        "id": str(offer.id),
        "product_id": str(offer.product_id),
        "mutual_fund_id": offer.mutual_fund_id,
        "fund_name": product.name,
        "scheme_name": fund.scheme_name,
        "amc_name": amc.name,
        "status": offer.status.value,
        "subscription_open_date": offer.subscription_open_date.isoformat() if offer.subscription_open_date else None,
        "subscription_close_date": offer.subscription_close_date.isoformat() if offer.subscription_close_date else None,
        "allotment_date": offer.allotment_date.isoformat() if offer.allotment_date else None,
        "is_featured": offer.is_featured,
        "is_hidden": offer.is_hidden,
        "marketing_headline": offer.marketing_headline,
        "marketing_body": offer.marketing_body,
        "source": offer.source,
        "admin_override": offer.admin_override,
        "purchase_allowed": fund.fp_oms_purchase_allowed,
        "updated_at": offer.updated_at.isoformat() if offer.updated_at else None,
        **scheme_category_for_nfo(fund.sebi_category),
    }


async def list_nfo_offers_admin(session: AsyncSession) -> dict:
    rows = (
        await session.execute(
            select(NfoOffer, Product, MutualFund, FundAmc)
            .join(Product, Product.id == NfoOffer.product_id)
            .join(MutualFund, MutualFund.id == NfoOffer.mutual_fund_id)
            .join(FundAmc, FundAmc.id == MutualFund.amc_id)
            .order_by(NfoOffer.status, Product.name)
        )
    ).all()
    items = [
        _serialize_admin_offer(offer, product=product, fund=fund, amc=amc)
        for offer, product, fund, amc in rows
    ]
    counts = {status.value: 0 for status in NfoOfferStatus}
    featured = 0
    hidden = 0
    stale_oms = 0
    for item in items:
        counts[item["status"]] = counts.get(item["status"], 0) + 1
        if item["is_featured"]:
            featured += 1
        if item["is_hidden"]:
            hidden += 1
        if item["status"] == NfoOfferStatus.open.value and not item["purchase_allowed"]:
            stale_oms += 1
    return {
        "items": items,
        "counts": {
            **counts,
            "total": len(items),
            "featured": featured,
            "hidden": hidden,
            "stale_oms": stale_oms,
        },
    }


async def list_nfo_category_breakdown(session: AsyncSession) -> dict:
    payload = await list_nfo_offers_admin(session)
    groups_by_key: dict[str, dict] = {}
    unclassified = 0
    for item in payload["items"]:
        slug = item.get("scheme_category_slug")
        name = item.get("scheme_category_name") or "Unclassified"
        key = slug or "unclassified"
        if slug is None:
            unclassified += 1
        group = groups_by_key.get(key)
        if group is None:
            group = {"slug": slug, "name": name, "count": 0, "items": []}
            groups_by_key[key] = group
        group["items"].append(item)
        group["count"] += 1
    groups = sorted(groups_by_key.values(), key=lambda row: (row["slug"] is None, row["name"]))
    return {
        "groups": groups,
        "counts": {
            "total": payload["counts"]["total"],
            "classified": payload["counts"]["total"] - unclassified,
            "unclassified": unclassified,
            "categories": sum(1 for group in groups if group["slug"]),
            "featured": payload["counts"]["featured"],
        },
    }


async def update_nfo_offer_admin(
    session: AsyncSession,
    product_id: uuid.UUID,
    *,
    status: str | None = None,
    subscription_open_date: date | None = None,
    subscription_close_date: date | None = None,
    allotment_date: date | None = None,
    is_featured: bool | None = None,
    is_hidden: bool | None = None,
    marketing_headline: str | None = None,
    marketing_body: str | None = None,
    admin_override: bool | None = None,
) -> dict:
    row = (
        await session.execute(
            select(NfoOffer, Product, MutualFund, FundAmc)
            .join(Product, Product.id == NfoOffer.product_id)
            .join(MutualFund, MutualFund.id == NfoOffer.mutual_fund_id)
            .join(FundAmc, FundAmc.id == MutualFund.amc_id)
            .where(NfoOffer.product_id == product_id)
        )
    ).first()
    if row is None:
        raise LookupError("nfo_not_found")
    offer, product, fund, amc = row
    if status is not None:
        if status not in VALID_STATUSES:
            raise ValueError("invalid_nfo_status")
        offer.status = NfoOfferStatus(status)
    if subscription_open_date is not None:
        offer.subscription_open_date = subscription_open_date
    if subscription_close_date is not None:
        offer.subscription_close_date = subscription_close_date
    if allotment_date is not None:
        offer.allotment_date = allotment_date
    if is_featured is not None:
        offer.is_featured = is_featured
    if is_hidden is not None:
        offer.is_hidden = is_hidden
    if marketing_headline is not None:
        offer.marketing_headline = marketing_headline
    if marketing_body is not None:
        offer.marketing_body = marketing_body
    if admin_override is not None:
        offer.admin_override = admin_override
    else:
        offer.admin_override = True
    offer.source = "ADMIN"
    await notify_invest_catalog_changed(session, refresh_search_vectors=False)
    return _serialize_admin_offer(offer, product=product, fund=fund, amc=amc)
