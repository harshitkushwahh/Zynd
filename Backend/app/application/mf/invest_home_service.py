from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, null, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.catalog_health_service import FundHealthInput, compute_fund_health_flags
from app.application.mf.catalog_display_service import (
    curated_fund_order_columns,
    product_category_effective_clause,
)
from app.application.mf.catalog_governance_service import invest_visibility_sql_clause
from app.application.mf.public_asset_service import resolve_amc_logo_url
from app.application.mf.product_content_service import (
    get_compliance_settings_public,
    get_product_content_for_invest,
    resolve_effective_disclaimer,
)
from app.application.mf.invest_fund_slug import fund_public_slug
from app.application.mf.popular_funds_service import list_popular_invest_funds
from app.core.config import get_settings
from app.infrastructure.persistence.mf_models import (
    AmcAumRanking,
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
    SchemeNav,
    SchemeTer,
)


def _decimal(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return float(value)


async def list_invest_categories(session: AsyncSession) -> list[dict]:
    rows = (
        await session.execute(
            select(Category.id, Category.slug, Category.name, func.count(Product.id))
            .join(ProductCategory, ProductCategory.category_id == Category.id)
            .join(Product, Product.id == ProductCategory.product_id)
            .join(MutualFund, MutualFund.product_id == Product.id)
            .join(FundAmc, FundAmc.id == MutualFund.amc_id)
            .where(
                invest_visibility_sql_clause(),
                Category.is_visible.is_(True),
                Category.category_kind == CategoryKind.browse,
            )
            .group_by(Category.id, Category.slug, Category.name, Category.display_order)
            .order_by(Category.display_order, Category.name)
        )
    ).all()
    return [
        {"id": category_id, "slug": slug, "name": name, "fund_count": count}
        for category_id, slug, name, count in rows
    ]


async def list_invest_collections(session: AsyncSession) -> list[dict]:
    rows = (
        await session.execute(
            select(Category.id, Category.slug, Category.name, func.count(Product.id))
            .join(ProductCategory, ProductCategory.category_id == Category.id)
            .join(Product, Product.id == ProductCategory.product_id)
            .join(MutualFund, MutualFund.product_id == Product.id)
            .join(FundAmc, FundAmc.id == MutualFund.amc_id)
            .where(
                invest_visibility_sql_clause(),
                Category.is_visible.is_(True),
                Category.category_kind == CategoryKind.collection,
                product_category_effective_clause(),
            )
            .group_by(Category.id, Category.slug, Category.name, Category.display_order)
            .order_by(Category.display_order, Category.name)
        )
    ).all()
    return [
        {"id": category_id, "slug": slug, "name": name, "fund_count": count}
        for category_id, slug, name, count in rows
    ]


async def list_invest_funds(
    session: AsyncSession,
    *,
    category_slug: str | None = None,
    page: int = 1,
    page_size: int = 20,
    sort: str = "rank",
) -> dict:
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    offset = (page - 1) * page_size

    if category_slug:
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
            .join(ProductCategory, ProductCategory.product_id == Product.id)
            .join(Category, Category.id == ProductCategory.category_id)
            .outerjoin(
                FundCompositeRank,
                (FundCompositeRank.fund_id == MutualFund.id)
                & (FundCompositeRank.category_id == ProductCategory.category_id),
            )
            .where(
                invest_visibility_sql_clause(),
                Category.slug == category_slug,
                Category.is_visible.is_(True),
                product_category_effective_clause(),
            )
            .outerjoin(ProductDisplayContent, ProductDisplayContent.product_id == Product.id)
        )
        count_stmt = select(func.count(func.distinct(Product.id))).select_from(base.subquery())
    else:
        best_rank_sq = (
            select(
                FundCompositeRank.fund_id,
                func.min(FundCompositeRank.rank_position).label("rank_position"),
            )
            .group_by(FundCompositeRank.fund_id)
            .subquery()
        )
        base = (
            select(
                Product,
                MutualFund,
                FundAmc,
                FundNavMetrics,
                best_rank_sq.c.rank_position,
                null(),
                null(),
                null(),
                ProductDisplayContent,
            )
            .join(MutualFund, MutualFund.product_id == Product.id)
            .join(FundAmc, FundAmc.id == MutualFund.amc_id)
            .outerjoin(FundNavMetrics, FundNavMetrics.fund_id == MutualFund.id)
            .outerjoin(best_rank_sq, best_rank_sq.c.fund_id == MutualFund.id)
            .outerjoin(ProductDisplayContent, ProductDisplayContent.product_id == Product.id)
            .where(invest_visibility_sql_clause())
        )
        count_stmt = (
            select(func.count(Product.id))
            .select_from(Product)
            .join(MutualFund, MutualFund.product_id == Product.id)
            .where(invest_visibility_sql_clause())
        )

    total = int(await session.scalar(count_stmt) or 0)

    if category_slug:
        for column in curated_fund_order_columns():
            base = base.order_by(column)
    elif sort == "return_3y":
        base = base.order_by(FundNavMetrics.return_3y.desc().nullslast(), Product.name)
    elif sort == "name":
        base = base.order_by(Product.name)
    else:
        base = base.order_by(best_rank_sq.c.rank_position.asc().nullslast(), Product.name)

    rows = (await session.execute(base.offset(offset).limit(page_size))).all()
    settings = get_settings()
    items = _serialize_invest_fund_rows(rows, settings=settings)

    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "has_more": offset + len(items) < total,
    }


