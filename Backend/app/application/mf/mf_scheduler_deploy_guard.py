from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.mf_pipeline_store import list_running_pipeline_runs
from app.infrastructure.persistence.mf_models import IngestionRunLog, IngestionRunStatus

SCHEDULER_WORKER = "mf-scheduler"


async def live_mf_scheduler_work(session: AsyncSession) -> tuple[bool, list[str]]:
    """True when recreating the MF scheduler would kill a live job."""
    reasons: list[str] = []
    jobs = list(
        await session.scalars(
            select(IngestionRunLog.job_name).where(IngestionRunLog.status == IngestionRunStatus.running)
        )
    )
    for name in sorted({str(job) for job in jobs}):
        reasons.append(f"ingestion:{name}")
    for run in await list_running_pipeline_runs(session):
        step = run.current_step_key or "queued"
        reasons.append(f"pipeline:{run.run_id}:{step}")
    return bool(reasons), reasons


def worker_should_skip_recreate(worker: str, *, busy: bool) -> bool:
    return worker == SCHEDULER_WORKER and busy
