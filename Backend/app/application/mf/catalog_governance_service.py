from __future__ import annotations

from sqlalchemy import and_, or_

from app.application.mf.catalog_health_service import (
    FundHealthInput,
    compute_fund_health_flags,
    health_blocks_public_display,
    invest_health_sql_clause,
)
from app.core.config import get_settings

from app.infrastructure.persistence.mf_models import (
    AdminInvestability,
    AdminVisibility,
    FundAmc,
    MutualFund,
    Product,
    ProductLifecycleStatus,
)


def is_auto_catalog_visible(
    *,
    product: Product,
    fund: MutualFund,
    amc: FundAmc,
) -> bool:
    return (
        product.lifecycle_status == ProductLifecycleStatus.active
        and amc.is_active
        and fund.is_active
        and fund.fp_oms_purchase_allowed is True
    )


def is_product_visible(
    *,
    product: Product,
    fund: MutualFund,
    amc: FundAmc,
    latest_nav_date=None,
    nav_row_count: int | None = None,
    return_3y=None,
) -> bool:
    if amc.admin_kill_switch:
        return False
    if product.admin_visibility == AdminVisibility.force_hide:
        return False
    if product.admin_visibility == AdminVisibility.force_show:
        visible = True
    else:
        visible = is_auto_catalog_visible(product=product, fund=fund, amc=amc)

    settings = get_settings()
    if visible and settings.zynd_mf_catalog_health_gates_enabled:
        flags = compute_fund_health_flags(
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
        if health_blocks_public_display(flags, product):
            return False
    return visible


def is_product_investable(
    *,
    product: Product,
    fund: MutualFund,
    amc: FundAmc,
) -> bool:
    if not is_product_visible(product=product, fund=fund, amc=amc):
        return False
    if product.admin_investability == AdminInvestability.block_orders:
        return False
    if product.admin_visibility == AdminVisibility.force_hide:
        return False
    if amc.admin_kill_switch:
        return False
    return (
        product.lifecycle_status == ProductLifecycleStatus.active
        and amc.is_active
        and fund.is_active
        and fund.fp_oms_purchase_allowed is True
        and fund.fp_oms_active is not False
    )


def invest_visibility_sql_clause():
    """SQLAlchemy filter for public invest fund listings."""
    auto_visible = and_(
        Product.lifecycle_status == ProductLifecycleStatus.active,
        FundAmc.is_active.is_(True),
        MutualFund.is_active.is_(True),
        MutualFund.fp_oms_purchase_allowed.is_(True),
    )
    return and_(
        FundAmc.admin_kill_switch.is_(False),
        Product.admin_visibility != AdminVisibility.force_hide,
        or_(
            Product.admin_visibility == AdminVisibility.force_show,
            auto_visible,
        ),
        invest_health_sql_clause(),
    )
