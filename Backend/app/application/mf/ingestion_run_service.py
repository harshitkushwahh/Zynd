from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import desc, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.mf_models import IngestionRunLog, IngestionRunStatus

logger = logging.getLogger(__name__)


async def begin_ingestion_run(
    session: AsyncSession,
    *,
    job_name: str,
    triggered_by: str = "SCHEDULER",
) -> IngestionRunLog:
    run = IngestionRunLog(
        run_uuid=uuid.uuid4(),
        job_name=job_name,
        status=IngestionRunStatus.running,
        triggered_by=triggered_by,
    )
    session.add(run)
    await session.flush()
    return run


async def finish_ingestion_run(
    session: AsyncSession,
    run: IngestionRunLog,
    *,
    status: IngestionRunStatus,
    records_processed: int = 0,
    records_inserted: int = 0,
    records_skipped: int = 0,
    error_message: str | None = None,
    metadata: dict | None = None,
) -> None:
    run.status = status
    run.finished_at = datetime.now(timezone.utc)
    run.records_processed = records_processed
    run.records_inserted = records_inserted
    run.records_skipped = records_skipped
    run.error_message = error_message
    run.metadata_ = metadata


async def cleanup_stale_runs(session: AsyncSession, *, threshold_hours: int) -> int:
    cutoff = datetime.now(timezone.utc).replace(microsecond=0)
    from datetime import timedelta

    cutoff = cutoff - timedelta(hours=threshold_hours)
    result = await session.execute(
        update(IngestionRunLog)
        .where(
            IngestionRunLog.status == IngestionRunStatus.running,
            IngestionRunLog.started_at < cutoff,
        )
        .values(
            status=IngestionRunStatus.failed,
            finished_at=datetime.now(timezone.utc),
            error_message="Marked failed by stale run cleanup",
        )
    )
    count = result.rowcount or 0
    if count:
        logger.warning("Cleaned up %s stale MF ingestion runs", count)
    return count


async def has_running_job(session: AsyncSession, job_name: str) -> bool:
    row = await session.scalar(
        select(IngestionRunLog.id)
        .where(
            IngestionRunLog.job_name == job_name,
            IngestionRunLog.status == IngestionRunStatus.running,
        )
        .limit(1)
    )
    return row is not None


async def latest_run_for_job(
    session: AsyncSession,
    job_name: str,
    *,
    since: datetime | None = None,
) -> IngestionRunLog | None:
    stmt = (
        select(IngestionRunLog)
        .where(IngestionRunLog.job_name == job_name)
        .order_by(desc(IngestionRunLog.started_at))
        .limit(1)
    )
    if since is not None:
        stmt = stmt.where(IngestionRunLog.started_at >= since)
    return await session.scalar(stmt)


async def latest_successful_run(
    session: AsyncSession,
    job_name: str,
    *,
    since: datetime | None = None,
) -> IngestionRunLog | None:
    stmt = (
        select(IngestionRunLog)
        .where(
            IngestionRunLog.job_name == job_name,
            IngestionRunLog.status == IngestionRunStatus.succeeded,
        )
        .order_by(desc(IngestionRunLog.finished_at))
        .limit(1)
    )
    if since is not None:
        stmt = stmt.where(IngestionRunLog.started_at >= since)
    return await session.scalar(stmt)


async def check_job_dependencies(
    session: AsyncSession,
    depends_on: tuple[str, ...],
    *,
    lookback_hours: int = 24,
) -> tuple[bool, str | None]:
    """Return (satisfied, reason) for upstream MF jobs."""
    if not depends_on:
        return True, None

    cutoff = datetime.now(timezone.utc) - timedelta(hours=max(lookback_hours, 1))
    for dep in depends_on:
        latest = await latest_run_for_job(session, dep, since=cutoff)
        if latest is None:
            return False, f"dependency_not_run:{dep}"
        if latest.status == IngestionRunStatus.running:
            return False, f"dependency_running:{dep}"
        if latest.status != IngestionRunStatus.succeeded:
            return False, f"dependency_failed:{dep}"
    return True, None


async def list_recent_runs(
    session: AsyncSession,
    *,
    job_name: str | None = None,
    limit: int = 50,
) -> list[IngestionRunLog]:
    stmt = select(IngestionRunLog).order_by(desc(IngestionRunLog.started_at)).limit(limit)
    if job_name:
        stmt = stmt.where(IngestionRunLog.job_name == job_name)
    result = await session.execute(stmt)
    return list(result.scalars())
