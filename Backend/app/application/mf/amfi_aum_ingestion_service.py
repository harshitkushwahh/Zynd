from __future__ import annotations

import logging
from datetime import date, timedelta

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.amfi_parsers import crores_to_inr, parse_aum_workbook
from app.application.mf.enrichment_match_service import build_fund_match_indexes, resolve_fund_id
from app.application.mf.ingestion_run_service import begin_ingestion_run, finish_ingestion_run, has_running_job
from app.core.config import get_settings
from app.infrastructure.mf.amfi_client import amfi_get_bytes, build_monthly_aum_portal_url
from app.infrastructure.mf.mongo_raw_store import store_raw_ingestion
from app.infrastructure.persistence.mf_models import IngestionRunStatus, SchemeAum

logger = logging.getLogger(__name__)


def _reporting_month_end(today: date | None = None) -> date:
    current = today or date.today()
    first_of_month = current.replace(day=1)
    last_month_end = first_of_month - timedelta(days=1)
    return last_month_end


async def run_amfi_aum_ingestion(
    session: AsyncSession,
    *,
    triggered_by: str = "SCHEDULER",
) -> dict[str, int | str]:
    settings = get_settings()
    if not settings.zynd_mf_aum_ingestion_enabled:
        return {"skipped": 1, "reason": "aum_ingestion_disabled", "phase": 3}

    if await has_running_job(session, "amfi-aum-monthly"):
        return {"skipped": 1, "reason": "already_running"}

    run = await begin_ingestion_run(session, job_name="amfi-aum-monthly", triggered_by=triggered_by)
    processed = upserted = skipped = 0
    as_of_date = _reporting_month_end()

    try:
        month_start = as_of_date.replace(day=1)
        prev_month_start = (month_start - timedelta(days=1)).replace(day=1)
        urls = [
            build_monthly_aum_portal_url(month_start),
            build_monthly_aum_portal_url(prev_month_start),
        ]
        fallback = settings.zynd_mf_amfi_aum_scheme_wise_data_url.strip()
        if fallback:
            urls.append(fallback)

        body: bytes | None = None
        source_url = ""
        for url in urls:
            try:
                body = await amfi_get_bytes(url, referer=f"{settings.zynd_mf_amfi_aum_url}")
                if len(body) > 1000:
                    source_url = url
                    break
            except Exception as exc:
                logger.warning("AMFI AUM fetch failed for %s: %s", url, exc)

        if not body:
            raise ValueError("Failed to download AMFI monthly AUM file from all URLs")

        await store_raw_ingestion(
            job_name="amfi-aum-monthly",
            run_uuid=str(run.run_uuid),
            payload=body[:500_000] if len(body) <= 500_000 else body[:500_000],
            content_type="application/vnd.ms-excel",
        )

        parsed = parse_aum_workbook(body, as_of_date=as_of_date)
        if not parsed and fallback:
            logger.warning(
                "Monthly AMFI repo file has no scheme-level rows (category aggregate). "
                "Configure ZYND_MF_AMFI_AUM_SCHEME_WISE_DATA_URL for scheme-wise monthly AUM."
            )

        by_code, by_name = await build_fund_match_indexes(session)
        for row in parsed:
            processed += 1
            fund_id = resolve_fund_id(
                by_scheme_code=by_code,
                by_name=by_name,
                scheme_code=row.get("scheme_code"),
            )
            if not fund_id:
                skipped += 1
                continue

            aum_inr = crores_to_inr(row["aum_crores"])
            stmt = (
                insert(SchemeAum)
                .values(
                    fund_id=fund_id,
                    as_of_date=row.get("as_of_date") or as_of_date,
                    aum_inr=aum_inr,
                    source="AMFI_MONTHLY",
                )
                .on_conflict_do_update(
                    index_elements=["fund_id", "as_of_date"],
                    set_={"aum_inr": aum_inr, "source": "AMFI_MONTHLY"},
                )
            )
            await session.execute(stmt)
            upserted += 1

        status = IngestionRunStatus.succeeded if upserted else IngestionRunStatus.partial
        if not parsed:
            status = IngestionRunStatus.partial

        await finish_ingestion_run(
            session,
            run,
            status=status,
            records_processed=processed,
            records_inserted=upserted,
            records_skipped=skipped,
            metadata={"source_url": source_url, "as_of_date": str(as_of_date), "parsed_rows": len(parsed)},
            error_message=None if upserted else "No scheme-level AUM rows matched mutual_funds",
        )
        return {
            "processed": processed,
            "upserted": upserted,
            "skipped": skipped,
            "parsed_rows": len(parsed),
            "source_url": source_url,
            "run_uuid": str(run.run_uuid),
        }
    except Exception as exc:
        logger.exception("AMFI AUM ingestion failed")
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
