from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from app.application.notifications.push_dispatch_service import (
    handle_failed_push_dispatch_job,
    process_push_dispatch_job,
)
from app.core.config import get_settings
from app.infrastructure.queue.push_dispatch_queue import pop_push_dispatch_job

logger = logging.getLogger(__name__)


async def run_push_dispatch_worker(*, block_seconds: int | None = None) -> None:
    settings = get_settings()
    block_seconds = block_seconds or settings.notifications_push_worker_block_seconds
    logger.info("Push dispatch worker started queue=%s", settings.notifications_push_queue_key)

    while True:
        job = await pop_push_dispatch_job(block_seconds=block_seconds, settings=settings)
        if not job:
            continue

        raw_payload, data = job
        try:
            await process_push_dispatch_job(
                raw_payload=raw_payload,
                notification_id=UUID(data["notification_id"]),
                user_id=UUID(data["user_id"]),
                device_id=UUID(data["device_id"]),
                fcm_token=data["fcm_token"],
                unread_count=int(data["unread_count"]),
                attempt=int(data.get("attempt", 1)),
            )
        except Exception as exc:
            logger.exception(
                "Push dispatch worker failed notification_id=%s device_id=%s attempt=%s",
                data.get("notification_id"),
                data.get("device_id"),
                data.get("attempt"),
            )
            await handle_failed_push_dispatch_job(
                raw_payload=raw_payload,
                notification_id=UUID(data["notification_id"]),
                user_id=UUID(data["user_id"]),
                device_id=UUID(data["device_id"]),
                fcm_token=data["fcm_token"],
                unread_count=int(data["unread_count"]),
                attempt=int(data.get("attempt", 1)),
                reason=str(exc),
            )


async def main() -> int:
    await run_push_dispatch_worker()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
