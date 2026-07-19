from __future__ import annotations

import uuid
from datetime import datetime
from uuid import UUID

from sqlalchemy import case, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.audit_service import write_audit
from app.application.mf.catalog_admin_service import _decimal
from app.application.mf.invest_catalog_invalidation import notify_invest_catalog_changed
from app.application.mf.public_asset_service import resolve_amc_logo_url
from app.core.config import get_settings
from app.infrastructure.persistence.mf_models import (
    Category,
    FundAmc,
    FundCompositeRank,
    FundNavMetrics,
    MutualFund,
    Product,
    ProductCategory,
    ProductLifecycleStatus,
)
from app.infrastructure.persistence.models import AuditEventType


def _category_snapshot(category: Category) -> dict:
    return {
        "id": category.id,
        "slug": category.slug,
        "name": category.name,
        "display_order": category.display_order,
        "is_visible": category.is_visible,
        "min_funds_to_show": category.min_funds_to_show,
    }


async def _get_category_by_id(session: AsyncSession, category_id: int) -> Category | None:
    return await session.get(Category, category_id)


async def _get_category_by_slug(session: AsyncSession, slug: str) -> Category | None:
    return await session.scalar(select(Category).where(Category.slug == slug))


async def get_category_admin(session: AsyncSession, category_id: int) -> dict | None:
    category = await _get_category_by_id(session, category_id)
    if not category:
        return None

    counts = (
        await session.execute(
            select(
                func.count(Product.id),
                func.sum(
                    case(
                        (Product.lifecycle_status == ProductLifecycleStatus.active, 1),
                        else_=0,
                    )
                ),
            )
            .select_from(ProductCategory)
            .join(Product, Product.id == ProductCategory.product_id)
            .where(ProductCategory.category_id == category.id)
        )
    ).one()

    fund_count, active_count = counts
    return {
        **_category_snapshot(category),
        "fund_count": int(fund_count or 0),
        "active_fund_count": int(active_count or 0),
    }


async def update_category_admin(
    session: AsyncSession,
    category_id: int,
    *,
    admin_user_id: UUID,
    name: str | None = None,
    is_visible: bool | None = None,
    display_order: int | None = None,
    min_funds_to_show: int | None = None,
) -> dict | None:
    category = await _get_category_by_id(session, category_id)
    if not category:
        return None

    before = _category_snapshot(category)
    if name is not None:
        category.name = name.strip()
    if is_visible is not None:
        category.is_visible = is_visible
    if display_order is not None:
        category.display_order = display_order
    if min_funds_to_show is not None:
        category.min_funds_to_show = max(min_funds_to_show, 0)

    after = _category_snapshot(category)
    await write_audit(
        session,
        event_type=AuditEventType.mf_category_catalog_updated,
        user_id=admin_user_id,
        metadata={"action": "update_category", "before": before, "after": after},
    )
    await notify_invest_catalog_changed(session)
    return await get_category_admin(session, category_id)


def _serialize_category_fund_row(
    *,
    product: Product,
    fund: MutualFund,
    amc: FundAmc,
    link: ProductCategory,
    rank_position: int | None,
    return_3y,
    settings,
) -> dict:
    return {
        "product_id": str(product.id),
        "fund_id": fund.id,
        "scheme_name": fund.scheme_name,
        "isin": fund.isin_growth,
        "amc_id": amc.id,
        "amc_name": amc.name,
        "lifecycle_status": product.lifecycle_status.value,
        "display_order": link.display_order,
        "is_featured": link.is_featured,
        "featured_rank": link.featured_rank,
        "effective_from": link.effective_from.isoformat() if link.effective_from else None,
        "effective_until": link.effective_until.isoformat() if link.effective_until else None,
        "return_3y": _decimal(return_3y),
        "rank_position": rank_position,
        "amc_logo_url": resolve_amc_logo_url(amc.logo_url, amc.slug, settings),
    }


async def list_category_funds_admin(session: AsyncSession, category_slug: str) -> dict | None:
    category = await _get_category_by_slug(session, category_slug)
    if not category:
        return None

    settings = get_settings()
    rows = (
        await session.execute(
            select(Product, MutualFund, FundAmc, ProductCategory, FundNavMetrics.return_3y, FundCompositeRank.rank_position)
            .join(ProductCategory, ProductCategory.product_id == Product.id)
            .join(MutualFund, MutualFund.product_id == Product.id)
            .join(FundAmc, FundAmc.id == MutualFund.amc_id)
            .outerjoin(FundNavMetrics, FundNavMetrics.fund_id == MutualFund.id)
            .outerjoin(
                FundCompositeRank,
                (FundCompositeRank.fund_id == MutualFund.id)
                & (FundCompositeRank.category_id == ProductCategory.category_id),
            )
            .where(ProductCategory.category_id == category.id)
            .order_by(
                ProductCategory.is_featured.desc(),
                ProductCategory.featured_rank.asc().nulls_last(),
                ProductCategory.display_order.asc().nulls_last(),
                MutualFund.scheme_name.asc(),
            )
        )
    ).all()

    return {
        "category": _category_snapshot(category),
        "items": [
            _serialize_category_fund_row(
                product=product,
                fund=fund,
                amc=amc,
                link=link,
                rank_position=rank_position,
                return_3y=return_3y,
                settings=settings,
            )
            for product, fund, amc, link, return_3y, rank_position in rows
        ],
    }


