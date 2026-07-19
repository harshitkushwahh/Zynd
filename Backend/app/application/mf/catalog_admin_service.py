from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import case, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.catalog_governance_service import (
    is_product_investable,
    is_product_visible,
)
from app.application.mf.catalog_health_service import FundHealthInput, compute_fund_health_flags
from app.application.mf.catalog_lifecycle_service import is_catalog_eligible
from app.application.mf.public_asset_service import resolve_amc_logo_url
from app.core.config import get_settings
from app.infrastructure.persistence.mf_models import (
    AdminInvestability,
    AdminVisibility,
    Category,
    FundAmc,
    FundCompositeRank,
    FundNavMetrics,
    MutualFund,
    Product,
    ProductCategory,
    ProductLifecycleStatus,
    SchemeNav,
)


def _decimal(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return float(value)


def _catalog_flags(
    *,
    product: Product | None,
    fund: MutualFund,
    amc: FundAmc,
) -> list[str]:
    flags: list[str] = []
    if not product:
        flags.append("no_product")
        return flags

    eligible = is_catalog_eligible(
        amc_active=amc.is_active,
        fund_active=fund.is_active,
        fp_oms_purchase_allowed=fund.fp_oms_purchase_allowed,
        fp_oms_active=fund.fp_oms_active,
    )

    if product.lifecycle_status == ProductLifecycleStatus.active:
        if not amc.is_active:
            flags.append("amc_not_empanelled")
        if fund.fp_oms_purchase_allowed is not True:
            flags.append("not_purchasable")
        if not fund.is_active:
            flags.append("fund_disabled")
    elif eligible:
        flags.append("eligible_not_active")

    if product.lifecycle_status == ProductLifecycleStatus.active and not eligible:
        flags.append("active_but_ineligible")

    if amc.admin_kill_switch:
        flags.append("amc_kill_switch")
    if product.admin_visibility == AdminVisibility.force_hide:
        flags.append("force_hidden")
    elif product.admin_visibility == AdminVisibility.force_show:
        flags.append("force_shown")
    if product.admin_investability == AdminInvestability.block_orders:
        flags.append("orders_blocked")

    if product and not is_product_visible(product=product, fund=fund, amc=amc):
        flags.append("not_visible")
    elif product and not is_product_investable(product=product, fund=fund, amc=amc):
        flags.append("not_investable")

    return flags


async def get_catalog_overview(session: AsyncSession) -> dict:
    total_funds = int(await session.scalar(select(func.count()).select_from(MutualFund)) or 0)
    total_products = int(await session.scalar(select(func.count()).select_from(Product)) or 0)
    active_products = int(
        await session.scalar(
            select(func.count())
            .select_from(Product)
            .where(Product.lifecycle_status == ProductLifecycleStatus.active)
        )
        or 0
    )
    empanelled_amcs = int(
        await session.scalar(
            select(func.count()).select_from(FundAmc).where(FundAmc.is_active.is_(True))
        )
        or 0
    )
    total_amcs = int(await session.scalar(select(func.count()).select_from(FundAmc)) or 0)
    total_categories = int(await session.scalar(select(func.count()).select_from(Category)) or 0)
    nav_rows = int(await session.scalar(select(func.count()).select_from(SchemeNav)) or 0)
    return {
        "total_funds": total_funds,
        "total_products": total_products,
        "active_products": active_products,
        "empanelled_amcs": empanelled_amcs,
        "total_amcs": total_amcs,
        "total_categories": total_categories,
        "nav_rows": nav_rows,
    }


async def list_categories_admin(session: AsyncSession) -> list[dict]:
    rows = (
        await session.execute(
            select(
                Category.id,
                Category.slug,
                Category.name,
                Category.display_order,
                Category.is_visible,
                Category.min_funds_to_show,
                func.count(Product.id),
                func.sum(
                    case(
                        (Product.lifecycle_status == ProductLifecycleStatus.active, 1),
                        else_=0,
                    )
                ),
            )
            .outerjoin(ProductCategory, ProductCategory.category_id == Category.id)
            .outerjoin(Product, Product.id == ProductCategory.product_id)
            .group_by(
                Category.id,
                Category.slug,
                Category.name,
                Category.display_order,
                Category.is_visible,
                Category.min_funds_to_show,
            )
            .order_by(Category.display_order, Category.name)
        )
    ).all()

    return [
        {
            "id": category_id,
            "slug": slug,
            "name": name,
            "display_order": display_order,
            "is_visible": is_visible,
            "min_funds_to_show": min_funds_to_show,
            "fund_count": int(fund_count or 0),
            "active_fund_count": int(active_count or 0),
        }
        for category_id, slug, name, display_order, is_visible, min_funds_to_show, fund_count, active_count in rows
    ]


def _fund_list_ids_query():
    return (
        select(MutualFund.id, MutualFund.scheme_name)
        .select_from(MutualFund)
        .outerjoin(Product, Product.id == MutualFund.product_id)
        .join(FundAmc, FundAmc.id == MutualFund.amc_id)
        .outerjoin(ProductCategory, ProductCategory.product_id == Product.id)
        .outerjoin(Category, Category.id == ProductCategory.category_id)
    )


def _apply_fund_list_filters(
    stmt,
    *,
    q: str | None = None,
    amc_id: int | None = None,
    category_slug: str | None = None,
    lifecycle_status: str | None = None,
    fund_active: bool | None = None,
    amc_empanelled: bool | None = None,
    purchasable: bool | None = None,
):
    if q:
        pattern = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                MutualFund.scheme_name.ilike(pattern),
                MutualFund.isin_growth.ilike(pattern),
                Product.name.ilike(pattern),
            )
        )
    if amc_id is not None:
        stmt = stmt.where(MutualFund.amc_id == amc_id)
    if category_slug:
        stmt = stmt.where(Category.slug == category_slug)
    if lifecycle_status:
        stmt = stmt.where(Product.lifecycle_status == lifecycle_status)
    if fund_active is not None:
        stmt = stmt.where(MutualFund.is_active.is_(fund_active))
    if amc_empanelled is not None:
        stmt = stmt.where(FundAmc.is_active.is_(amc_empanelled))
    if purchasable is not None:
        if purchasable:
            stmt = stmt.where(MutualFund.fp_oms_purchase_allowed.is_(True))
        else:
            stmt = stmt.where(
                or_(
                    MutualFund.fp_oms_purchase_allowed.is_(False),
                    MutualFund.fp_oms_purchase_allowed.is_(None),
                )
            )
    return stmt


