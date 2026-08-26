from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.mf_pipeline_store import get_pipeline_run, state_from_row
from app.application.mf.mf_pipeline_types import MfPipelineRunState, MfPipelineRunStatus
from app.application.mf.mf_scheduler_skip_service import count_stuck_ingestion_runs
from app.application.mf.scheme_staging_promote_service import _batch_ready_for_promote
from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.infrastructure.mf.scheme_staging_store import BATCH_STATUS_APPROVED, get_batch
from app.infrastructure.persistence.mf_models import MfPipelineRun, MfPipelineRunStatus as DbMfPipelineRunStatus

logger = logging.getLogger(__name__)


async def _staging_batch_ready(batch_uuid: str) -> bool:
    batch = await get_batch(batch_uuid)
    if not batch:
        return False
    if batch.get("status") == BATCH_STATUS_APPROVED:
        return True
    ready, _ = _batch_ready_for_promote(batch, auto_promote=False)
    return ready


async def is_run_ready_for_auto_resume(session: AsyncSession, run: MfPipelineRunState) -> bool:
    if run.status != MfPipelineRunStatus.paused:
        return False
    if run.context.get("auto_resume", True) is False:
        return False

    settings = get_settings()
    attempts = int(run.context.get("auto_resume_attempts") or 0)
    if attempts >= settings.zynd_mf_pipeline_auto_resume_max_attempts:
        return False

    pause_reason = run.context.get("pause_reason")
    if pause_reason != "awaiting_staging_approval":
        return False

    batch_uuid = run.context.get("batch_uuid")
    if not batch_uuid:
        return False

    settings = get_settings()
    stuck_count = await count_stuck_ingestion_runs(
        session,
        threshold_hours=settings.zynd_mf_stale_run_cleanup_threshold_hours,
    )
    if stuck_count:
        return False

    running = await session.scalar(
        select(MfPipelineRun.id)
        .where(MfPipelineRun.status == DbMfPipelineRunStatus.running)
        .limit(1)
    )
    if running is not None:
        return False

    return await _staging_batch_ready(str(batch_uuid))


async def find_paused_pipeline_run_for_batch(session: AsyncSession, batch_uuid: str) -> MfPipelineRunState | None:
    rows = await session.scalars(
        select(MfPipelineRun)
        .where(MfPipelineRun.status == DbMfPipelineRunStatus.paused)
        .order_by(desc(MfPipelineRun.updated_at))
        .limit(20)
    )
    for row in rows:
        run = state_from_row(row)
        if run.context.get("batch_uuid") == batch_uuid and run.context.get("pause_reason") == "awaiting_staging_approval":
            return run
    return None


async def try_auto_resume_pipeline_run(run_id: str, *, source: str) -> bool:
    settings = get_settings()
    if not settings.zynd_mf_pipeline_auto_resume_enabled:
        return False

    async with AsyncSessionLocal() as session:
        run = await get_pipeline_run(session, run_id)
        if not run or not await is_run_ready_for_auto_resume(session, run):
            return False
        run.context["auto_resume_attempts"] = int(run.context.get("auto_resume_attempts") or 0) + 1
        run.context["last_auto_resume_source"] = source
        run.context["last_auto_resume_at"] = datetime.now(timezone.utc).isoformat()
        from app.application.mf.mf_pipeline_store import save_pipeline_run

        await save_pipeline_run(session, run)
        await session.commit()

    from app.application.mf.mf_pipeline_orchestrator_service import resume_mf_pipeline_run

    try:
        await resume_mf_pipeline_run(run_id)
    except RuntimeError:
        logger.info("Auto-resume skipped for run=%s source=%s (blocker still active)", run_id, source)
        return False

    logger.info("Auto-resumed MF pipeline run=%s source=%s", run_id, source)
    return True


async def try_auto_resume_for_batch(batch_uuid: str, *, source: str = "staging_approve") -> bool:
    async with AsyncSessionLocal() as session:
        run = await find_paused_pipeline_run_for_batch(session, batch_uuid)
        if not run:
            return False
    return await try_auto_resume_pipeline_run(run.run_id, source=source)


async def try_auto_resume_latest_eligible(*, source: str) -> bool:
    from app.application.mf.mf_pipeline_store import get_latest_resumable_pipeline_run

    async with AsyncSessionLocal() as session:
        run = await get_latest_resumable_pipeline_run(session)
        if not run:
            return False
    return await try_auto_resume_pipeline_run(run.run_id, source=source)
