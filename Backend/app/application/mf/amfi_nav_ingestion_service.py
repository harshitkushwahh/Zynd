from __future__ import annotations

import logging
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.amfi_nav_fetcher import AmfiNavFetchError, fetch_amfi_nav_all, parse_amfi_nav_date
from app.application.mf.amfi_nav_parser import parse_amfi_nav_file
from app.application.mf.ingestion_run_service import begin_ingestion_run, finish_ingestion_run, has_running_job
from app.core.config import get_settings
from app.infrastructure.mf.mongo_raw_store import store_raw_ingestion
from app.infrastructure.persistence.mf_models import (
    IngestionRunStatus,
    MutualFund,
    NavIngestionQuarantine,
    SchemeNav,
)

logger = logging.getLogger(__name__)


async def run_amfi_nav_ingestion(
    session: AsyncSession,
    *,
    triggered_by: str = "SCHEDULER",
) -> dict[str, int | str]:
    settings = get_settings()
    if not settings.zynd_mf_nav_ingestion_enabled:
        return {"skipped": 1, "reason": "nav_ingestion_disabled"}

    if await has_running_job(session, "amfi-nav-daily"):
        return {"skipped": 1, "reason": "already_running"}

    run = await begin_ingestion_run(session, job_name="amfi-nav-daily", triggered_by=triggered_by)
    processed = inserted = skipped = quarantined = 0

    try:
        body, file_size = await fetch_amfi_nav_all()
        await store_raw_ingestion(
            job_name="amfi-nav-daily",
            run_uuid=str(run.run_uuid),
            payload=body,
        )

        records = parse_amfi_nav_file(body)
        if len(records) < settings.zynd_mf_min_nav_record_count:
            raise AmfiNavFetchError(
                f"Parsed only {len(records)} NAV rows; minimum is {settings.zynd_mf_min_nav_record_count}"
            )

        isin_to_fund_id: dict[str, int] = {}
        if settings.zynd_mf_nav_isin_match_only:
            from app.application.mf.amfi_scheme_master_service import build_isin_to_fund_id_map

            isin_to_fund_id = await build_isin_to_fund_id_map(session)

        max_age = timedelta(days=settings.zynd_mf_nav_max_age_days)
        today = date.today()

        for record in records:
            processed += 1
            nav_date = parse_amfi_nav_date(record["nav_date_raw"])
            if not nav_date:
                quarantined += 1
                session.add(
                    NavIngestionQuarantine(
                        run_log_id=run.id,
                        raw_line=str(record),
                        reason="invalid_nav_date",
                    )
                )
                continue

            if today - nav_date > max_age:
                skipped += 1
                continue

            isin = record["isin_growth"].upper()
            if settings.zynd_mf_nav_isin_match_only:
                fund_id = isin_to_fund_id.get(isin)
                if not fund_id:
                    div_isin = (record.get("isin_div_reinvestment") or "").upper()
                    if div_isin:
                        fund_id = isin_to_fund_id.get(div_isin)
                if not fund_id:
                    skipped += 1
                    continue
            else:
                fund_id = isin_to_fund_id.get(isin)
                if not fund_id:
                    quarantined += 1
                    session.add(
                        NavIngestionQuarantine(
                            run_log_id=run.id,
                            raw_line=str(record),
                            reason="unknown_isin",
                        )
                    )
                    continue

            stmt = (
                insert(SchemeNav)
                .values(
                    fund_id=fund_id,
                    nav_date=nav_date,
                    nav_value=record["nav_value"],
                    source="AMFI",
                )
                .on_conflict_do_nothing(index_elements=["fund_id", "nav_date"])
            )
            result = await session.execute(stmt)
            if result.rowcount:
                inserted += 1
            else:
                skipped += 1

        status = IngestionRunStatus.succeeded
        await finish_ingestion_run(
            session,
            run,
            status=status,
            records_processed=processed,
            records_inserted=inserted,
            records_skipped=skipped,
            metadata={"quarantined": quarantined, "file_size_bytes": file_size},
        )
        return {
            "processed": processed,
            "inserted": inserted,
            "skipped": skipped,
            "quarantined": quarantined,
            "run_uuid": str(run.run_uuid),
        }
    except Exception as exc:
        logger.exception("AMFI NAV ingestion failed")
        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.failed,
            records_processed=processed,
            records_inserted=inserted,
            records_skipped=skipped,
            error_message=str(exc),
        )
        raise
