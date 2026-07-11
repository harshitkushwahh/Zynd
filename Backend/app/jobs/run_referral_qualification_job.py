from __future__ import annotations

import argparse
import asyncio
import json
import logging

from app.application.referral.referral_qualification_service import run_referral_qualification_batch
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


async def run_once(*, limit: int | None = None) -> dict[str, int]:
    batch_limit = limit if limit is not None else 100
    async with AsyncSessionLocal() as session:
        result = await run_referral_qualification_batch(session, limit=batch_limit)
        await session.commit()
    return result


async def main() -> int:
    parser = argparse.ArgumentParser(
        description="Advance referred users to qualified after the investment hold period."
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=100,
        help="Maximum attributions to evaluate in this run.",
    )
    args = parser.parse_args()

    result = await run_once(limit=args.limit)
    print(json.dumps(result, default=str, indent=2))
    logger.info("Referral qualification run complete: %s", result)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
