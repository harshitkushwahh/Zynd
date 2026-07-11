from __future__ import annotations

import argparse
import asyncio
import json
import logging

from app.application.documents.document_retention_service import purge_expired_documents
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


async def run_once() -> dict:
    async with AsyncSessionLocal() as session:
        result = await purge_expired_documents(session)
        await session.commit()
    return result


async def main() -> int:
    parser = argparse.ArgumentParser(description="Purge expired non-KYC and due documents.")
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional batch size override.",
    )
    args = parser.parse_args()

    async with AsyncSessionLocal() as session:
        result = await purge_expired_documents(session, limit=args.limit)
        await session.commit()

    print(json.dumps(result, default=str, indent=2))
    return 0 if result["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
