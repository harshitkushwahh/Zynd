from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.infrastructure.persistence.models import AuditLog

logger = logging.getLogger(__name__)


async def _export_batch() -> dict[str, int]:
    settings = get_settings()
    if not settings.mongo_url:
        return {"exported": 0, "skipped": True}

    try:
        from motor.motor_asyncio import AsyncIOMotorClient
    except ImportError:
        logger.warning("motor is not installed; skipping Mongo analytics export")
        return {"exported": 0, "skipped": True}

    exported = 0
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(AuditLog).order_by(AuditLog.created_at.desc()).limit(settings.mongo_export_batch_size)
        )
        events = result.scalars().all()
        if not events:
            return {"exported": 0, "skipped": False}

        client = AsyncIOMotorClient(settings.mongo_url)
        collection = client[settings.mongo_db_name]["audit_events"]
        docs = [
            {
                "event_id": str(event.id),
                "user_id": str(event.user_id) if event.user_id else None,
                "event_type": event.event_type.value,
                "ip_address": event.ip_address,
                "metadata": event.metadata_,
                "created_at": event.created_at.isoformat(),
                "exported_at": datetime.now(timezone.utc).isoformat(),
            }
            for event in events
        ]
        await collection.insert_many(docs)
        exported = len(docs)
        client.close()

    return {"exported": exported, "skipped": False}


async def main() -> int:
    result = await _export_batch()
    print(json.dumps(result, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