def _fund_list_base_query():
    return (
        select(
            MutualFund,
            Product,
            FundAmc,
            Category.slug,
            Category.name,
            FundNavMetrics.return_3y,
            FundCompositeRank.rank_position,
        )
        .outerjoin(Product, Product.id == MutualFund.product_id)
        .join(FundAmc, FundAmc.id == MutualFund.amc_id)
        .outerjoin(ProductCategory, ProductCategory.product_id == Product.id)
        .outerjoin(Category, Category.id == ProductCategory.category_id)
        .outerjoin(FundNavMetrics, FundNavMetrics.fund_id == MutualFund.id)
        .outerjoin(
            FundCompositeRank,
            (FundCompositeRank.fund_id == MutualFund.id)
            & (FundCompositeRank.category_id == ProductCategory.category_id),
        )
    )


async def list_funds_admin(
    session: AsyncSession,
    *,
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    amc_id: int | None = None,
    category_slug: str | None = None,
    lifecycle_status: str | None = None,
    fund_active: bool | None = None,
    amc_empanelled: bool | None = None,
    purchasable: bool | None = None,
) -> dict:
    page = max(page, 1)
    page_size = min(max(page_size, 1), 200)
    offset = (page - 1) * page_size

    filter_kwargs = {
        "q": q,
        "amc_id": amc_id,
        "category_slug": category_slug,
        "lifecycle_status": lifecycle_status,
        "fund_active": fund_active,
        "amc_empanelled": amc_empanelled,
        "purchasable": purchasable,
    }

    grouped_ids = _apply_fund_list_filters(_fund_list_ids_query(), **filter_kwargs).group_by(
        MutualFund.id,
        MutualFund.scheme_name,
    )
    total = int(await session.scalar(select(func.count()).select_from(grouped_ids.subquery())) or 0)

    id_rows = (
        await session.execute(
            grouped_ids.order_by(MutualFund.scheme_name).offset(offset).limit(page_size)
        )
    ).all()
    fund_ids = [row[0] for row in id_rows]

    if not fund_ids:
        return {
            "items": [],
            "page": page,
            "page_size": page_size,
            "total": total,
            "has_more": offset < total,
        }

    rows = (
        await session.execute(
            _apply_fund_list_filters(_fund_list_base_query(), **filter_kwargs)
            .where(MutualFund.id.in_(fund_ids))
            .order_by(MutualFund.scheme_name, MutualFund.id)
        )
    ).all()

    settings = get_settings()
    items_by_id: dict[int, dict] = {}
    for fund, product, amc, category_slug_val, category_name, return_3y, rank_position in rows:
        if fund.id in items_by_id:
            continue
        items_by_id[fund.id] = _serialize_fund_row(
            fund,
            product,
            amc,
            category_slug=category_slug_val,
            category_name=category_name,
            return_3y=return_3y,
            rank_position=rank_position,
            settings=settings,
        )

    items = [items_by_id[fund_id] for fund_id in fund_ids if fund_id in items_by_id]

    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "has_more": offset + len(items) < total,
    }


