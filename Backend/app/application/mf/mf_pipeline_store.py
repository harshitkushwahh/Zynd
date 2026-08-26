from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.mf_pipeline_types import (
    MfPipelineLogLine,
    MfPipelineRunState,
    MfPipelineRunStatus,
    MfPipelineStepState,
    MfPipelineStepStatus,
)
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


async def get_running_pipeline_run(session: AsyncSession) -> MfPipelineRunState | None:
    row = await session.scalar(
        select(MfPipelineRun)
        .where(MfPipelineRun.status == DbMfPipelineRunStatus.running)
        .order_by(desc(MfPipelineRun.started_at))
        .limit(1)
    )
    return state_from_row(row) if row else None


async def get_latest_resumable_pipeline_run(session: AsyncSession) -> MfPipelineRunState | None:
    row = await session.scalar(
        select(MfPipelineRun)
        .where(
            MfPipelineRun.status.in_(
                [DbMfPipelineRunStatus.paused, DbMfPipelineRunStatus.failed, DbMfPipelineRunStatus.cancelled]
            )
        )
        .order_by(desc(MfPipelineRun.updated_at))
        .limit(1)
    )
    return state_from_row(row) if row else None


async def recover_interrupted_pipeline_runs(session: AsyncSession) -> int:
    result = await session.execute(
        update(MfPipelineRun)
        .where(MfPipelineRun.status == DbMfPipelineRunStatus.running)
        .values(
            status=DbMfPipelineRunStatus.paused,
            error="Interrupted by server restart — resume to continue",
            finished_at=datetime.now(timezone.utc),
        )
    )
    return result.rowcount or 0


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
