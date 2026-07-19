from __future__ import annotations

import asyncio
import fcntl
import logging
import os
from pathlib import Path

from sqlalchemy import select

from app.application.investor.investor_provision_worker_service import process_pending_investor_provisions
from app.application.mf.cas_import_service import process_cas_import
from app.application.mf.mf_ondc_order_service import advance_ondc_orders, process_pending_orders, sync_open_orders
from app.application.mf.mf_sip_worker_service import (
    advance_sip_plans,
    process_pending_mandates,
    process_pending_sip_plans,
    sync_open_mandates,
)
from app.application.mf.mf_transaction_ops_service import expire_stale_checkouts, replay_failed_webhooks
from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.infrastructure.persistence.mf_transaction_models import MfCasImport, MfCasImportStatus

logger = logging.getLogger(__name__)

_WORKER_LOCK_PATH = Path(__file__).resolve().parents[2] / ".mf_transaction_worker.lock"
_worker_lock_fd: int | None = None


def _acquire_worker_lock() -> None:
    """Ensure only one long-running MF worker process is active."""
    global _worker_lock_fd
    _WORKER_LOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(_WORKER_LOCK_PATH, os.O_RDWR | os.O_CREAT, 0o644)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        os.close(fd)
        logger.error("Another MF transaction worker is already running; exiting.")
        raise SystemExit(0)
    _worker_lock_fd = fd


async def run_mf_order_worker_once() -> dict:
    settings = get_settings()
    if not settings.zynd_mf_orders_enabled:
        return {"skipped": 1, "reason": "orders_disabled"}

    async with AsyncSessionLocal() as session:
        provision_result = await process_pending_investor_provisions(
            session,
            batch_size=settings.zynd_investor_provision_batch_size,
        )
        mandate_result = {}
        sip_result = {}
        if settings.zynd_mf_sip_enabled:
            mandate_result = {
                "submit": await process_pending_mandates(session, batch_size=settings.zynd_mf_order_worker_batch_size),
                "sync": await sync_open_mandates(session, batch_size=settings.zynd_mf_order_worker_batch_size),
            }
            sip_result = {
                "submit": await process_pending_sip_plans(session, batch_size=settings.zynd_mf_order_worker_batch_size),
                "advance": await advance_sip_plans(session, batch_size=settings.zynd_mf_order_worker_batch_size),
            }
        submit_result = await process_pending_orders(session, batch_size=settings.zynd_mf_order_worker_batch_size)
        try:
            advance_result = await advance_ondc_orders(session, batch_size=settings.zynd_mf_order_worker_batch_size)
        except Exception:
            logger.exception("MF order worker advance step failed")
            advance_result = {"error": 1}
        sync_result = {}
        if settings.zynd_mf_order_status_sync_enabled:
            sync_result = await sync_open_orders(session, batch_size=settings.zynd_mf_order_worker_batch_size)
        ops_result = {"expire": await expire_stale_checkouts(session)}
        if settings.zynd_mf_webhook_replay_enabled:
            ops_result["webhook_replay"] = await replay_failed_webhooks(
                session,
                batch_size=settings.zynd_mf_webhook_replay_batch_size,
            )
        await session.commit()
    return {
        "provision": provision_result,
        "mandates": mandate_result,
        "sip": sip_result,
        "submit": submit_result,
        "advance": advance_result,
        "sync": sync_result,
        "ops": ops_result,
    }


async def run_mf_cas_worker_once() -> dict:
    settings = get_settings()
    if not settings.zynd_mf_cas_enabled:
        return {"skipped": 1, "reason": "cas_disabled"}

    processed = succeeded = failed = 0
    async with AsyncSessionLocal() as session:
        imports = list(
            (
                await session.execute(
                    select(MfCasImport)
                    .where(MfCasImport.status == MfCasImportStatus.pending)
                    .order_by(MfCasImport.requested_at)
                    .limit(settings.zynd_mf_cas_worker_batch_size)
                )
            ).scalars()
        )
        for import_row in imports:
            processed += 1
            try:
                await process_cas_import(session, import_row)
                succeeded += 1
            except Exception:
                failed += 1
        await session.commit()
    return {"processed": processed, "succeeded": succeeded, "failed": failed}


async def run_mf_order_worker_loop() -> None:
    settings = get_settings()
    tick = max(settings.zynd_mf_order_worker_tick_seconds, 10)
    logger.info("MF order worker started tick=%ss", tick)
    while True:
        try:
            result = await run_mf_order_worker_once()
            if result.get("submit", {}).get("processed") or result.get("sync", {}).get("processed"):
                logger.info("MF order worker tick: %s", result)
        except Exception:
            logger.exception("MF order worker tick failed")
        await asyncio.sleep(tick)


async def run_mf_cas_worker_loop() -> None:
    settings = get_settings()
    tick = max(settings.zynd_mf_cas_worker_tick_seconds, 15)
    logger.info("MF CAS worker started tick=%ss", tick)
    while True:
        try:
            result = await run_mf_cas_worker_once()
            if result.get("processed"):
                logger.info("MF CAS worker tick: %s", result)
        except Exception:
            logger.exception("MF CAS worker tick failed")
        await asyncio.sleep(tick)


async def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Run MF transaction background workers.")
    parser.add_argument("--orders", action="store_true", help="Run MF order submit/sync worker loop.")
    parser.add_argument("--cas", action="store_true", help="Run MF Central CAS import worker loop.")
    parser.add_argument("--once", action="store_true", help="Run one tick and exit.")
    args = parser.parse_args()

    if args.once:
        if args.orders:
            print(await run_mf_order_worker_once())
        elif args.cas:
            print(await run_mf_cas_worker_once())
        else:
            print({"orders": await run_mf_order_worker_once(), "cas": await run_mf_cas_worker_once()})
        return 0

    _acquire_worker_lock()

    if args.orders:
        await run_mf_order_worker_loop()
    elif args.cas:
        await run_mf_cas_worker_loop()
    else:
        parser.error("Specify --orders or --cas")
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    raise SystemExit(asyncio.run(main()))
