from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.ingestion_run_service import abandon_running_jobs, has_running_job, running_job_is_fresh
from app.application.mf.mf_pipeline_types import (
    INTERRUPTED_PIPELINE_MESSAGE,
    JOB_STILL_RUNNING_MESSAGE,
    MfPipelineLogLine,
    MfPipelineRunState,
    MfPipelineRunStatus,
    MfPipelineStepState,
    MfPipelineStepStatus,
    PAUSE_REASON_JOB_STILL_RUNNING,
)
from app.application.mf.nav_cold_start_backfill_service import cold_start_resume_date_from_logs
from app.infrastructure.persistence.mf_models import MfPipelineRun, MfPipelineRunStatus as DbMfPipelineRunStatus

MAX_STORED_LOG_LINES = 500


def _dt_to_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat()


def _iso_to_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value)


def state_from_row(row: MfPipelineRun) -> MfPipelineRunState:
    steps = [
        MfPipelineStepState(
            key=step["key"],
            label=step["label"],
            status=MfPipelineStepStatus(step["status"]),
            result=step.get("result"),
            error=step.get("error"),
            ingestion_run_uuid=step.get("ingestion_run_uuid"),
        )
        for step in (row.steps or [])
    ]
    logs = [
        MfPipelineLogLine(timestamp=line["timestamp"], level=line["level"], message=line["message"])
        for line in (row.logs or [])
    ]
    return MfPipelineRunState(
        run_id=str(row.run_uuid),
        mode=row.mode,
        triggered_by=row.triggered_by,
        status=MfPipelineRunStatus(row.status.value),
        started_at=_dt_to_iso(row.started_at),
        finished_at=_dt_to_iso(row.finished_at),
        current_step_key=row.current_step_key,
        steps=steps,
        logs=logs,
        final_counts=row.final_counts,
        health_summary=row.health_summary,
        error=row.error,
        _cancel_requested=row.cancel_requested,
        context=dict(row.context or {}),
    )


def _serialize_steps(steps: list[MfPipelineStepState]) -> list[dict[str, Any]]:
    return [step.to_dict() for step in steps]


def _serialize_logs(logs: list[MfPipelineLogLine]) -> list[dict[str, str]]:
    return [line.to_dict() for line in logs[-MAX_STORED_LOG_LINES:]]


async def save_pipeline_run(session: AsyncSession, run: MfPipelineRunState) -> None:
    row = await session.scalar(select(MfPipelineRun).where(MfPipelineRun.run_uuid == uuid.UUID(run.run_id)))
    if row is None:
        raise ValueError(f"Pipeline run not found: {run.run_id}")

    row.mode = run.mode
    row.triggered_by = run.triggered_by
    row.status = DbMfPipelineRunStatus(run.status.value)
    row.started_at = _iso_to_dt(run.started_at)
    row.finished_at = _iso_to_dt(run.finished_at)
    row.current_step_key = run.current_step_key
    row.context = dict(run.context or {})
    row.steps = _serialize_steps(run.steps)
    row.logs = _serialize_logs(run.logs)
    row.final_counts = run.final_counts
    row.health_summary = run.health_summary
    row.error = run.error
    row.cancel_requested = run._cancel_requested
    await session.flush()


async def create_pipeline_run(
    session: AsyncSession,
    *,
    mode: str,
    triggered_by: str,
    steps: list[MfPipelineStepState],
) -> MfPipelineRunState:
    run_uuid = uuid.uuid4()
    row = MfPipelineRun(
        run_uuid=run_uuid,
        mode=mode,
        triggered_by=triggered_by,
        status=DbMfPipelineRunStatus.pending,
        steps=_serialize_steps(steps),
        logs=[],
        context={},
    )
    session.add(row)
    await session.flush()
    return state_from_row(row)


async def get_pipeline_run(session: AsyncSession, run_id: str) -> MfPipelineRunState | None:
    row = await session.scalar(select(MfPipelineRun).where(MfPipelineRun.run_uuid == uuid.UUID(run_id)))
    return state_from_row(row) if row else None


