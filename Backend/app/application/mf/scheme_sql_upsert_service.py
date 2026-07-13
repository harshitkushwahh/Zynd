from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.amfi_nav_parser import slugify
from app.application.mf.product_catalog_service import ensure_product_for_fund
from app.application.mf.scheme_row_normalizer import normalized_from_mongo
from app.infrastructure.persistence.mf_models import FundAmc, MutualFund


async def get_or_create_amc(session: AsyncSession, *, name: str, fp_amc_id: str | None) -> FundAmc:
    if fp_amc_id:
        existing = await session.scalar(select(FundAmc).where(FundAmc.fp_amc_id == fp_amc_id))
        if existing:
            return existing

    slug = slugify(name)
    existing = await session.scalar(select(FundAmc).where(FundAmc.slug == slug))
    if existing:
        if fp_amc_id and not existing.fp_amc_id:
            existing.fp_amc_id = fp_amc_id
        return existing

    amc = FundAmc(name=name, slug=slug, fp_amc_id=fp_amc_id, is_active=False)
    session.add(amc)
    await session.flush()
    return amc


async def upsert_fund_from_normalized(
    session: AsyncSession,
    normalized: dict,
) -> tuple[str, MutualFund, FundAmc, object | None]:
    """Returns action: inserted|updated, fund, amc."""
    payload = normalized_from_mongo(normalized)
    amc = await get_or_create_amc(
        session,
        name=payload["amc_name"],
        fp_amc_id=payload["fp_amc_id"],
    )
    existing = await session.scalar(
        select(MutualFund).where(MutualFund.isin_growth == payload["isin_growth"])
    )
    if existing:
        existing.scheme_name = payload["scheme_name"]
        existing.fp_scheme_id = payload["fp_scheme_id"]
        existing.fp_oms_purchase_allowed = payload["fp_oms_purchase_allowed"]
        existing.fp_oms_active = payload["fp_oms_active"]
        existing.min_sip_amount = payload["min_sip_amount"]
        existing.min_lumpsum_amount = payload["min_lumpsum_amount"]
        existing.sebi_category = payload["sebi_category"]
        existing.plan_type = payload["plan_type"]
        existing.option_type = payload["option_type"]
        if payload["scheme_code"]:
            existing.scheme_code = payload["scheme_code"]
        fund = existing
        action = "updated"
    else:
        fund = MutualFund(
            amc_id=amc.id,
            isin_growth=payload["isin_growth"],
            scheme_name=payload["scheme_name"],
            fp_scheme_id=payload["fp_scheme_id"],
            fp_oms_purchase_allowed=payload["fp_oms_purchase_allowed"],
            fp_oms_active=payload["fp_oms_active"],
            min_sip_amount=payload["min_sip_amount"],
            min_lumpsum_amount=payload["min_lumpsum_amount"],
            sebi_category=payload["sebi_category"],
            plan_type=payload["plan_type"],
            option_type=payload["option_type"],
            scheme_code=payload["scheme_code"],
        )
        session.add(fund)
        await session.flush()
        action = "inserted"

    product = await ensure_product_for_fund(session, fund, amc_name=amc.name)
    return action, fund, amc, product
