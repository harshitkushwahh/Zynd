from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from app.application.documents.document_scan_service import (
    handle_failed_document_scan_job,
    process_document_scan,
)
from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.infrastructure.queue.document_scan_queue import pop_document_scan_job

logger = logging.getLogger(__name__)


async def run_document_scan_worker(*, block_seconds: int | None = None) -> None:
    settings = get_settings()
    block_seconds = block_seconds or settings.documents_scan_worker_block_seconds
    logger.info("Document scan worker started queue=%s", settings.documents_scan_queue_key)

    while True:
        job = await pop_document_scan_job(block_seconds=block_seconds, settings=settings)
        if not job:
            continue

        raw_payload, data = job
        document_id = UUID(data["document_id"])
        attempt = int(data.get("attempt", 1))

        try:
            async with AsyncSessionLocal() as session:
                await process_document_scan(session, document_id=document_id, settings=settings)
                await session.commit()
        except Exception as exc:
            logger.exception("Document scan worker failed id=%s attempt=%s", document_id, attempt)
            await handle_failed_document_scan_job(
                raw_payload=raw_payload,
                document_id=document_id,
                attempt=attempt,
                reason=str(exc),
                settings=settings,
            )


async def main() -> int:
    await run_document_scan_worker()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