def _serialize_fund_row(
    fund: MutualFund,
    product: Product | None,
    amc: FundAmc,
    *,
    category_slug: str | None,
    category_name: str | None,
    return_3y: Decimal | None,
    rank_position: int | None,
    settings,
    latest_nav: Decimal | None = None,
    latest_nav_date: date | None = None,
    nav_row_count: int | None = None,
) -> dict:
    health_flags: list[str] = []
    if product:
        health_flags = compute_fund_health_flags(
            FundHealthInput(
                product=product,
                fund=fund,
                amc=amc,
                latest_nav_date=latest_nav_date,
                nav_row_count=nav_row_count,
                return_3y=return_3y,
            ),
            settings=settings,
        )
    return {
        "fund_id": fund.id,
        "product_id": str(product.id) if product else None,
        "product_code": product.code if product else None,
        "scheme_name": fund.scheme_name,
        "isin": fund.isin_growth,
        "scheme_code": fund.scheme_code,
        "amc_id": amc.id,
        "amc_name": amc.name,
        "amc_slug": amc.slug,
        "amc_logo_url": resolve_amc_logo_url(amc.logo_url, amc.slug, settings),
        "amc_empanelled": amc.is_active,
        "category_slug": category_slug,
        "category_name": category_name,
        "lifecycle_status": product.lifecycle_status.value if product else None,
        "fund_active": fund.is_active,
        "fp_oms_purchase_allowed": fund.fp_oms_purchase_allowed,
        "fp_oms_active": fund.fp_oms_active,
        "fp_scheme_id": fund.fp_scheme_id,
        "sebi_category": fund.sebi_category,
        "min_sip_amount_inr": _decimal(fund.min_sip_amount),
        "min_lumpsum_amount_inr": _decimal(fund.min_lumpsum_amount),
        "return_3y": _decimal(return_3y),
        "rank_position": rank_position,
        "latest_nav": _decimal(latest_nav),
        "latest_nav_date": latest_nav_date.isoformat() if latest_nav_date else None,
        "nav_row_count": nav_row_count,
        "catalog_flags": _catalog_flags(product=product, fund=fund, amc=amc),
        "health_flags": health_flags,
        "admin_visibility": product.admin_visibility.value if product else None,
        "admin_investability": product.admin_investability.value if product else None,
        "disabled_reason": product.disabled_reason if product else None,
        "disabled_at": product.disabled_at.isoformat() if product and product.disabled_at else None,
        "is_visible": is_product_visible(
            product=product,
            fund=fund,
            amc=amc,
            latest_nav_date=latest_nav_date,
            nav_row_count=nav_row_count,
            return_3y=return_3y,
        )
        if product
        else False,
        "is_investable": is_product_investable(product=product, fund=fund, amc=amc) if product else False,
        "amc_kill_switch": amc.admin_kill_switch,
    }


