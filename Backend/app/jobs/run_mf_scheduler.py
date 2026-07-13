from __future__ import annotations

import argparse
import asyncio
import json
import logging
from datetime import date, datetime, timezone

from app.application.mf.mf_scheduler_jobs import build_scheduled_jobs, job_due, list_jobs_for_cli, run_job_once
from app.application.mf.mf_job_runner_service import execute_mf_job
from app.application.mf.nav_cold_start_backfill_service import needs_cold_start_backfill, run_nav_cold_start_backfill
from app.core.config import get_settings
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


async def _run_due_jobs() -> list[dict]:
    results: list[dict] = []
    now = datetime.now(timezone.utc)
    for job in build_scheduled_jobs():
        if not job.enabled:
            continue
        if not job_due(job.cron, now=now):
            continue
        logger.info("MF scheduler running job=%s cron=%s", job.name, job.cron)
        async with AsyncSessionLocal() as session:
            try:
                result = await execute_mf_job(session, job.name, triggered_by="SCHEDULER")
                await session.commit()
                results.append({"job": job.name, "ok": True, "result": result})
            except Exception as exc:
                await session.rollback()
                logger.exception("MF job failed job=%s", job.name)
                results.append({"job": job.name, "ok": False, "error": str(exc)})
    return results


async def _maybe_run_cold_start_on_startup() -> dict | None:
    settings = get_settings()
    if not settings.zynd_mf_cold_start_on_startup:
        return None
    if not settings.zynd_mf_cold_start_backfill_enabled:
        return None

    async with AsyncSessionLocal() as session:
        needed, stats = await needs_cold_start_backfill(session)
        if not needed:
            logger.info("Cold-start backfill not needed on startup: %s", stats)
            return {"skipped": 1, "reason": "not_needed", **stats}

        logger.info("Cold-start backfill triggered on startup: %s", stats)
        try:
            result = await run_nav_cold_start_backfill(session, triggered_by="STARTUP")
            await session.commit()
            return result
        except Exception as exc:
            await session.rollback()
            logger.exception("Cold-start backfill failed on startup")
            return {"ok": False, "error": str(exc)}


async def run_scheduler_loop() -> None:
    settings = get_settings()
    tick = max(settings.zynd_mf_scheduler_tick_seconds, 15)
    logger.info("MF scheduler started (tick=%ss)", tick)
    startup_result = await _maybe_run_cold_start_on_startup()
    if startup_result:
        logger.info("MF scheduler startup cold-start result: %s", startup_result)
    while True:
        try:
            results = await _run_due_jobs()
            if results:
                logger.info("MF scheduler tick results: %s", results)
        except Exception:
            logger.exception("MF scheduler tick failed")
        await asyncio.sleep(tick)


async def main() -> int:
    parser = argparse.ArgumentParser(description="Run Zynd mutual fund ingestion schedulers.")
    parser.add_argument(
        "--schedule",
        action="store_true",
        help="Run continuously and execute jobs when their cron is due.",
    )
    parser.add_argument(
        "--job",
        type=str,
        help="Run a single job once (cybrilla-scheme-sync, amfi-nav-daily, nav-metrics-compute, ...).",
    )
    parser.add_argument(
        "--list-jobs",
        action="store_true",
        help="Print all registered MF scheduler jobs and exit.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Skip dependency guard (and for cold-start: skip 'not needed' threshold check).",
    )
    parser.add_argument(
        "--from-date",
        type=str,
        help="nav-cold-start-backfill only: resume from YYYY-MM-DD (e.g. 2010-03-11).",
    )
    parser.add_argument(
        "--to-date",
        type=str,
        help="nav-cold-start-backfill only: end at YYYY-MM-DD (default: today).",
    )
    args = parser.parse_args()

    if args.list_jobs:
        print(json.dumps(list_jobs_for_cli(), indent=2))
        return 0

    if args.schedule:
        await run_scheduler_loop()
        return 0

    if not args.job:
        parser.error("Provide --job NAME for a one-shot run, or --schedule for the daemon.")

    job_kwargs: dict = {}
    if args.force:
        job_kwargs["force"] = True
    if args.from_date:
        if args.job != "nav-cold-start-backfill":
            parser.error("--from-date is only supported for nav-cold-start-backfill")
        job_kwargs["from_date"] = date.fromisoformat(args.from_date)
    if args.to_date:
        if args.job != "nav-cold-start-backfill":
            parser.error("--to-date is only supported for nav-cold-start-backfill")
        job_kwargs["to_date"] = date.fromisoformat(args.to_date)

    async with AsyncSessionLocal() as session:
        result = await run_job_once(
            session,
            args.job,
            skip_dependency_check=args.force,
            job_kwargs=job_kwargs or None,
        )
        await session.commit()

    print(json.dumps(result, default=str, indent=2))
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    raise SystemExit(asyncio.run(main()))
