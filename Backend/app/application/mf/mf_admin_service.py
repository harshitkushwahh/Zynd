from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.ingestion_run_service import latest_run_for_job, list_recent_runs
from app.application.mf.mf_scheduler_jobs import build_scheduled_jobs, list_jobs_for_cli
from app.application.mf.mf_job_runner_service import execute_mf_job
from app.infrastructure.persistence.mf_models import IngestionRunLog, IngestionRunStatus


def _serialize_run(run: IngestionRunLog | None) -> dict | None:
    if run is None:
        return None
    return {
        "job_name": run.job_name,
        "run_uuid": str(run.run_uuid),
        "status": run.status.value if hasattr(run.status, "value") else str(run.status),
        "triggered_by": run.triggered_by,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "finished_at": run.finished_at.isoformat() if run.finished_at else None,
        "records_processed": run.records_processed,
        "records_inserted": run.records_inserted,
        "records_skipped": run.records_skipped,
        "error_message": run.error_message,
        "metadata": run.metadata_,
    }


async def list_mf_jobs_with_status(session: AsyncSession) -> list[dict]:
    jobs = list_jobs_for_cli()
    payload: list[dict] = []
    for job in jobs:
        latest = await latest_run_for_job(session, job["name"])
        payload.append({**job, "last_run": _serialize_run(latest)})
    return payload


async def trigger_mf_job(
    session: AsyncSession,
    job_name: str,
    *,
    triggered_by: str = "ADMIN",
    skip_dependency_check: bool = False,
) -> dict:
    known = {job.name for job in build_scheduled_jobs()}
    if job_name not in known:
        raise ValueError(f"Unknown MF job: {job_name}")
    return await execute_mf_job(
        session,
        job_name,
        triggered_by=triggered_by,
        skip_dependency_check=skip_dependency_check,
    )


async def list_mf_ingestion_runs(
    session: AsyncSession,
    *,
    job_name: str | None = None,
    limit: int = 50,
) -> list[dict]:
    runs = await list_recent_runs(session, job_name=job_name, limit=limit)
    return [_serialize_run(run) for run in runs if run is not None]
