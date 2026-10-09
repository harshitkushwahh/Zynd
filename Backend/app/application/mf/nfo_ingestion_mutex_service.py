from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.mf_scheduler_jobs import build_scheduled_jobs
from app.application.mf.nfo_detection_service import NFO_JOB_NAMES
from app.infrastructure.persistence.mf_models import IngestionRunLog, IngestionRunStatus


def mf_family_job_names() -> tuple[str, ...]:
    return tuple(sorted({job.name for job in build_scheduled_jobs()} | set(NFO_JOB_NAMES)))


async def running_mf_family_jobs(session: AsyncSession) -> list[str]:
    names = mf_family_job_names()
    if not names:
        return []
    rows = (
        await session.execute(
            select(IngestionRunLog.job_name)
            .where(
                IngestionRunLog.job_name.in_(names),
                IngestionRunLog.status == IngestionRunStatus.running,
            )
            .distinct()
        )
    ).all()
    return [row[0] for row in rows]


async def mf_family_mutex_busy(session: AsyncSession) -> tuple[bool, list[str]]:
    running = await running_mf_family_jobs(session)
    return bool(running), running
