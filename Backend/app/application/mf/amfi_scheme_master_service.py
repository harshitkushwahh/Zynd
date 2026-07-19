from __future__ import annotations

import logging
from datetime import date

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.amfi_nav_fetcher import AmfiNavFetchError, fetch_amfi_nav_all, parse_amfi_nav_date
from app.application.mf.amfi_nav_parser import parse_amfi_nav_file_with_context
from app.application.mf.ingestion_run_service import begin_ingestion_run, finish_ingestion_run, has_running_job
from app.infrastructure.mf.mongo_raw_store import store_raw_ingestion
from app.infrastructure.persistence.mf_models import AmfiSchemeMaster, IngestionRunStatus

logger = logging.getLogger(__name__)


async def run_amfi_scheme_master_sync(
    session: AsyncSession,
    *,
    triggered_by: str = "SCHEDULER",
) -> dict[str, int | str]:
    if await has_running_job(session, "amfi-scheme-master-sync"):
        return {"skipped": 1, "reason": "already_running"}

    run = await begin_ingestion_run(session, job_name="amfi-scheme-master-sync", triggered_by=triggered_by)
    processed = upserted = 0

    try:
        body, _size = await fetch_amfi_nav_all()
        await store_raw_ingestion(
            job_name="amfi-scheme-master-sync",
            run_uuid=str(run.run_uuid),
            payload=body[:500_000],
        )
        records = parse_amfi_nav_file_with_context(body)

        for record in records:
            processed += 1
            nav_date = parse_amfi_nav_date(record["nav_date_raw"])
            stmt = (
                insert(AmfiSchemeMaster)
                .values(
                    scheme_code=record["scheme_code"],
                    isin_growth=record["isin_growth"],
                    isin_div_reinvestment=record.get("isin_div_reinvestment"),
                    scheme_name=record["scheme_name"],
                    amc_name=record.get("amc_name"),
                    last_seen_nav_date=nav_date,
                )
                .on_conflict_do_update(
                    index_elements=["scheme_code"],
                    set_={
                        "isin_growth": record["isin_growth"],
                        "isin_div_reinvestment": record.get("isin_div_reinvestment"),
                        "scheme_name": record["scheme_name"],
                        "amc_name": record.get("amc_name"),
                        "last_seen_nav_date": nav_date,
                    },
                )
            )
            await session.execute(stmt)
            upserted += 1

        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.succeeded,
            records_processed=processed,
            records_inserted=upserted,
            metadata={"unique_schemes": upserted},
        )
        return {"processed": processed, "upserted": upserted, "run_uuid": str(run.run_uuid)}
    except AmfiNavFetchError as exc:
        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.failed,
            records_processed=processed,
            error_message=str(exc),
        )
        raise
    except Exception as exc:
        logger.exception("AMFI scheme master sync failed")
        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.failed,
            records_processed=processed,
            error_message=str(exc),
        )
        raise


async def build_isin_to_fund_id_map(session: AsyncSession) -> dict[str, int]:
    """Map any known ISIN variant (Cybrilla or AMFI) to mutual_funds.id."""
    from sqlalchemy import select

    from app.infrastructure.persistence.mf_models import AmfiSchemeMaster, MutualFund

    fund_by_isin: dict[str, int] = {}
    rows = await session.execute(select(MutualFund.isin_growth, MutualFund.id, MutualFund.isin_div_reinvestment))
    for isin_growth, fund_id, isin_div in rows.all():
        fund_by_isin[isin_growth.upper()] = fund_id
        if isin_div:
            fund_by_isin[str(isin_div).upper()] = fund_id

    master_rows = await session.execute(
        select(
            AmfiSchemeMaster.isin_growth,
            AmfiSchemeMaster.isin_div_reinvestment,
            AmfiSchemeMaster.scheme_code,
        )
    )
    code_to_fund: dict[str, int] = {}
    fund_codes = await session.execute(select(MutualFund.scheme_code, MutualFund.id))
    for scheme_code, fund_id in fund_codes.all():
        if scheme_code:
            code_to_fund[str(scheme_code).strip()] = fund_id

    for isin_growth, isin_div, scheme_code in master_rows.all():
        fund_id = fund_by_isin.get(isin_growth.upper())
        if not fund_id and scheme_code:
            fund_id = code_to_fund.get(str(scheme_code).strip())
        if not fund_id:
            continue
        fund_by_isin[isin_growth.upper()] = fund_id
        if isin_div:
            fund_by_isin[str(isin_div).upper()] = fund_id

    return fund_by_isin
