from __future__ import annotations

import inspect
import logging
import time
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.ingestion_run_service import check_job_dependencies
from app.application.mf.mf_scheduler_jobs import build_scheduled_jobs
from app.core.config import get_settings

logger = logging.getLogger(__name__)


async def _invoke_runner(
    runner,
    session: AsyncSession,
    *,
    triggered_by: str,
    job_kwargs: dict[str, Any] | None = None,
) -> dict[str, Any]:
    signature = inspect.signature(runner)
    kwargs: dict[str, Any] = {}
    if "triggered_by" in signature.parameters:
        kwargs["triggered_by"] = triggered_by
    for key, value in (job_kwargs or {}).items():
        if key in signature.parameters:
            kwargs[key] = value
    return await runner(session, **kwargs)


async def execute_mf_job(
    session: AsyncSession,
    job_name: str,
    *,
    triggered_by: str = "SCHEDULER",
    skip_dependency_check: bool = False,
    job_kwargs: dict[str, Any] | None = None,
) -> dict[str, Any]:
    jobs = {job.name: job for job in build_scheduled_jobs()}
    job = jobs.get(job_name)
    if not job:
        raise ValueError(f"Unknown MF job: {job_name}")

    if not job.enabled:
        return {"skipped": 1, "reason": "job_disabled", "phase": job.phase, "job": job.name}

    settings = get_settings()
    if job.depends_on and settings.zynd_mf_dependency_guard_enabled and not skip_dependency_check:
        satisfied, reason = await check_job_dependencies(
            session,
            job.depends_on,
            lookback_hours=settings.zynd_mf_dependency_lookback_hours,
        )
        if not satisfied:
            logger.info(
                "MF job skipped due to dependency guard job=%s reason=%s depends_on=%s",
                job.name,
                reason,
                job.depends_on,
            )
            return {
                "skipped": 1,
                "reason": reason,
                "job": job.name,
                "depends_on": list(job.depends_on),
            }

    started = time.perf_counter()
    try:
        result = await _invoke_runner(job.runner, session, triggered_by=triggered_by, job_kwargs=job_kwargs)
    except Exception:
        duration = time.perf_counter() - started
        logger.exception("MF job failed job=%s duration=%.2fs", job.name, duration)
        raise

    duration = time.perf_counter() - started
    payload = dict(result)
    payload.setdefault("job", job.name)
    payload["duration_seconds"] = round(duration, 3)
    logger.info("MF job finished job=%s duration=%.2fs result=%s", job.name, duration, payload)
    return payload
