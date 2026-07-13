from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.audit_service import write_audit
from app.application.mf.catalog_admin_service import get_fund_admin
from app.application.mf.invest_catalog_invalidation import notify_invest_catalog_changed
from app.infrastructure.persistence.mf_models import (
    AdminInvestability,
    AdminVisibility,
    FundAmc,
    MutualFund,
    Product,
)
from app.infrastructure.persistence.models import AuditEventType


def _product_override_snapshot(product: Product | None) -> dict | None:
    if not product:
        return None
    return {
        "admin_visibility": product.admin_visibility.value,
        "admin_investability": product.admin_investability.value,
        "disabled_reason": product.disabled_reason,
        "disabled_by": str(product.disabled_by) if product.disabled_by else None,
        "disabled_at": product.disabled_at.isoformat() if product.disabled_at else None,
    }


def _fund_snapshot(fund: MutualFund, product: Product | None) -> dict:
    return {
        "fund_id": fund.id,
        "product_id": str(product.id) if product else None,
        "is_active": fund.is_active,
        "overrides": _product_override_snapshot(product),
    }


def _amc_snapshot(amc: FundAmc) -> dict:
    return {
        "amc_id": amc.id,
        "is_active": amc.is_active,
        "amc_code": amc.amc_code,
        "admin_kill_switch": amc.admin_kill_switch,
    }


def _requires_reason(
    *,
    admin_visibility: AdminVisibility | None,
    admin_investability: AdminInvestability | None,
    is_active: bool | None,
    admin_kill_switch: bool | None,
) -> bool:
    if admin_visibility == AdminVisibility.force_hide:
        return True
    if admin_investability == AdminInvestability.block_orders:
        return True
    if is_active is False:
        return True
    if admin_kill_switch is True:
        return True
    return False


async def update_fund_catalog_admin(
    session: AsyncSession,
    fund_id: int,
    *,
    admin_user_id: UUID,
    is_active: bool | None = None,
    admin_visibility: AdminVisibility | None = None,
    admin_investability: AdminInvestability | None = None,
    reason: str | None = None,
) -> dict | None:
    row = (
        await session.execute(
            select(MutualFund, Product)
            .outerjoin(Product, Product.id == MutualFund.product_id)
            .where(MutualFund.id == fund_id)
        )
    ).first()
    if not row:
        return None

    fund, product = row
    before = _fund_snapshot(fund, product)

    if _requires_reason(
        admin_visibility=admin_visibility,
        admin_investability=admin_investability,
        is_active=is_active,
        admin_kill_switch=None,
    ) and not (reason and reason.strip()):
        raise ValueError("reason is required for disable or override actions")

    if is_active is not None:
        fund.is_active = is_active

    if product is not None:
        if admin_visibility is not None:
            product.admin_visibility = admin_visibility
        if admin_investability is not None:
            product.admin_investability = admin_investability

        restrictive = (
            (admin_visibility == AdminVisibility.force_hide)
            or (admin_investability == AdminInvestability.block_orders)
            or (is_active is False)
        )
        if restrictive:
            product.disabled_reason = reason.strip() if reason else product.disabled_reason
            product.disabled_by = admin_user_id
            product.disabled_at = datetime.now(timezone.utc)
        elif (
            admin_visibility in (AdminVisibility.auto, AdminVisibility.force_show, None)
            and admin_investability in (AdminInvestability.auto, None)
            and (is_active is None or is_active is True)
        ):
            if (
                product.admin_visibility == AdminVisibility.auto
                and product.admin_investability == AdminInvestability.auto
                and fund.is_active
            ):
                product.disabled_reason = None
                product.disabled_by = None
                product.disabled_at = None

    after = _fund_snapshot(fund, product)
    await write_audit(
        session,
        event_type=AuditEventType.mf_fund_catalog_updated,
        user_id=admin_user_id,
        metadata={"before": before, "after": after, "reason": reason},
    )
    await notify_invest_catalog_changed(session)
    return await get_fund_admin(session, fund_id)


async def update_amc_catalog_admin(
    session: AsyncSession,
    amc_id: int,
    *,
    admin_user_id: UUID,
    is_active: bool | None = None,
    amc_code: str | None = None,
    admin_kill_switch: bool | None = None,
    reason: str | None = None,
) -> dict | None:
    from app.application.mf.amc_admin_service import update_amc_admin

    amc = await session.get(FundAmc, amc_id)
    if not amc:
        return None

    before = _amc_snapshot(amc)

    if _requires_reason(
        admin_visibility=None,
        admin_investability=None,
        is_active=None,
        admin_kill_switch=admin_kill_switch,
    ) and not (reason and reason.strip()):
        raise ValueError("reason is required when enabling AMC kill switch")

    updated = await update_amc_admin(
        session,
        amc_id,
        is_active=is_active,
        amc_code=amc_code,
        admin_kill_switch=admin_kill_switch,
    )
    if not updated:
        return None

    after = _amc_snapshot(amc)
    await write_audit(
        session,
        event_type=AuditEventType.mf_amc_catalog_updated,
        user_id=admin_user_id,
        metadata={"before": before, "after": after, "reason": reason},
    )
    await notify_invest_catalog_changed(session, refresh_search_vectors=True)
    return updated