def _mode_family_filter(*, nfo_only: bool | None):
    if nfo_only is True:
        return MfPipelineRun.mode.like("nfo%")
    if nfo_only is False:
        return ~MfPipelineRun.mode.like("nfo%")
    return None


async def get_running_pipeline_run(
    session: AsyncSession,
    *,
    nfo_only: bool | None = None,
) -> MfPipelineRunState | None:
    query = select(MfPipelineRun).where(MfPipelineRun.status == DbMfPipelineRunStatus.running)
    family = _mode_family_filter(nfo_only=nfo_only)
    if family is not None:
        query = query.where(family)
    row = await session.scalar(query.order_by(desc(MfPipelineRun.started_at)).limit(1))
    return state_from_row(row) if row else None


async def list_running_pipeline_runs(session: AsyncSession) -> list[MfPipelineRunState]:
    rows = await session.scalars(
        select(MfPipelineRun)
        .where(MfPipelineRun.status == DbMfPipelineRunStatus.running)
        .order_by(MfPipelineRun.started_at.asc())
    )
    return [state_from_row(row) for row in rows]


async def pipeline_cancel_requested(session: AsyncSession, run_id: str) -> bool:
    return bool(
        await session.scalar(
            select(MfPipelineRun.cancel_requested).where(MfPipelineRun.run_uuid == uuid.UUID(run_id))
        )
    )


def pipeline_run_awaits_worker(run: MfPipelineRunState) -> bool:
    """True when the API queued the run and no step is mid-execution."""
    if run.status != MfPipelineRunStatus.running:
        return False
    if not run.current_step_key:
        return True
    step = next((item for item in run.steps if item.key == run.current_step_key), None)
    if step is None:
        return True
    return step.status in {
        MfPipelineStepStatus.pending,
        MfPipelineStepStatus.succeeded,
        MfPipelineStepStatus.skipped,
    }


def running_pipeline_blocks_new_start(run: MfPipelineRunState | None) -> bool:
    """Queued cancel leftovers must not block Dry run or Auto run."""
    if run is None or run.status != MfPipelineRunStatus.running:
        return False
    if run._cancel_requested and pipeline_run_awaits_worker(run):
        return False
    return True


async def get_latest_resumable_pipeline_run(
    session: AsyncSession,
    *,
    nfo_only: bool | None = None,
) -> MfPipelineRunState | None:
    query = select(MfPipelineRun).where(
        MfPipelineRun.status.in_(
            [DbMfPipelineRunStatus.paused, DbMfPipelineRunStatus.failed, DbMfPipelineRunStatus.cancelled]
        )
    )
    family = _mode_family_filter(nfo_only=nfo_only)
    if family is not None:
        query = query.where(family)
    rows = await session.scalars(query.order_by(desc(MfPipelineRun.updated_at)).limit(8))
    for row in rows:
        run = state_from_row(row)
        if run.status in {MfPipelineRunStatus.cancelled, MfPipelineRunStatus.failed} and not run.has_started_a_step():
            continue
        return run
    return None


async def get_latest_visible_pipeline_run(
    session: AsyncSession,
    *,
    nfo_only: bool | None = None,
) -> MfPipelineRunState | None:
    query = select(MfPipelineRun).where(
        MfPipelineRun.status.in_(
            [DbMfPipelineRunStatus.paused, DbMfPipelineRunStatus.failed, DbMfPipelineRunStatus.cancelled]
        )
    )
    family = _mode_family_filter(nfo_only=nfo_only)
    if family is not None:
        query = query.where(family)
    row = await session.scalar(query.order_by(desc(MfPipelineRun.updated_at)).limit(1))
    return state_from_row(row) if row else None


def latest_pipeline_activity(run: MfPipelineRunState) -> datetime | None:
    if not run.logs:
        return None
    try:
        return datetime.fromisoformat(run.logs[-1].timestamp)
    except ValueError:
        return None


async def latest_cold_start_resume_date(
    session: AsyncSession,
    *,
    exclude_run_id: str | None = None,
) -> date | None:
    rows = await session.scalars(select(MfPipelineRun).order_by(desc(MfPipelineRun.updated_at)).limit(8))
    for row in rows:
        if exclude_run_id and str(row.run_uuid) == exclude_run_id:
            continue
        cursor = cold_start_resume_date_from_logs(
            [line.get("message", "") for line in (row.logs or []) if isinstance(line, dict)]
        )
        if cursor is not None:
            return cursor
    return None


