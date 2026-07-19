from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import and_, func, not_, or_, select, true
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.catalog_lifecycle_service import is_catalog_eligible
from app.core.config import Settings, get_settings
from app.infrastructure.persistence.mf_models import (
    AdminVisibility,
    FundAmc,
    FundNavMetrics,
    MutualFund,
    Product,
    ProductLifecycleStatus,
    ProductType,
    SchemeNav,
)

HEALTH_CHECKS: list[dict[str, str]] = [
    {"key": "stale_nav", "severity": "critical", "label": "Stale NAV"},
    {"key": "shallow_nav_history", "severity": "warning", "label": "Shallow NAV history"},
    {"key": "missing_3y_metrics", "severity": "warning", "label": "Missing 3Y metrics"},
    {"key": "force_show_not_purchasable", "severity": "warning", "label": "Force-show but not purchasable"},
    {"key": "orphan_product", "severity": "critical", "label": "Orphan product"},
    {"key": "amc_zero_active_funds", "severity": "warning", "label": "Empanelled AMC with zero active funds"},
]


@dataclass(frozen=True)
class FundHealthInput:
    product: Product | None
    fund: MutualFund | None
    amc: FundAmc | None
    latest_nav_date: date | None = None
    nav_row_count: int | None = None
    return_3y: Decimal | None = None


def compute_fund_health_flags(
    data: FundHealthInput,
    *,
    settings: Settings | None = None,
) -> list[str]:
    settings = settings or get_settings()
    flags: list[str] = []
    product = data.product
    fund = data.fund
    amc = data.amc

    if product is None:
        return ["orphan_product"]
    if fund is None:
        flags.append("orphan_product")

    if product and product.lifecycle_status == ProductLifecycleStatus.active and fund and amc:
        stale_days = settings.zynd_mf_nav_stale_days
        if data.latest_nav_date is None:
            flags.append("stale_nav")
        elif (date.today() - data.latest_nav_date).days > stale_days:
            flags.append("stale_nav")

        nav_rows = data.nav_row_count if data.nav_row_count is not None else 0
        if nav_rows < settings.zynd_mf_min_nav_rows:
            flags.append("shallow_nav_history")

        if data.return_3y is None:
            flags.append("missing_3y_metrics")

        if product.admin_visibility == AdminVisibility.force_show and not is_catalog_eligible(
            amc_active=amc.is_active,
            fund_active=fund.is_active,
            fp_oms_purchase_allowed=fund.fp_oms_purchase_allowed,
            fp_oms_active=fund.fp_oms_active,
        ):
            flags.append("force_show_not_purchasable")

    return flags


def health_blocks_public_display(flags: list[str], product: Product | None) -> bool:
    if not product or product.admin_visibility == AdminVisibility.force_show:
        return False
    return "stale_nav" in flags


def invest_health_sql_clause():
    settings = get_settings()
    if not settings.zynd_mf_catalog_health_gates_enabled:
        return true()

    stale_cutoff = date.today() - timedelta(days=settings.zynd_mf_nav_stale_days)
    latest_nav_date = (
        select(func.max(SchemeNav.nav_date))
        .where(SchemeNav.fund_id == MutualFund.id)
        .correlate(MutualFund)
        .scalar_subquery()
    )
    stale_hidden = and_(
        Product.admin_visibility != AdminVisibility.force_show,
        Product.lifecycle_status == ProductLifecycleStatus.active,
        or_(latest_nav_date.is_(None), latest_nav_date < stale_cutoff),
    )
    return or_(Product.admin_visibility == AdminVisibility.force_show, not_(stale_hidden))


async def _load_fund_health_rows(session: AsyncSession) -> list[FundHealthInput]:
    latest_nav_subq = (
        select(
            SchemeNav.fund_id.label("fund_id"),
            func.max(SchemeNav.nav_date).label("latest_nav_date"),
            func.count().label("nav_row_count"),
        )
        .group_by(SchemeNav.fund_id)
        .subquery()
    )

    rows = (
        await session.execute(
            select(
                Product,
                MutualFund,
                FundAmc,
                latest_nav_subq.c.latest_nav_date,
                latest_nav_subq.c.nav_row_count,
                FundNavMetrics.return_3y,
            )
            .outerjoin(MutualFund, MutualFund.product_id == Product.id)
            .outerjoin(FundAmc, FundAmc.id == MutualFund.amc_id)
            .outerjoin(latest_nav_subq, latest_nav_subq.c.fund_id == MutualFund.id)
            .outerjoin(FundNavMetrics, FundNavMetrics.fund_id == MutualFund.id)
            .where(Product.product_type == ProductType.mutual_fund)
        )
    ).all()

    return [
        FundHealthInput(
            product=product,
            fund=fund,
            amc=amc,
            latest_nav_date=latest_nav_date,
            nav_row_count=int(nav_row_count or 0) if fund else None,
            return_3y=return_3y,
        )
        for product, fund, amc, latest_nav_date, nav_row_count, return_3y in rows
    ]


