from __future__ import annotations

import json
from uuid import UUID

from app.core.config import Settings, get_settings
from app.core.redis import get_redis


def _queue_payload(document_id: UUID, *, attempt: int = 1) -> str:
    return json.dumps({"document_id": str(document_id), "attempt": attempt})


async def enqueue_document_scan(document_id: UUID, *, attempt: int = 1, settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    client = await get_redis(settings.redis_document_worker_db, settings)
    await client.lpush(settings.documents_scan_queue_key, _queue_payload(document_id, attempt=attempt))


async def requeue_document_scan(document_id: UUID, *, attempt: int, settings: Settings | None = None) -> None:
    await enqueue_document_scan(document_id, attempt=attempt, settings=settings)


async def move_document_scan_to_dead_letter(
    payload: str,
    *,
    reason: str,
    settings: Settings | None = None,
) -> None:
    settings = settings or get_settings()
    client = await get_redis(settings.redis_document_worker_db, settings)
    dead_letter = json.dumps({"payload": payload, "reason": reason})
    await client.lpush(settings.documents_scan_dead_letter_key, dead_letter)


async def pop_document_scan_job(
    *,
    block_seconds: int,
    settings: Settings | None = None,
) -> tuple[str, dict] | None:
    settings = settings or get_settings()
    client = await get_redis(settings.redis_document_worker_db, settings)
    result = await client.brpop(settings.documents_scan_queue_key, timeout=block_seconds)
    if not result:
        return None
    _, raw_payload = result
    data = json.loads(raw_payload)
    return raw_payload, data
