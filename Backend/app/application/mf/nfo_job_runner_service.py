from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.ingestion_run_service import check_job_dependencies
from app.application.mf.nfo_chain_trigger_service import mark_nfo_success
from app.application.mf.nfo_ingestion_mutex_service import mf_family_mutex_busy
from app.application.mf.nfo_scheduler_jobs import build_nfo_jobs
from app.core.config import get_settings

logger = logging.getLogger(__name__)


async def execute_nfo_job(
    session: AsyncSession,
    job_name: str,
    *,
    triggered_by: str = "SCHEDULER",
    skip_dependency_check: bool = False,
    skip_mutex: bool = False,
) -> dict[str, Any]:
    jobs = {job.name: job for job in build_nfo_jobs()}
    job = jobs.get(job_name)
    if not job:
        raise ValueError(f"Unknown NFO job: {job_name}")
    if not job.enabled:
        return {"skipped": 1, "reason": "job_disabled", "job": job.name}

    if not skip_mutex:
        busy, holders = await mf_family_mutex_busy(session)
        if busy:
            return {"skipped": 1, "reason": "mutex_busy", "mutex_holders": holders, "job": job.name}

    settings = get_settings()
    if job.depends_on and settings.zynd_mf_dependency_guard_enabled and not skip_dependency_check:
        satisfied, reason = await check_job_dependencies(session, job.depends_on)
        if not satisfied:
            return {"skipped": 1, "reason": reason, "job": job.name}

    result = await job.runner(session, triggered_by=triggered_by)
    payload = dict(result)
    payload.setdefault("job", job.name)
    return payload


async def run_nfo_daily_bundle(
    session: AsyncSession,
    *,
    triggered_by: str,
    trigger_kind: str,
    skip_mutex: bool = False,
) -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    for job in build_nfo_jobs():
        result = await execute_nfo_job(
            session,
            job.name,
            triggered_by=triggered_by,
            skip_mutex=skip_mutex,
        )
        results.append(result)
        if result.get("skipped") and result.get("reason") == "mutex_busy":
            return {"ok": False, "reason": "mutex_busy", "results": results}
        if result.get("skipped") and result.get("reason") not in {"job_disabled", "nfo_disabled", "already_running"}:
            continue

    failed = any("error" in row for row in results)
    if not failed:
        await mark_nfo_success(session, trigger_kind=trigger_kind)
    return {"ok": not failed, "trigger_kind": trigger_kind, "results": results}