async def _count_amc_zero_active_funds(session: AsyncSession) -> list[dict]:
    rows = (
        await session.execute(
            select(
                FundAmc.id,
                FundAmc.name,
                FundAmc.slug,
                func.count(Product.id),
            )
            .outerjoin(MutualFund, MutualFund.amc_id == FundAmc.id)
            .outerjoin(
                Product,
                and_(
                    Product.id == MutualFund.product_id,
                    Product.lifecycle_status == ProductLifecycleStatus.active,
                ),
            )
            .where(FundAmc.is_active.is_(True))
            .group_by(FundAmc.id, FundAmc.name, FundAmc.slug)
            .having(func.count(Product.id) == 0)
        )
    ).all()
    return [
        {"amc_id": amc_id, "amc_name": name, "amc_slug": slug}
        for amc_id, name, slug, _ in rows
    ]


async def get_catalog_health(session: AsyncSession) -> dict:
    settings = get_settings()
    rows = await _load_fund_health_rows(session)
    amc_zero_active = await _count_amc_zero_active_funds(session)

    summary = {check["key"]: 0 for check in HEALTH_CHECKS}
    public_blocked = 0

    for row in rows:
        flags = compute_fund_health_flags(row, settings=settings)
        for flag in flags:
            if flag in summary:
                summary[flag] += 1
        if row.product and health_blocks_public_display(flags, row.product):
            public_blocked += 1

    summary["amc_zero_active_funds"] = len(amc_zero_active)
    summary["public_blocked_by_health"] = public_blocked

    checks = []
    for check in HEALTH_CHECKS:
        checks.append({**check, "count": summary.get(check["key"], 0)})

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "config": {
            "gates_enabled": settings.zynd_mf_catalog_health_gates_enabled,
            "nav_stale_days": settings.zynd_mf_nav_stale_days,
            "min_nav_rows": settings.zynd_mf_min_nav_rows,
        },
        "summary": summary,
        "checks": checks,
        "amc_zero_active": amc_zero_active,
    }


async def list_catalog_health_issues(
    session: AsyncSession,
    *,
    check: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> dict:
    settings = get_settings()
    page = max(page, 1)
    page_size = min(max(page_size, 1), 200)

    rows = await _load_fund_health_rows(session)
    amc_zero_active = await _count_amc_zero_active_funds(session)
    items: list[dict] = []

    if check == "amc_zero_active_funds":
        for amc in amc_zero_active:
            items.append(
                {
                    "check": check,
                    "fund_id": None,
                    "product_id": None,
                    "scheme_name": None,
                    "amc_id": amc["amc_id"],
                    "amc_name": amc["amc_name"],
                    "health_flags": [check],
                    "latest_nav_date": None,
                    "nav_row_count": None,
                }
            )
    else:
        for row in rows:
            flags = compute_fund_health_flags(row, settings=settings)
            if check and check not in flags:
                continue
            if not check and not flags:
                continue
            product = row.product
            fund = row.fund
            items.append(
                {
                    "check": check or (flags[0] if flags else None),
                    "fund_id": fund.id if fund else None,
                    "product_id": str(product.id) if product else None,
                    "scheme_name": fund.scheme_name if fund else product.name if product else None,
                    "amc_id": row.amc.id if row.amc else None,
                    "amc_name": row.amc.name if row.amc else None,
                    "health_flags": flags,
                    "latest_nav_date": row.latest_nav_date.isoformat() if row.latest_nav_date else None,
                    "nav_row_count": row.nav_row_count,
                    "public_blocked": health_blocks_public_display(flags, product),
                }
            )

    total = len(items)
    offset = (page - 1) * page_size
    page_items = items[offset : offset + page_size]
    return {
        "items": page_items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "has_more": offset + len(page_items) < total,
    }
