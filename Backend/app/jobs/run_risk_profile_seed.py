from __future__ import annotations

import argparse
import asyncio
import json
import logging

from app.application.risk_profile.risk_profile_seed_service import (
    ensure_risk_profile_seed,
    summarize_risk_profile_seed,
)
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


async def run_once() -> dict[str, int | bool]:
    async with AsyncSessionLocal() as session:
        result = await ensure_risk_profile_seed(session)
        summary = await summarize_risk_profile_seed(session)
        await session.commit()
    return {**result, "summary": summary}


async def main() -> int:
    parser = argparse.ArgumentParser(
        description="Seed risk profile tiers, categories, questions, and assessment templates."
    )
    parser.parse_args()

    result = await run_once()
    print(json.dumps(result, default=str, indent=2))
    logger.info("Risk profile seed complete: %s", result)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
