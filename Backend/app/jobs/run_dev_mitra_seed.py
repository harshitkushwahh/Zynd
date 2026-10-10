from __future__ import annotations

import argparse
import asyncio
import json

from app.application.admin.dev_mitra_seed_service import ensure_dev_mitra_seed
from app.core.database import AsyncSessionLocal


async def run_once() -> dict[str, object]:
    async with AsyncSessionLocal() as session:
        result = await ensure_dev_mitra_seed(session, force=True)
        await session.commit()
    return result


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create or update dev Zynd Mitra (distributor) console users."
    )
    parser.parse_args()
    result = asyncio.run(run_once())
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
