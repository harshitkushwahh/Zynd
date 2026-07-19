from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.ingestion_run_service import begin_ingestion_run, finish_ingestion_run, has_running_job
from app.application.mf.invest_catalog_invalidation import notify_invest_catalog_changed
from app.application.mf.scheme_row_normalizer import normalize_scheme_row
from app.application.mf.scheme_sql_upsert_service import upsert_fund_from_normalized
from app.core.config import get_settings
from app.infrastructure.mf.fp_oms_client import list_fund_schemes
from app.infrastructure.mf.mongo_raw_store import store_raw_ingestion
from app.infrastructure.persistence.mf_models import IngestionRunStatus

logger = logging.getLogger(__name__)


async def run_cybrilla_scheme_sync(
    session: AsyncSession,
    *,
    triggered_by: str = "SCHEDULER",
) -> dict[str, int | str]:
    settings = get_settings()
    if settings.zynd_mf_scheme_staging_enabled:
        return {"skipped": 1, "reason": "use_staging_pipeline"}
    if not settings.zynd_mf_scheme_sync_enabled:
        return {"skipped": 1, "reason": "scheme_sync_disabled"}

    if await has_running_job(session, "cybrilla-scheme-sync"):
        return {"skipped": 1, "reason": "already_running"}

    run = await begin_ingestion_run(session, job_name="cybrilla-scheme-sync", triggered_by=triggered_by)
    processed = inserted = updated = skipped = 0

    try:
        if not settings.resolved_fp_enabled:
            raise RuntimeError("FP_ENABLED is false or FinPrim credentials are missing")

        page = 1
        batch_size = settings.zynd_mf_scheme_sync_batch_size
        last_page = False

        while not last_page:
            payload = await list_fund_schemes(page=page, size=batch_size)
            rows = payload.get("data") or payload.get("fund_schemes") or payload.get("objects") or []
            if not isinstance(rows, list):
                rows = []

            if page == 1:
                await store_raw_ingestion(
                    job_name="cybrilla-scheme-sync",
                    run_uuid=str(run.run_uuid),
                    payload=str(payload)[:500_000],
                    content_type="application/json",
                )

            if not rows:
                last_page = True
                break

            for raw in rows:
                if not isinstance(raw, dict):
                    skipped += 1
                    continue
                processed += 1
                normalized = normalize_scheme_row(raw)
                if not normalized:
                    skipped += 1
                    continue

                action, _, _, _ = await upsert_fund_from_normalized(session, normalized)
                if action == "inserted":
                    inserted += 1
                else:
                    updated += 1

            last_page = bool(payload.get("last") or payload.get("is_last") or len(rows) < batch_size)
            page += 1

        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.succeeded,
            records_processed=processed,
            records_inserted=inserted,
            records_skipped=skipped,
            metadata={"updated": updated, "pages": page - 1},
        )
        await notify_invest_catalog_changed(session, refresh_search_vectors=True)
        return {
            "processed": processed,
            "inserted": inserted,
            "updated": updated,
            "skipped": skipped,
            "run_uuid": str(run.run_uuid),
        }
    except Exception as exc:
        logger.exception("Cybrilla scheme sync failed")
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