def _cold_start_resume_from(run: MfPipelineRunState) -> str | None:
    if run.current_step_key != "nav-cold-start-backfill":
        return None
    cursor = cold_start_resume_date_from_logs([line.message for line in run.logs])
    return cursor.isoformat() if cursor else None


async def recover_interrupted_pipeline_runs(
    session: AsyncSession,
    *,
    leave_queued: bool = False,
) -> int:
    """Pause pipelines whose worker died.

    A step whose ingestion job is still reporting progress is paused without a
    Resume button. Clicking Resume while that job is live used to skip the step.
    A stale running row is closed so a later Resume can continue the step.

    When ``leave_queued`` is true, runs that the API handed to the scheduler
    but that have not started a step stay ``running`` so the worker can claim
    them. Mid-step work is still paused because this process just started.
    """
    rows = list(
        await session.scalars(
            select(MfPipelineRun).where(MfPipelineRun.status == DbMfPipelineRunStatus.running)
        )
    )
    now = datetime.now(timezone.utc)
    recovered = 0
    for row in rows:
        run = state_from_row(row)
        if leave_queued and pipeline_run_awaits_worker(run):
            continue
        waiting = False
        step_key = run.current_step_key
        if step_key and await has_running_job(session, step_key):
            fresh = await running_job_is_fresh(
                session,
                step_key,
                activity_at=latest_pipeline_activity(run),
            )
            if fresh:
                waiting = True
            else:
                await abandon_running_jobs(
                    session,
                    step_key,
                    reason="Orphaned by server restart",
                    resume_from=_cold_start_resume_from(run),
                )
        elif step_key:
            await abandon_running_jobs(
                session,
                step_key,
                reason="Orphaned by server restart",
                resume_from=_cold_start_resume_from(run),
            )
        run.status = MfPipelineRunStatus.paused
        run.finished_at = now.isoformat()
        if waiting:
            run.error = JOB_STILL_RUNNING_MESSAGE
            run.context["pause_reason"] = PAUSE_REASON_JOB_STILL_RUNNING
        else:
            run.error = INTERRUPTED_PIPELINE_MESSAGE
            if run.context.get("pause_reason") == PAUSE_REASON_JOB_STILL_RUNNING:
                run.context.pop("pause_reason", None)
        await save_pipeline_run(session, run)
        recovered += 1
    return recovered


async def get_pipeline_run_metrics(session: AsyncSession) -> dict[str, float | int | str | None]:
    latest_success = await session.scalar(
        select(MfPipelineRun)
        .where(MfPipelineRun.status == DbMfPipelineRunStatus.succeeded)
        .order_by(desc(MfPipelineRun.finished_at))
        .limit(1)
    )
    latest_failure = await session.scalar(
        select(MfPipelineRun)
        .where(MfPipelineRun.status.in_([DbMfPipelineRunStatus.failed, DbMfPipelineRunStatus.paused]))
        .order_by(desc(MfPipelineRun.finished_at))
        .limit(1)
    )
    running_count = await session.scalar(
        select(func.count())
        .select_from(MfPipelineRun)
        .where(MfPipelineRun.status == DbMfPipelineRunStatus.running)
    )

    def _duration_seconds(row: MfPipelineRun | None) -> float | None:
        if row is None or row.started_at is None or row.finished_at is None:
            return None
        return max((row.finished_at - row.started_at).total_seconds(), 0.0)

    success_ts = latest_success.finished_at.timestamp() if latest_success and latest_success.finished_at else 0.0
    failure_ts = latest_failure.finished_at.timestamp() if latest_failure and latest_failure.finished_at else 0.0
    return {
        "last_success_timestamp": success_ts,
        "last_success_duration_seconds": _duration_seconds(latest_success) or 0.0,
        "last_failure_timestamp": failure_ts,
        "running_count": int(running_count or 0),
        "last_success_mode": latest_success.mode if latest_success else None,
    }