async def set_category_fund_order(
    session: AsyncSession,
    category_slug: str,
    *,
    admin_user_id: UUID,
    items: list[dict],
) -> dict | None:
    category = await _get_category_by_slug(session, category_slug)
    if not category:
        return None

    before_items = (await list_category_funds_admin(session, category_slug))["items"]

    for entry in items:
        product_id = uuid.UUID(str(entry["product_id"]))
        link = await session.scalar(
            select(ProductCategory).where(
                ProductCategory.category_id == category.id,
                ProductCategory.product_id == product_id,
            )
        )
        if not link:
            continue
        link.display_order = entry.get("display_order")
        link.is_featured = bool(entry.get("is_featured", False))
        link.featured_rank = entry.get("featured_rank")
        if entry.get("effective_from"):
            link.effective_from = datetime.fromisoformat(str(entry["effective_from"]))
        elif "effective_from" in entry:
            link.effective_from = None
        if entry.get("effective_until"):
            link.effective_until = datetime.fromisoformat(str(entry["effective_until"]))
        elif "effective_until" in entry:
            link.effective_until = None

    after_payload = await list_category_funds_admin(session, category_slug)
    await write_audit(
        session,
        event_type=AuditEventType.mf_category_catalog_updated,
        user_id=admin_user_id,
        metadata={
            "action": "set_category_order",
            "category_slug": category_slug,
            "before_count": len(before_items),
            "after_count": len(after_payload["items"]) if after_payload else 0,
            "items_updated": len(items),
        },
    )
    await notify_invest_catalog_changed(session)
    return after_payload


async def add_fund_to_category(
    session: AsyncSession,
    category_slug: str,
    *,
    admin_user_id: UUID,
    product_id: uuid.UUID,
    display_order: int | None = None,
    is_featured: bool = False,
    featured_rank: int | None = None,
) -> dict | None:
    category = await _get_category_by_slug(session, category_slug)
    if not category:
        return None

    product = await session.get(Product, product_id)
    if not product:
        raise ValueError("Product not found")

    existing = await session.scalar(
        select(ProductCategory).where(
            ProductCategory.category_id == category.id,
            ProductCategory.product_id == product_id,
        )
    )
    if existing:
        raise ValueError("Fund already in category")

    if display_order is None:
        max_order = await session.scalar(
            select(func.max(ProductCategory.display_order)).where(
                ProductCategory.category_id == category.id
            )
        )
        display_order = int(max_order or 0) + 10

    link = ProductCategory(
        category_id=category.id,
        product_id=product_id,
        display_order=display_order,
        is_featured=is_featured,
        featured_rank=featured_rank,
    )
    session.add(link)
    await session.flush()

    await write_audit(
        session,
        event_type=AuditEventType.mf_category_catalog_updated,
        user_id=admin_user_id,
        metadata={
            "action": "add_fund",
            "category_slug": category_slug,
            "product_id": str(product_id),
            "display_order": display_order,
        },
    )
    await notify_invest_catalog_changed(session)
    return await list_category_funds_admin(session, category_slug)


async def remove_fund_from_category(
    session: AsyncSession,
    category_slug: str,
    *,
    admin_user_id: UUID,
    product_id: uuid.UUID,
) -> dict | None:
    category = await _get_category_by_slug(session, category_slug)
    if not category:
        return None

    await session.execute(
        delete(ProductCategory).where(
            ProductCategory.category_id == category.id,
            ProductCategory.product_id == product_id,
        )
    )

    await write_audit(
        session,
        event_type=AuditEventType.mf_category_catalog_updated,
        user_id=admin_user_id,
        metadata={
            "action": "remove_fund",
            "category_slug": category_slug,
            "product_id": str(product_id),
        },
    )
    await notify_invest_catalog_changed(session)
    return await list_category_funds_admin(session, category_slug)


async def bulk_add_amc_funds_to_category(
    session: AsyncSession,
    category_slug: str,
    *,
    admin_user_id: UUID,
    amc_id: int,
) -> dict | None:
    category = await _get_category_by_slug(session, category_slug)
    if not category:
        return None

    rows = (
        await session.execute(
            select(MutualFund, Product)
            .join(Product, Product.id == MutualFund.product_id)
            .where(
                MutualFund.amc_id == amc_id,
                MutualFund.product_id.is_not(None),
            )
            .order_by(MutualFund.scheme_name)
        )
    ).all()

    existing_product_ids = set(
        (
            await session.scalars(
                select(ProductCategory.product_id).where(ProductCategory.category_id == category.id)
            )
        ).all()
    )

    max_order = int(
        await session.scalar(
            select(func.max(ProductCategory.display_order)).where(
                ProductCategory.category_id == category.id
            )
        )
        or 0
    )
    added = 0
    for fund, product in rows:
        if product.id in existing_product_ids:
            continue
        max_order += 10
        session.add(
            ProductCategory(
                category_id=category.id,
                product_id=product.id,
                display_order=max_order,
            )
        )
        existing_product_ids.add(product.id)
        added += 1

    await write_audit(
        session,
        event_type=AuditEventType.mf_category_catalog_updated,
        user_id=admin_user_id,
        metadata={
            "action": "bulk_add_amc",
            "category_slug": category_slug,
            "amc_id": amc_id,
            "added": added,
        },
    )
    if added:
        await notify_invest_catalog_changed(session)
    return {
        "added": added,
        "category": await list_category_funds_admin(session, category_slug),
    }
