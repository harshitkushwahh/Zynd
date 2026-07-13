from __future__ import annotations

import logging

from datetime import date

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.amfi_parsers import crores_to_inr, parse_aaum_json_blocks, quarter_end_from_period_label
from app.application.mf.enrichment_match_service import build_fund_match_indexes, resolve_fund_id
from app.application.mf.ingestion_run_service import begin_ingestion_run, finish_ingestion_run, has_running_job
from app.core.config import get_settings
from app.infrastructure.mf.amfi_client import discover_aaum_fy_and_period, fetch_aaum_schemewise_json
from app.infrastructure.mf.mongo_raw_store import store_raw_ingestion
from app.infrastructure.persistence.mf_models import IngestionRunStatus, SchemeAum

logger = logging.getLogger(__name__)


async def run_amfi_aaum_ingestion(
    session: AsyncSession,
    *,
    triggered_by: str = "SCHEDULER",
) -> dict[str, int | str]:
    settings = get_settings()
    if not settings.zynd_mf_aaum_enabled:
        return {"skipped": 1, "reason": "aaum_ingestion_disabled", "phase": 3}

    if await has_running_job(session, "amfi-aaum-quarterly"):
        return {"skipped": 1, "reason": "already_running"}

    run = await begin_ingestion_run(session, job_name="amfi-aaum-quarterly", triggered_by=triggered_by)
    processed = upserted = skipped = 0

    try:
        str_type = settings.zynd_mf_aaum_str_type
        fy_raw = settings.zynd_mf_aaum_fy_id.strip()
        period_raw = settings.zynd_mf_aaum_period_id.strip()
        if fy_raw.isdigit() and period_raw.isdigit():
            fy_id = int(fy_raw)
            period_id = int(period_raw)
            fy_label = ""
            period_label = ""
        else:
            fy_id, period_id, fy_label, period_label = await discover_aaum_fy_and_period(str_type=str_type)

        blocks = await fetch_aaum_schemewise_json(str_type=str_type, fy_id=fy_id, period_id=period_id)
        parsed = parse_aaum_json_blocks(blocks)
        await store_raw_ingestion(
            job_name="amfi-aaum-quarterly",
            run_uuid=str(run.run_uuid),
            payload=str({"fy_id": fy_id, "period_id": period_id, "rows": len(parsed)})[:500_000],
            content_type="application/json",
        )

        if not parsed:
            raise ValueError("No AAUM scheme rows parsed from AMFI JSON")

        as_of_date = quarter_end_from_period_label(period_label) if period_label else date.today()
        by_code, by_name = await build_fund_match_indexes(session)

        for row in parsed:
            processed += 1
            fund_id = resolve_fund_id(
                by_scheme_code=by_code,
                by_name=by_name,
                scheme_code=row.get("scheme_code"),
                scheme_name=row.get("scheme_name"),
            )
            if not fund_id:
                skipped += 1
                continue

            aum_inr = crores_to_inr(row["aum_crores"])
            stmt = (
                insert(SchemeAum)
                .values(
                    fund_id=fund_id,
                    as_of_date=as_of_date,
                    aum_inr=aum_inr,
                    source="AMFI_AAUM",
                )
                .on_conflict_do_update(
                    index_elements=["fund_id", "as_of_date"],
                    set_={"aum_inr": aum_inr, "source": "AMFI_AAUM"},
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
            metadata={
                "fy_id": fy_id,
                "period_id": period_id,
                "period_label": period_label,
                "as_of_date": str(as_of_date),
            },
        )
        return {
            "processed": processed,
            "upserted": upserted,
            "skipped": skipped,
            "fy_id": fy_id,
            "period_id": period_id,
            "run_uuid": str(run.run_uuid),
        }
    except Exception as exc:
        logger.exception("AMFI AAUM ingestion failed")
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
