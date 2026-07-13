from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.amc_name_parser import normalize_amc_display_name, parse_amc_from_scheme_name
from app.application.mf.ingestion_run_service import begin_ingestion_run, finish_ingestion_run, has_running_job
from app.application.mf.scheme_sql_upsert_service import get_or_create_amc
from app.infrastructure.persistence.mf_models import (
    AmfiSchemeMaster,
    FundAmc,
    IngestionRunStatus,
    MutualFund,
    Product,
)

logger = logging.getLogger(__name__)

UNKNOWN_AMC_SLUG = "unknown-amc"


async def run_amfi_fund_bridge(
    session: AsyncSession,
    *,
    triggered_by: str = "SCHEDULER",
) -> dict[str, int | str]:
    if await has_running_job(session, "amfi-fund-bridge"):
        return {"skipped": 1, "reason": "already_running"}

    run = await begin_ingestion_run(session, job_name="amfi-fund-bridge", triggered_by=triggered_by)
    scheme_codes_updated = amc_reassigned = processed = 0

    try:
        master_by_isin: dict[str, AmfiSchemeMaster] = {}
        master_rows = await session.scalars(select(AmfiSchemeMaster))
        for row in master_rows.all():
            master_by_isin[row.isin_growth.upper()] = row
            if row.isin_div_reinvestment:
                master_by_isin[row.isin_div_reinvestment.upper()] = row

        funds = (await session.scalars(select(MutualFund))).all()
        for fund in funds:
            processed += 1
            master = master_by_isin.get(fund.isin_growth.upper())
            if not master and fund.isin_div_reinvestment:
                master = master_by_isin.get(fund.isin_div_reinvestment.upper())

            if master and master.scheme_code and fund.scheme_code != master.scheme_code:
                fund.scheme_code = master.scheme_code
                scheme_codes_updated += 1

            amc = await session.get(FundAmc, fund.amc_id)
            if not amc:
                continue

            needs_amc_fix = (
                amc.slug == UNKNOWN_AMC_SLUG
                or amc.name.lower() == "unknown amc"
            )
            if not needs_amc_fix:
                continue

            candidate_name = None
            if master and master.amc_name:
                candidate_name = normalize_amc_display_name(master.amc_name)
            if not candidate_name:
                candidate_name = parse_amc_from_scheme_name(fund.scheme_name)
            if not candidate_name:
                continue

            new_amc = await get_or_create_amc(session, name=candidate_name, fp_amc_id=None)
            if new_amc.id != fund.amc_id:
                fund.amc_id = new_amc.id
                amc_reassigned += 1
                product = await session.scalar(select(Product).where(Product.id == fund.product_id))
                if product:
                    product.provider = new_amc.name

        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.succeeded,
            records_processed=processed,
            records_inserted=scheme_codes_updated + amc_reassigned,
            metadata={
                "scheme_codes_updated": scheme_codes_updated,
                "amc_reassigned": amc_reassigned,
            },
        )
        return {
            "processed": processed,
            "scheme_codes_updated": scheme_codes_updated,
            "amc_reassigned": amc_reassigned,
            "run_uuid": str(run.run_uuid),
        }
    except Exception as exc:
        logger.exception("AMFI fund bridge failed")
        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.failed,
            records_processed=processed,
            error_message=str(exc),
        )
        raise
