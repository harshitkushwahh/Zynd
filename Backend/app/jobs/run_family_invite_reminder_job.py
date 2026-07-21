from __future__ import annotations

import argparse
import asyncio
import json
import logging

from app.application.family_groups.invite_reminder_service import run_family_invite_reminder_batch
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


async def run_once(*, limit: int | None = None) -> dict[str, int]:
    batch_limit = limit if limit is not None else 100
    async with AsyncSessionLocal() as session:
        result = await run_family_invite_reminder_batch(session, limit=batch_limit)
        await session.commit()
    return result


async def main() -> int:
    parser = argparse.ArgumentParser(
        description="Send 48-hour reminders for pending family group invitations."
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=100,
        help="Maximum pending invites to evaluate in this run.",
    )
    args = parser.parse_args()

    result = await run_once(limit=args.limit)
    print(json.dumps(result, default=str, indent=2))
    logger.info("Family invite reminder run complete: %s", result)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
