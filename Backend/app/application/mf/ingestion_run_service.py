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


# A live download updates progress well inside this window. The fetch timeout is 60s.
INGESTION_RUNNING_FRESH_MINUTES = 5


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def progress_is_fresh(
    *,
    last_progress_at: datetime | None,
    activity_at: datetime | None,
    started_at: datetime | None,
    now: datetime | None = None,
    fresh_minutes: int = INGESTION_RUNNING_FRESH_MINUTES,
) -> bool:
    """True when a running ingestion has reported progress recently.

    `started_at` is only a fallback for a job that has not logged a window yet.
    A long backfill stays fresh from its latest log, not from when it began.
    """
    current = now or datetime.now(timezone.utc)
    marks = [mark for mark in (last_progress_at, activity_at) if mark is not None]
    if not marks and started_at is not None:
        marks = [started_at]
    if not marks:
        return False
    latest = max(_as_utc(mark) for mark in marks)
    return current - latest < timedelta(minutes=fresh_minutes)


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


async def latest_running_job(session: AsyncSession, job_name: str) -> IngestionRunLog | None:
    return await session.scalar(
        select(IngestionRunLog)
        .where(
            IngestionRunLog.job_name == job_name,
            IngestionRunLog.status == IngestionRunStatus.running,
        )
        .order_by(desc(IngestionRunLog.started_at))
        .limit(1)
    )


async def running_job_is_fresh(
    session: AsyncSession,
    job_name: str,
    *,
    activity_at: datetime | None,
) -> bool:
    row = await latest_running_job(session, job_name)
    if row is None:
        return False
    last_progress_at = None
    raw = (row.metadata_ or {}).get("last_progress_at")
    if raw:
        try:
            last_progress_at = datetime.fromisoformat(str(raw))
        except ValueError:
            last_progress_at = None
    return progress_is_fresh(
        last_progress_at=last_progress_at,
        activity_at=activity_at,
        started_at=row.started_at,
    )


async def abandon_running_jobs(
    session: AsyncSession,
    job_name: str,
    *,
    reason: str,
    resume_from: str | None = None,
) -> int:
    rows = list(
        await session.scalars(
            select(IngestionRunLog).where(
                IngestionRunLog.job_name == job_name,
                IngestionRunLog.status == IngestionRunStatus.running,
            )
        )
    )
    now = datetime.now(timezone.utc)
    for row in rows:
        metadata = dict(row.metadata_ or {})
        if resume_from and not metadata.get("resume_from"):
            metadata["resume_from"] = resume_from
            row.metadata_ = metadata
        row.status = IngestionRunStatus.failed
        row.finished_at = now
        row.error_message = reason
    if rows:
        logger.warning("Abandoned %s running %s ingestion run(s): %s", len(rows), job_name, reason)
    return len(rows)


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
            # No recent run. Upstream data may still be present from an older
            # run (for example a scheme promote approved by an admin last week
            # while ZYND_MF_SCHEME_PROMOTE_AUTO=false). Only block when the
            # dependency has never produced a successful run at all, otherwise
            # a manual-approval step would silently stall every daily job.
            ever = await latest_run_for_job(session, dep)
            if ever is None:
                return False, f"dependency_never_run:{dep}"
            if ever.status == IngestionRunStatus.running:
                return False, f"dependency_running:{dep}"
            if ever.status != IngestionRunStatus.succeeded:
                return False, f"dependency_failed:{dep}"
            continue
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
