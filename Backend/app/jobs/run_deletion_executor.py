from __future__ import annotations

import asyncio
import json
import sys

from app.application.compliance.deletion_executor_service import run_deletion_executor
from app.application.messaging.scheduled_events import begin_event_batch, discard_scheduled_events
from app.core.database import AsyncSessionLocal, commit_session_with_events


async def main() -> int:
    begin_event_batch()
    async with AsyncSessionLocal() as session:
        try:
            result = await run_deletion_executor(session)
            await commit_session_with_events(session)
        except Exception:
            await session.rollback()
            discard_scheduled_events()
            raise
    print(json.dumps(result, default=str, indent=2))
    return 0 if result["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
