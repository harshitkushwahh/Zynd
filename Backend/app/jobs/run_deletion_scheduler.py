from __future__ import annotations

import argparse
import asyncio
import json
import logging

from app.application.compliance.deletion_executor_service import run_deletion_executor
from app.core.config import get_settings
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


async def run_once() -> dict:
    async with AsyncSessionLocal() as session:
        result = await run_deletion_executor(session)
        await session.commit()
    return result


async def run_scheduler(interval_seconds: int) -> None:
    logger.info("Deletion executor scheduler started (interval=%ss)", interval_seconds)
    while True:
        try:
            result = await run_once()
            logger.info("Deletion executor run complete: %s", result)
        except Exception:
            logger.exception("Deletion executor run failed")
        await asyncio.sleep(interval_seconds)


async def main() -> int:
    parser = argparse.ArgumentParser(description="Run deletion executor once or on a schedule.")
    parser.add_argument(
        "--schedule",
        action="store_true",
        help="Run continuously using DELETION_EXECUTOR_INTERVAL_SECONDS.",
    )
    args = parser.parse_args()
    settings = get_settings()

    if args.schedule:
        await run_scheduler(settings.deletion_executor_interval_seconds)
        return 0

    result = await run_once()
    print(json.dumps(result, default=str, indent=2))
    return 0 if result["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