def _serialize_invest_fund_rows(rows, *, settings) -> list[dict]:
    seen: set[uuid.UUID] = set()
    items: list[dict] = []
    for (
        product,
        fund,
        amc,
        metrics,
        rank_position,
        category,
        is_featured,
        display_order,
        display_content,
    ) in rows:
        if product.id in seen:
            continue
        seen.add(product.id)
        items.append(
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
        )
    return items


async def list_featured_invest_funds(session: AsyncSession, *, limit: int = 8) -> list[dict]:
    settings = get_settings()
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
                ProductCategory.display_order,
                ProductDisplayContent,
            )
            .join(MutualFund, MutualFund.product_id == Product.id)
            .join(FundAmc, FundAmc.id == MutualFund.amc_id)
            .outerjoin(FundNavMetrics, FundNavMetrics.fund_id == MutualFund.id)
            .join(ProductCategory, ProductCategory.product_id == Product.id)
            .join(Category, Category.id == ProductCategory.category_id)
            .outerjoin(
                FundCompositeRank,
                (FundCompositeRank.fund_id == MutualFund.id)
                & (FundCompositeRank.category_id == ProductCategory.category_id),
            )
            .outerjoin(ProductDisplayContent, ProductDisplayContent.product_id == Product.id)
            .where(
                invest_visibility_sql_clause(),
                Category.is_visible.is_(True),
                ProductCategory.is_featured.is_(True),
                product_category_effective_clause(),
            )
            .order_by(*curated_fund_order_columns())
            .limit(min(max(limit, 1), 24))
        )
    ).all()

    return [
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


async def get_invest_home(session: AsyncSession) -> dict:
    categories = await list_invest_categories(session)
    collections = await list_invest_collections(session)
    popular = await list_popular_invest_funds(session, limit=5)
    featured = await list_featured_invest_funds(session, limit=8)
    total_payload = await list_invest_funds(session, page=1, page_size=1)
    return {
        "categories": categories,
        "collections": collections,
        "popular_funds": popular,
        "featured_funds": featured,
        "total_active_funds": total_payload["total"],
    }


async def get_invest_fund_detail(session: AsyncSession, product_id: uuid.UUID) -> dict | None:
    row = (
        await session.execute(
            select(Product, MutualFund, FundAmc, FundNavMetrics, Category.slug, Category.name)
            .join(MutualFund, MutualFund.product_id == Product.id)
            .join(FundAmc, FundAmc.id == MutualFund.amc_id)
            .outerjoin(FundNavMetrics, FundNavMetrics.fund_id == MutualFund.id)
            .outerjoin(ProductCategory, ProductCategory.product_id == Product.id)
            .outerjoin(Category, Category.id == ProductCategory.category_id)
            .where(Product.id == product_id, invest_visibility_sql_clause())
        )
    ).first()
    if not row:
        return None

    product, fund, amc, metrics, category_slug, category_name = row
    settings = get_settings()

    latest_nav = await session.scalar(
        select(SchemeNav)
        .where(SchemeNav.fund_id == fund.id)
        .order_by(SchemeNav.nav_date.desc())
        .limit(1)
    )
    latest_aum = await session.scalar(
        select(SchemeAum)
        .where(SchemeAum.fund_id == fund.id)
        .order_by(SchemeAum.as_of_date.desc())
        .limit(1)
    )
    latest_ter = await session.scalar(
        select(SchemeTer)
        .where(SchemeTer.fund_id == fund.id)
        .order_by(SchemeTer.as_of_date.desc())
        .limit(1)
    )
    rank = await session.scalar(
        select(FundCompositeRank.rank_position)
        .join(ProductCategory, ProductCategory.category_id == FundCompositeRank.category_id)
        .where(FundCompositeRank.fund_id == fund.id, ProductCategory.product_id == product.id)
        .order_by(FundCompositeRank.rank_position)
        .limit(1)
    )

    nav_row_count = int(
        await session.scalar(
            select(func.count()).select_from(SchemeNav).where(SchemeNav.fund_id == fund.id)
        )
        or 0
    )

    health_badges = _public_health_badges(
        product=product,
        fund=fund,
        amc=amc,
        metrics=metrics,
        latest_nav_date=latest_nav.nav_date if latest_nav else None,
        nav_row_count=nav_row_count,
    )

    payload = _serialize_fund_summary(
        product,
        fund,
        amc,
        metrics,
        rank,
        category_slug,
        settings=settings,
        health_badges=health_badges,
    )
    config = await get_compliance_settings_public(session)
    payload.update(
        {
            "category_name": category_name,
            "sebi_category": fund.sebi_category,
            "plan_type": fund.plan_type,
            "option_type": fund.option_type,
            "min_sip_amount_inr": _decimal(fund.min_sip_amount),
            "min_lumpsum_amount_inr": _decimal(fund.min_lumpsum_amount),
            "latest_nav": _decimal(latest_nav.nav_value) if latest_nav else None,
            "latest_nav_date": latest_nav.nav_date.isoformat() if latest_nav else None,
            "aum_inr": _decimal(latest_aum.aum_inr) if latest_aum else None,
            "aum_as_of": latest_aum.as_of_date.isoformat() if latest_aum else None,
            "ter_percent": _decimal(latest_ter.ter_percent) if latest_ter else None,
            "ter_as_of": latest_ter.as_of_date.isoformat() if latest_ter else None,
            "disclaimer": resolve_effective_disclaimer(
                product_disclaimer=None,
                compliance=config,
            ),
            "distributor_arn": config["distributor_arn"],
            "distributor_euin": config["distributor_euin"],
        }
    )
    content = await get_product_content_for_invest(session, product.id, amc_id=amc.id)
    payload["disclaimer"] = resolve_effective_disclaimer(
        product_disclaimer=content.get("disclaimer_text"),
        compliance=config,
    )
    payload["content"] = content
    payload["slug"] = fund_public_slug(
        name=product.name,
        seo_slug=content.get("seo_slug"),
    )
    payload["display"] = {
        "tagline": content.get("tagline"),
        "hero_badge": content.get("hero_badge"),
        "risk_label": content.get("risk_label"),
    }

    from app.application.mf.investment_constraints import serialize_investment_constraints_for_api
    from app.application.mf.scheme_compliance_service import get_amc_registry_payload, get_compliance_payload

    compliance = await get_compliance_payload(session, fund.id)
    if compliance:
        payload["compliance"] = compliance

    fund_house = await get_amc_registry_payload(session, amc.id)
    if fund_house:
        payload["fund_house"] = fund_house

    amc_rank_row = await session.scalar(
        select(AmcAumRanking)
        .where(AmcAumRanking.amc_id == amc.id)
        .order_by(AmcAumRanking.as_of_date.desc())
        .limit(1)
    )
    if amc_rank_row:
        payload["amc_aum_rank"] = {
            "position": amc_rank_row.rank_india,
            "peer_count": amc_rank_row.peer_count,
            "total_aum_inr": _decimal(amc_rank_row.total_aum_inr),
            "as_of_date": amc_rank_row.as_of_date.isoformat(),
            "label": f"#{amc_rank_row.rank_india} in India by AUM",
        }

    investment_details = serialize_investment_constraints_for_api(fund.investment_constraints)
    if investment_details:
        payload["investment_details"] = investment_details

    return payload


def _public_health_badges(
    *,
    product: Product,
    fund: MutualFund,
    amc: FundAmc,
    metrics: FundNavMetrics | None,
    latest_nav_date: date | None = None,
    nav_row_count: int | None = None,
) -> list[str]:
    flags = compute_fund_health_flags(
        FundHealthInput(
            product=product,
            fund=fund,
            amc=amc,
            latest_nav_date=latest_nav_date,
            nav_row_count=nav_row_count,
            return_3y=metrics.return_3y if metrics else None,
        )
    )
    return [flag for flag in flags if flag not in {"stale_nav", "orphan_product"}]


async def list_invest_fund_navs(
    session: AsyncSession,
    product_id: uuid.UUID,
    *,
    limit: int = 365,
) -> dict | None:
    row = (
        await session.execute(
            select(MutualFund)
            .join(Product, Product.id == MutualFund.product_id)
            .where(Product.id == product_id, invest_visibility_sql_clause())
        )
    ).first()
    if not row:
        return None
    fund = row[0]

    limit = min(max(limit, 1), 2000)
    to_dt = date.today()
    from_dt = to_dt - timedelta(days=365)

    rows = (
        await session.execute(
            select(SchemeNav.nav_date, SchemeNav.nav_value)
            .where(
                SchemeNav.fund_id == fund.id,
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
        "product_id": str(product_id),
        "from_date": from_dt.isoformat(),
        "to_date": to_dt.isoformat(),
        "count": len(points),
        "points": points,
    }


def get_invest_config_payload() -> dict:
    settings = get_settings()
    return {
        "distributor_arn": settings.zynd_distributor_arn or None,
        "distributor_euin": settings.zynd_distributor_euin or None,
        "disclaimer": settings.zynd_mf_invest_disclaimer,
        "orders_enabled": settings.zynd_mf_orders_enabled,
        "sip_enabled": settings.zynd_mf_sip_enabled,
        "cas_enabled": settings.zynd_mf_cas_enabled,
    }


async def get_invest_config(session: AsyncSession) -> dict:
    compliance = await get_compliance_settings_public(session)
    settings = get_settings()
    return {
        "distributor_arn": compliance["distributor_arn"],
        "distributor_euin": compliance["distributor_euin"],
        "disclaimer": compliance["default_disclaimer"],
        "orders_enabled": settings.zynd_mf_orders_enabled,
        "sip_enabled": settings.zynd_mf_sip_enabled,
        "cas_enabled": settings.zynd_mf_cas_enabled,
    }


def _serialize_fund_summary(
    product: Product,
    fund: MutualFund,
    amc: FundAmc,
    metrics: FundNavMetrics | None,
    rank_position: int | None,
    category_slug: str | None,
    *,
    settings,
    is_featured: bool | None = None,
    display_order: int | None = None,
    health_badges: list[str] | None = None,
    display_content: ProductDisplayContent | None = None,
) -> dict:
    payload = {
        "product_id": str(product.id),
        "product_code": product.code,
        "name": product.name,
        "provider": product.provider,
        "amc_name": amc.name,
        "amc_slug": amc.slug,
        "amc_logo_url": resolve_amc_logo_url(amc.logo_url, amc.slug, settings),
        "category_slug": category_slug,
        "isin": fund.isin_growth,
        "rank_position": rank_position,
        "sebi_category": fund.sebi_category,
        "min_sip_amount_inr": _decimal(fund.min_sip_amount),
        "min_lumpsum_amount_inr": _decimal(fund.min_lumpsum_amount),
        "returns": {
            "return_1d": _decimal(metrics.return_1d if metrics else None),
            "return_1w": _decimal(metrics.return_1w if metrics else None),
            "return_1m": _decimal(metrics.return_1m if metrics else None),
            "return_3m": _decimal(metrics.return_3m if metrics else None),
            "return_6m": _decimal(metrics.return_6m if metrics else None),
            "return_1y": _decimal(metrics.return_1y if metrics else None),
            "return_3y": _decimal(metrics.return_3y if metrics else None),
            "return_5y": _decimal(metrics.return_5y if metrics else None),
        },
    }
    if is_featured is not None:
        payload["is_featured"] = is_featured
    if display_order is not None:
        payload["display_order"] = display_order
    if health_badges is not None:
        payload["health_badges"] = health_badges
    if display_content is not None:
        payload["display"] = {
            "tagline": display_content.tagline,
            "hero_badge": display_content.hero_badge,
            "risk_label": display_content.risk_label,
        }
    payload["slug"] = fund_public_slug(
        name=product.name,
        seo_slug=display_content.seo_slug if display_content else None,
    )
    return payload
