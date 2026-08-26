from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.mf_pipeline_types import STAGING_PIPELINE_JOB_KEYS
from app.infrastructure.persistence.mf_models import IngestionRunLog, IngestionRunStatus, MfSchedulerJobSkip

IST = ZoneInfo("Asia/Kolkata")


def ist_today() -> date:
    return datetime.now(IST).date()


def is_daily_cron(cron_expr: str) -> bool:
    parts = cron_expr.split()
    if len(parts) != 5:
        return False
    return parts[2] == "*"


def scheduler_job_key_for_pipeline_step(step_key: str) -> str | None:
    if step_key in STAGING_PIPELINE_JOB_KEYS:
        return step_key
    if step_key == "scheme-min-amounts-backfill-loop":
        return "scheme-min-amounts-backfill"
    if step_key in {
        "cleanup-stale-runs",
        "empanel-amcs",
        "seed-tax-compliance",
        "final-counts",
        "catalog-health",
    }:
        return None
    return step_key


async def mark_scheduler_jobs_skipped(
    session: AsyncSession,
    *,
    job_names: set[str],
    source: str,
    pipeline_run_id: str | None = None,
    skip_date: date | None = None,
) -> None:
    if not job_names:
        return
    target_date = skip_date or ist_today()
    run_uuid = uuid.UUID(pipeline_run_id) if pipeline_run_id else None
    for job_name in sorted(job_names):
        stmt = insert(MfSchedulerJobSkip).values(
            job_name=job_name,
            skip_date_ist=target_date,
            source=source,
            pipeline_run_uuid=run_uuid,
        )
        stmt = stmt.on_conflict_do_nothing(index_elements=["job_name", "skip_date_ist"])
        await session.execute(stmt)


async def is_scheduler_job_skipped_today(session: AsyncSession, job_name: str) -> bool:
    row = await session.scalar(
        select(MfSchedulerJobSkip.id).where(
            MfSchedulerJobSkip.job_name == job_name,
            MfSchedulerJobSkip.skip_date_ist == ist_today(),
        )
    )
    return row is not None


async def count_stuck_ingestion_runs(session: AsyncSession, *, threshold_hours: int) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=threshold_hours)
    rows = await session.scalars(
        select(IngestionRunLog.id).where(
            IngestionRunLog.status == IngestionRunStatus.running,
            IngestionRunLog.started_at < cutoff,
        )
    )
    return len(list(rows))
