from __future__ import annotations

import argparse
import asyncio
import json

from app.application.admin.dev_admin_seed_service import ensure_dev_admin_seed
from app.core.database import AsyncSessionLocal


async def run_once() -> dict[str, str | bool]:
    async with AsyncSessionLocal() as session:
        result = await ensure_dev_admin_seed(session, force=True)
        await session.commit()
    return result


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create or update the admin user and assign the super_admin role."
    )
    parser.parse_args()
    result = asyncio.run(run_once())
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
