from __future__ import annotations

import argparse
import asyncio
import json
import logging

from app.application.recommendations.recommendation_basket_seed_service import (
    ensure_recommendation_baskets_seed,
)
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


async def run_once() -> dict:
    async with AsyncSessionLocal() as session:
        result = await ensure_recommendation_baskets_seed(session)
        await session.commit()
    return result


async def main() -> int:
    parser = argparse.ArgumentParser(
        description="Seed Funds For You recommendation baskets from the investable MF catalog and publish when ready.",
    )
    parser.parse_args()

    result = await run_once()
    print(json.dumps(result, default=str, indent=2))
    logger.info("Recommendation baskets seed complete: %s", result)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
