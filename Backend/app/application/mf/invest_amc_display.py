from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.amc_name_parser import parse_amc_from_scheme_name
from app.application.mf.amfi_fund_bridge_service import UNKNOWN_AMC_SLUG
from app.application.mf.amfi_nav_parser import slugify
from app.application.mf.public_asset_service import resolve_amc_logo_url
from app.core.config import Settings, get_settings
from app.infrastructure.persistence.mf_models import FundAmc, MutualFund, Product


def resolve_invest_amc_display(
    *,
    amc_name: str,
    amc_slug: str,
    amc_logo_url: str | None,
    scheme_name: str,
    settings: Settings | None = None,
) -> tuple[str, str, str | None]:
    """Resolve investor-facing AMC label, slug, and logo (Cybrilla often omits AMC on NFO rows)."""
    settings = settings or get_settings()
    if amc_slug != UNKNOWN_AMC_SLUG and amc_name.lower() != "unknown amc":
        return (
            amc_name,
            amc_slug,
            resolve_amc_logo_url(amc_logo_url, amc_slug, settings),
        )
    parsed = parse_amc_from_scheme_name(scheme_name)
    if not parsed:
        return (
            amc_name,
            amc_slug,
            resolve_amc_logo_url(amc_logo_url, amc_slug, settings),
        )
    slug = slugify(parsed)
    return parsed, slug, resolve_amc_logo_url(amc_logo_url, slug, settings)


async def load_fund_amc_display_by_fund_id(
    session: AsyncSession,
    fund_ids: set[int],
    *,
    settings: Settings | None = None,
) -> tuple[dict[int, str], dict[int, str | None], dict[int, str]]:
    """Batch AMC name, logo, and slug for cart, orders, SIPs, etc."""
    if not fund_ids:
        return {}, {}, {}

    settings = settings or get_settings()
    result = await session.execute(
        select(
            MutualFund.id,
            Product.name,
            FundAmc.name,
            FundAmc.logo_url,
            FundAmc.slug,
        )
        .join(FundAmc, MutualFund.amc_id == FundAmc.id)
        .join(Product, Product.id == MutualFund.product_id)
        .where(MutualFund.id.in_(fund_ids))
    )
    amc_names: dict[int, str] = {}
    amc_logos: dict[int, str | None] = {}
    amc_slugs: dict[int, str] = {}
    for fund_id, product_name, name, logo_url, slug in result:
        resolved_name, resolved_slug, resolved_logo = resolve_invest_amc_display(
            amc_name=name,
            amc_slug=slug,
            amc_logo_url=logo_url,
            scheme_name=product_name or "",
            settings=settings,
        )
        amc_names[fund_id] = resolved_name
        amc_logos[fund_id] = resolved_logo
        amc_slugs[fund_id] = resolved_slug
    return amc_names, amc_logos, amc_slugs
