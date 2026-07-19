from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.mf_models import (
    AdminVisibility,
    FundAmc,
    MutualFund,
    Product,
    ProductLifecycleStatus,
)

logger = logging.getLogger(__name__)


def is_lifecycle_sync_blocked(*, product: Product, amc: FundAmc) -> bool:
    return (
        product.admin_visibility == AdminVisibility.force_hide
        or amc.admin_kill_switch
    )


def is_catalog_eligible(
    *,
    amc_active: bool,
    fund_active: bool,
    fp_oms_purchase_allowed: bool | None,
    fp_oms_active: bool | None,
) -> bool:
    if not amc_active or not fund_active:
        return False
    if fp_oms_purchase_allowed is not True:
        return False
    if fp_oms_active is False:
        return False
    return True


def resolve_lifecycle_status(
    current: ProductLifecycleStatus,
    eligible: bool,
) -> ProductLifecycleStatus:
    if eligible:
        return ProductLifecycleStatus.active
    if current == ProductLifecycleStatus.active:
        return ProductLifecycleStatus.inactive
    return current


async def sync_product_lifecycle(session: AsyncSession) -> dict[str, int]:
    rows = (
        await session.execute(
            select(Product, MutualFund, FundAmc)
            .join(MutualFund, MutualFund.product_id == Product.id)
            .join(FundAmc, FundAmc.id == MutualFund.amc_id)
        )
    ).all()

    activated = deactivated = unchanged = processed = 0
    for product, fund, amc in rows:
        processed += 1
        if is_lifecycle_sync_blocked(product=product, amc=amc):
            if product.lifecycle_status == ProductLifecycleStatus.active:
                product.lifecycle_status = ProductLifecycleStatus.inactive
                deactivated += 1
            else:
                unchanged += 1
            continue

        eligible = is_catalog_eligible(
            amc_active=amc.is_active,
            fund_active=fund.is_active,
            fp_oms_purchase_allowed=fund.fp_oms_purchase_allowed,
            fp_oms_active=fund.fp_oms_active,
        )
        next_status = resolve_lifecycle_status(product.lifecycle_status, eligible)
        if next_status == product.lifecycle_status:
            unchanged += 1
            continue

        previous = product.lifecycle_status
        product.lifecycle_status = next_status
        if next_status == ProductLifecycleStatus.active:
            activated += 1
        elif previous == ProductLifecycleStatus.active:
            deactivated += 1

    return {
        "processed": processed,
        "activated": activated,
        "deactivated": deactivated,
        "unchanged": unchanged,
    }
