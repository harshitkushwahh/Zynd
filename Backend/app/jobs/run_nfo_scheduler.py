from __future__ import annotations

import argparse
import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone

from app.application.mf.mf_scheduler_jobs import last_scheduled_time
from app.application.mf.nfo_chain_trigger_service import (
    consume_pending_chain,
    get_or_create_state,
    nfo_already_succeeded_today,
    nfo_scheduler_timezone,
)
from app.application.mf.nfo_ingestion_mutex_service import mf_family_mutex_busy
from app.application.mf.nfo_job_runner_service import execute_nfo_job, run_nfo_daily_bundle
from app.application.mf.nfo_scheduler_jobs import nfo_jobs_for_cli
from app.core.config import get_settings
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


async def _maybe_run_bundle(*, trigger_kind: str, triggered_by: str) -> dict | None:
    settings = get_settings()
    if not settings.zynd_nfo_ingestion_enabled:
        return {"skipped": 1, "reason": "nfo_disabled"}

    async with AsyncSessionLocal() as session:
        if await nfo_already_succeeded_today(session):
            return {"skipped": 1, "reason": "already_ran_today"}
        busy, holders = await mf_family_mutex_busy(session)
        if busy:
            logger.info("NFO scheduler waiting on mutex holders=%s", holders)
            return {"skipped": 1, "reason": "mutex_busy", "mutex_holders": holders}
        try:
            result = await run_nfo_daily_bundle(
                session,
                triggered_by=triggered_by,
                trigger_kind=trigger_kind,
                skip_mutex=True,
            )
            await session.commit()
            return result
        except Exception:
            await session.rollback()
            logger.exception("NFO daily bundle failed trigger=%s", trigger_kind)
            raise


async def _tick(fired_fallback: dict[str, datetime]) -> None:
    settings = get_settings()
    async with AsyncSessionLocal() as session:
        state = await get_or_create_state(session)
        pending = state.pending_after_mf
        await session.commit()

    if pending:
        async with AsyncSessionLocal() as session:
            consumed = await consume_pending_chain(session)
            await session.commit()
        if consumed:
            result = await _maybe_run_bundle(trigger_kind="chain", triggered_by="MF_CHAIN")
            if result:
                logger.info("NFO chain run: %s", result)
            return

    now = datetime.now(timezone.utc)
    catch_up = timedelta(minutes=max(settings.zynd_mf_scheduler_catch_up_minutes, 1))
    scheduled_at = last_scheduled_time(settings.zynd_nfo_fallback_cron, now=now)
    if now - scheduled_at > catch_up:
        return
    if fired_fallback.get("fallback") == scheduled_at:
        return
    fired_fallback["fallback"] = scheduled_at
    result = await _maybe_run_bundle(trigger_kind="fallback", triggered_by="SCHEDULER")
    if result:
        logger.info("NFO fallback run: %s", result)


async def run_scheduler_loop() -> None:
    settings = get_settings()
    tick = max(settings.zynd_nfo_poll_seconds, 15)
    logger.info(
        "NFO scheduler started (tick=%ss timezone=%s fallback=%s)",
        tick,
        nfo_scheduler_timezone().key,
        settings.zynd_nfo_fallback_cron,
    )
    fired_fallback: dict[str, datetime] = {}
    while True:
        try:
            await _tick(fired_fallback)
        except Exception:
            logger.exception("NFO scheduler tick failed")
        await asyncio.sleep(tick)


async def main() -> int:
    parser = argparse.ArgumentParser(description="Run Zynd NFO schedulers.")
    parser.add_argument("--schedule", action="store_true", help="Poll for MF-chain trigger and 22:00 IST fallback.")
    parser.add_argument("--job", type=str, help="Run a single NFO job once.")
    parser.add_argument("--list-jobs", action="store_true")
    parser.add_argument("--force", action="store_true", help="Skip mutex and dependency guard.")
    args = parser.parse_args()

    if args.list_jobs:
        print(json.dumps(nfo_jobs_for_cli(), indent=2))
        return 0
    if args.schedule:
        await run_scheduler_loop()
        return 0
    if not args.job:
        parser.error("Provide --job NAME or --schedule.")

    async with AsyncSessionLocal() as session:
        result = await execute_nfo_job(
            session,
            args.job,
            triggered_by="CLI",
            skip_dependency_check=args.force,
            skip_mutex=args.force,
        )
        await session.commit()
    print(json.dumps(result, default=str, indent=2))
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    raise SystemExit(asyncio.run(main()))
