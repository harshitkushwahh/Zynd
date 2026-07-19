from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.catalog_lifecycle_service import sync_product_lifecycle
from app.application.mf.ingestion_run_service import begin_ingestion_run, finish_ingestion_run, has_running_job
from app.application.mf.invest_catalog_invalidation import notify_invest_catalog_changed
from app.core.config import get_settings
from app.infrastructure.persistence.mf_models import IngestionRunStatus

logger = logging.getLogger(__name__)


async def run_catalog_lifecycle_sync(
    session: AsyncSession,
    *,
    triggered_by: str = "SCHEDULER",
) -> dict[str, int | str]:
    settings = get_settings()
    if not settings.zynd_mf_catalog_lifecycle_enabled:
        return {"skipped": 1, "reason": "catalog_lifecycle_disabled"}

    if await has_running_job(session, "catalog-lifecycle-sync"):
        return {"skipped": 1, "reason": "already_running"}

    run = await begin_ingestion_run(session, job_name="catalog-lifecycle-sync", triggered_by=triggered_by)
    try:
        result = await sync_product_lifecycle(session)
        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.succeeded,
            records_processed=int(result["processed"]),
            records_inserted=int(result["activated"]),
            records_skipped=int(result["unchanged"]),
            metadata={
                "deactivated": result["deactivated"],
                "activated": result["activated"],
            },
        )
        await notify_invest_catalog_changed(session)
        return {**result, "run_uuid": str(run.run_uuid)}
    except Exception as exc:
        logger.exception("Catalog lifecycle sync failed")
        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.failed,
            error_message=str(exc),
        )
        raise
