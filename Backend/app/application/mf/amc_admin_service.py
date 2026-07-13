from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.public_asset_service import resolve_amc_logo_url
from app.core.config import get_settings
from app.infrastructure.persistence.mf_models import FundAmc


async def list_amcs_admin(session: AsyncSession) -> list[dict]:
    settings = get_settings()
    rows = (await session.execute(select(FundAmc).order_by(FundAmc.name))).scalars()
    return [
        {
            "id": amc.id,
            "name": amc.name,
            "slug": amc.slug,
            "amc_code": amc.amc_code,
            "fp_amc_id": amc.fp_amc_id,
            "is_active": amc.is_active,
            "admin_kill_switch": amc.admin_kill_switch,
            "logo_url": resolve_amc_logo_url(amc.logo_url, amc.slug, settings),
        }
        for amc in rows
    ]


async def update_amc_admin(
    session: AsyncSession,
    amc_id: int,
    *,
    is_active: bool | None = None,
    amc_code: str | None = None,
    admin_kill_switch: bool | None = None,
) -> dict | None:
    amc = await session.get(FundAmc, amc_id)
    if not amc:
        return None

    if is_active is not None:
        amc.is_active = is_active
    if amc_code is not None:
        amc.amc_code = amc_code.strip() or None
    if admin_kill_switch is not None:
        amc.admin_kill_switch = admin_kill_switch

    settings = get_settings()
    return {
        "id": amc.id,
        "name": amc.name,
        "slug": amc.slug,
        "amc_code": amc.amc_code,
        "fp_amc_id": amc.fp_amc_id,
        "is_active": amc.is_active,
        "admin_kill_switch": amc.admin_kill_switch,
        "logo_url": resolve_amc_logo_url(amc.logo_url, amc.slug, settings),
    }
