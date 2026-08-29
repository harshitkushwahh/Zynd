from __future__ import annotations

import logging
from datetime import date, timedelta

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.amfi_parsers import parse_ter_rows, parse_ter_tracker_csv
from app.infrastructure.mf.pipeline_progress import emit_pipeline_progress
from app.application.mf.enrichment_match_service import build_fund_match_indexes, resolve_fund_id
from app.application.mf.ingestion_run_service import begin_ingestion_run, finish_ingestion_run, has_running_job
from app.core.config import get_settings
from app.infrastructure.mf.amfi_client import fetch_all_ter_rows, fetch_latest_ter_month, amfi_get_bytes
from app.infrastructure.mf.mongo_raw_store import store_raw_ingestion
from app.infrastructure.persistence.mf_models import IngestionRunStatus, SchemeTer

logger = logging.getLogger(__name__)

TER_TRACKER_FALLBACK = "https://raw.githubusercontent.com/captn3m0/india-mutual-fund-ter-tracker/main/data.csv"


async def run_amfi_ter_ingestion(
    session: AsyncSession,
    *,
    triggered_by: str = "SCHEDULER",
) -> dict[str, int | str]:
    settings = get_settings()
    if not settings.zynd_mf_ter_ingestion_enabled:
        return {"skipped": 1, "reason": "ter_ingestion_disabled", "phase": 3}

    if await has_running_job(session, "amfi-ter-monthly"):
        return {"skipped": 1, "reason": "already_running"}

    run = await begin_ingestion_run(session, job_name="amfi-ter-monthly", triggered_by=triggered_by)
    processed = upserted = skipped = 0

    try:
        parsed: list[dict] = []
        source = "AMFI_API"
        month = settings.zynd_mf_ter_month or await fetch_latest_ter_month(
            financial_year=settings.zynd_mf_ter_financial_year
        )

        try:
            rows = await fetch_all_ter_rows(
                month=month,
                page_size=settings.zynd_mf_ter_page_size,
                max_pages=settings.zynd_mf_ter_max_pages or None,
            )
            parsed = parse_ter_rows(rows)
            await store_raw_ingestion(
                job_name="amfi-ter-monthly",
                run_uuid=str(run.run_uuid),
                payload=str({"month": month, "rows": len(rows)})[:500_000],
                content_type="application/json",
            )
        except Exception as exc:
            logger.warning("AMFI TER API failed, trying tracker CSV fallback: %s", exc)
            tracker_url = settings.zynd_mf_ter_tracker_url.strip() or TER_TRACKER_FALLBACK
            body = await amfi_get_bytes(tracker_url)
            parsed = parse_ter_tracker_csv(body)
            source = "GITHUB_TRACKER"
            await store_raw_ingestion(
                job_name="amfi-ter-monthly",
                run_uuid=str(run.run_uuid),
                payload=body[:500_000],
                content_type="text/csv",
            )

        if not parsed:
            raise ValueError("No TER rows parsed from AMFI API or tracker fallback")

        await emit_pipeline_progress(f"AMFI TER match: {len(parsed)} rows to process")
        by_code, by_name = await build_fund_match_indexes(session)
        for row in parsed:
            processed += 1
            if processed % 5000 == 0:
                await emit_pipeline_progress(
                    f"AMFI TER match: processed={processed} upserted={upserted} skipped={skipped}",
                )
            fund_id = resolve_fund_id(
                by_scheme_code=by_code,
                by_name=by_name,
                scheme_name=row.get("scheme_name"),
            )
            if not fund_id:
                skipped += 1
                continue

            as_of_date = row["as_of_date"]
            stmt = (
                insert(SchemeTer)
                .values(
                    fund_id=fund_id,
                    as_of_date=as_of_date,
                    ter_percent=row["ter_percent"],
                    source=source,
                )
                .on_conflict_do_update(
                    index_elements=["fund_id", "as_of_date"],
                    set_={"ter_percent": row["ter_percent"], "source": source},
                )
            )
            await session.execute(stmt)
            upserted += 1

        status = IngestionRunStatus.succeeded if upserted else IngestionRunStatus.partial
        await finish_ingestion_run(
            session,
            run,
            status=status,
            records_processed=processed,
            records_inserted=upserted,
            records_skipped=skipped,
            metadata={"source": source, "month": month},
        )
        return {
            "processed": processed,
            "upserted": upserted,
            "skipped": skipped,
            "source": source,
            "run_uuid": str(run.run_uuid),
        }
    except Exception as exc:
        logger.exception("AMFI TER ingestion failed")
        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.failed,
            records_processed=processed,
            records_inserted=upserted,
            records_skipped=skipped,
            error_message=str(exc),
        )
        raise
