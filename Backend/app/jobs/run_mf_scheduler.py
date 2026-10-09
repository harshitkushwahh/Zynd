from __future__ import annotations

import argparse
import asyncio
import json
import logging
from datetime import date, datetime, timedelta, timezone

from app.application.mf.ingestion_run_service import latest_run_for_job
from app.application.mf.mf_scheduler_jobs import (
    build_scheduled_jobs,
    last_scheduled_time,
    list_jobs_for_cli,
    run_job_once,
    scheduler_timezone,
)
from app.application.mf.mf_scheduler_skip_service import is_scheduler_job_skipped_today
from app.application.mf.mf_job_runner_service import execute_mf_job
from app.application.mf.nav_cold_start_backfill_service import needs_cold_start_backfill, run_nav_cold_start_backfill
from app.core.config import get_settings
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


async def _job_is_due(
    session,
    job,
    *,
    now: datetime,
    fired: dict[str, datetime],
    catch_up: timedelta,
) -> tuple[bool, datetime]:
    """Decide whether ``job`` should run on this tick.

    A job is due when its most recent cron fire time is within the catch-up
    window and nothing has run it for that fire time yet. Restarts and long
    upstream jobs therefore cannot make a daily job silently miss its slot.
    """
    scheduled_at = last_scheduled_time(job.cron, now=now)
    if now - scheduled_at > catch_up:
        return False, scheduled_at
    if fired.get(job.name) == scheduled_at:
        return False, scheduled_at
    if await latest_run_for_job(session, job.name, since=scheduled_at) is not None:
        fired[job.name] = scheduled_at
        return False, scheduled_at
    return True, scheduled_at


async def _run_due_jobs(fired: dict[str, datetime] | None = None) -> list[dict]:
    results: list[dict] = []
    settings = get_settings()
    catch_up = timedelta(minutes=max(settings.zynd_mf_scheduler_catch_up_minutes, 1))
    fired = fired if fired is not None else {}
    async with AsyncSessionLocal() as session:
        for job in build_scheduled_jobs():
            if not job.enabled:
                continue
            now = datetime.now(timezone.utc)
            due, scheduled_at = await _job_is_due(session, job, now=now, fired=fired, catch_up=catch_up)
            if not due:
                continue
            fired[job.name] = scheduled_at
            if await is_scheduler_job_skipped_today(session, job.name):
                logger.info("MF scheduler skipping job=%s (manual/pipeline already ran today IST)", job.name)
                results.append({"job": job.name, "ok": True, "skipped": True, "reason": "manual_run_today"})
                continue
            logger.info(
                "MF scheduler running job=%s cron=%s scheduled_at=%s",
                job.name,
                job.cron,
                scheduled_at.isoformat(timespec="minutes"),
            )
            try:
                result = await execute_mf_job(session, job.name, triggered_by="SCHEDULER")
                await session.commit()
                results.append({"job": job.name, "ok": True, "result": result})
            except Exception as exc:
                await session.rollback()
                logger.exception("MF job failed job=%s", job.name)
                results.append({"job": job.name, "ok": False, "error": str(exc)})
        try:
            from app.application.mf.nfo_chain_trigger_service import signal_nfo_after_mf_success

            signal = await signal_nfo_after_mf_success(session)
            await session.commit()
            if signal.get("signaled"):
                logger.info("NFO chain trigger armed after MF scheduler tick: %s", signal)
        except Exception:
            await session.rollback()
            logger.exception("Failed to arm NFO chain trigger")
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
    auto_resume_tick = max(settings.zynd_mf_pipeline_auto_resume_poll_seconds, tick)
    ticks_since_auto_resume = auto_resume_tick
    fired: dict[str, datetime] = {}
    logger.info(
        "MF scheduler started (tick=%ss timezone=%s catch_up=%smin)",
        tick,
        scheduler_timezone().key,
        settings.zynd_mf_scheduler_catch_up_minutes,
    )
    for job in build_scheduled_jobs():
        logger.info(
            "MF scheduler job=%s cron=%s enabled=%s depends_on=%s",
            job.name,
            job.cron,
            job.enabled,
            ",".join(job.depends_on) or "-",
        )
    from app.application.mf.mf_pipeline_orchestrator_service import (
        claim_unattached_pipeline_runs,
        initialize_pipeline_worker,
    )

    await initialize_pipeline_worker()
    startup_result = await _maybe_run_cold_start_on_startup()
    if startup_result:
        logger.info("MF scheduler startup cold-start result: %s", startup_result)
    claim_every = max(settings.zynd_mf_pipeline_claim_seconds, 1)
    sleep_for = min(tick, claim_every)
    seconds_since_jobs = tick
    while True:
        try:
            claimed = await claim_unattached_pipeline_runs()
            if claimed:
                logger.info("MF scheduler claimed %s pipeline run(s)", claimed)
            seconds_since_jobs += sleep_for
            if seconds_since_jobs >= tick:
                seconds_since_jobs = 0
                results = await _run_due_jobs(fired)
                if results:
                    logger.info("MF scheduler tick results: %s", results)
            ticks_since_auto_resume += sleep_for
            if ticks_since_auto_resume >= auto_resume_tick:
                ticks_since_auto_resume = 0
                from app.application.mf.mf_pipeline_auto_resume_service import try_auto_resume_latest_eligible

                await try_auto_resume_latest_eligible(source="scheduler_poll")
        except Exception:
            logger.exception("MF scheduler tick failed")
        await asyncio.sleep(sleep_for)


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
