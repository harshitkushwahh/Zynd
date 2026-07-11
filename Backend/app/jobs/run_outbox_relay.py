from __future__ import annotations

import asyncio
import json
import sys
import time

from app.application.messaging.outbox_service import relay_pending_outbox
from app.core.config import get_settings
from app.core.database import AsyncSessionLocal


async def run_outbox_relay_once() -> dict[str, int]:
    async with AsyncSessionLocal() as session:
        stats = await relay_pending_outbox(session)
        await session.commit()
    return stats


async def run_outbox_relay_loop() -> None:
    settings = get_settings()
    interval = settings.outbox_relay_interval_seconds
    while True:
        stats = await run_outbox_relay_once()
        if stats["processed"]:
            print(json.dumps({"relay": stats}, default=str))
        await asyncio.sleep(interval)


async def main() -> int:
    if "--once" in sys.argv:
        stats = await run_outbox_relay_once()
        print(json.dumps(stats, default=str, indent=2))
        return 0 if stats["failed"] == 0 else 1

    await run_outbox_relay_loop()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
