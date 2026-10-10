from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Awaitable, Callable

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.nfo_collection_assign_service import run_nfo_collection_assign_sync
from app.application.mf.nfo_lifecycle_service import run_nfo_lifecycle_sync
from app.core.config import get_settings

JobRunner = Callable[..., Awaitable[dict]]


@dataclass(frozen=True)
class ScheduledNfoJob:
    name: str
    enabled: bool
    runner: JobRunner
    description: str
    depends_on: tuple[str, ...] = ()


def build_nfo_jobs() -> list[ScheduledNfoJob]:
    settings = get_settings()
    enabled = settings.zynd_nfo_ingestion_enabled
    return [
        ScheduledNfoJob(
            name="nfo-lifecycle-sync",
            enabled=enabled,
            runner=run_nfo_lifecycle_sync,
            description="Classify NFO offers from OMS flags, NAV depth, and fund age",
        ),
        ScheduledNfoJob(
            name="nfo-collection-assign-sync",
            enabled=enabled,
            runner=run_nfo_collection_assign_sync,
            description="Assign browse category slug nfo",
            depends_on=("nfo-lifecycle-sync",),
        ),
    ]


def nfo_jobs_for_cli() -> list[dict[str, Any]]:
    settings = get_settings()
    cron = settings.zynd_nfo_fallback_cron or "0 22 * * *"
    return [
        {
            "name": job.name,
            "sequence": index,
            "phase": 1,
            "cron": cron,
            "enabled": job.enabled,
            "description": job.description,
            "depends_on": list(job.depends_on),
        }
        for index, job in enumerate(build_nfo_jobs(), start=1)
    ]
