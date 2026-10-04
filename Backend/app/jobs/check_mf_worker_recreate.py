from __future__ import annotations

import asyncio
import logging

from app.application.mf.mf_scheduler_deploy_guard import live_mf_scheduler_work
from app.core.database import AsyncSessionLocal

SKIP_EXIT = 10


async def main() -> int:
    async with AsyncSessionLocal() as session:
        busy, reasons = await live_mf_scheduler_work(session)
    if busy:
        print("SKIP")
        for reason in reasons:
            print(reason)
        return SKIP_EXIT
    print("RECREATE")
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING)
    raise SystemExit(asyncio.run(main()))