async def get_fund_admin(session: AsyncSession, fund_id: int) -> dict | None:
    row = (
        await session.execute(
            _fund_list_base_query().where(MutualFund.id == fund_id)
        )
    ).first()
    if not row:
        return None

    fund, product, amc, category_slug, category_name, return_3y, rank_position = row
    settings = get_settings()

    latest_nav_row = await session.scalar(
        select(SchemeNav)
        .where(SchemeNav.fund_id == fund.id)
        .order_by(desc(SchemeNav.nav_date))
        .limit(1)
    )
    nav_row_count = int(
        await session.scalar(
            select(func.count()).select_from(SchemeNav).where(SchemeNav.fund_id == fund.id)
        )
        or 0
    )

    metrics_row = await session.get(FundNavMetrics, fund.id)

    return {
        **_serialize_fund_row(
            fund,
            product,
            amc,
            category_slug=category_slug,
            category_name=category_name,
            return_3y=return_3y,
            rank_position=rank_position,
            settings=settings,
            latest_nav=latest_nav_row.nav_value if latest_nav_row else None,
            latest_nav_date=latest_nav_row.nav_date if latest_nav_row else None,
            nav_row_count=nav_row_count,
        ),
        "returns": {
            "return_1d": _decimal(metrics_row.return_1d if metrics_row else None),
            "return_1w": _decimal(metrics_row.return_1w if metrics_row else None),
            "return_1m": _decimal(metrics_row.return_1m if metrics_row else None),
            "return_3m": _decimal(metrics_row.return_3m if metrics_row else None),
            "return_6m": _decimal(metrics_row.return_6m if metrics_row else None),
            "return_1y": _decimal(metrics_row.return_1y if metrics_row else None),
            "return_3y": _decimal(metrics_row.return_3y if metrics_row else None),
            "return_5y": _decimal(metrics_row.return_5y if metrics_row else None),
        },
        "metrics_as_of": metrics_row.as_of_date.isoformat() if metrics_row else None,
    }


async def list_fund_navs_admin(
    session: AsyncSession,
    fund_id: int,
    *,
    from_date: date | None = None,
    to_date: date | None = None,
    limit: int = 365,
) -> dict | None:
    fund = await session.get(MutualFund, fund_id)
    if not fund:
        return None

    to_dt = to_date or date.today()
    from_dt = from_date or (to_dt - timedelta(days=365))
    limit = min(max(limit, 1), 2000)

    rows = (
        await session.execute(
            select(SchemeNav.nav_date, SchemeNav.nav_value)
            .where(
                SchemeNav.fund_id == fund_id,
                SchemeNav.nav_date >= from_dt,
                SchemeNav.nav_date <= to_dt,
            )
            .order_by(SchemeNav.nav_date.desc())
            .limit(limit)
        )
    ).all()

    points = [
        {"date": nav_date.isoformat(), "nav": _decimal(nav_value)}
        for nav_date, nav_value in reversed(rows)
    ]

    return {
        "fund_id": fund_id,
        "from_date": from_dt.isoformat(),
        "to_date": to_dt.isoformat(),
        "count": len(points),
        "points": points,
    }
