from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from app.application.mf.cas_import_service import process_cas_import
from app.application.mf.mf_order_worker_service import process_pending_orders, sync_open_orders
from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.infrastructure.persistence.mf_transaction_models import MfCasImport, MfCasImportStatus

logger = logging.getLogger(__name__)


async def run_mf_order_worker_once() -> dict:
    settings = get_settings()
    if not settings.zynd_mf_orders_enabled:
        return {"skipped": 1, "reason": "orders_disabled"}

    async with AsyncSessionLocal() as session:
        submit_result = await process_pending_orders(session, batch_size=settings.zynd_mf_order_worker_batch_size)
        sync_result = {}
        if settings.zynd_mf_order_status_sync_enabled:
            sync_result = await sync_open_orders(session, batch_size=settings.zynd_mf_order_worker_batch_size)
        await session.commit()
    return {"submit": submit_result, "sync": sync_result}


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
