from __future__ import annotations

import csv
import io
from datetime import datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.provider_log_models import ProviderLogSource
from app.infrastructure.persistence.repositories.provider_log_repository import ProviderLogRepository


def _parse_source(value: str | None) -> ProviderLogSource | None:
    if not value:
        return None
    return ProviderLogSource(value)


async def list_zynd_logs(
    db: AsyncSession,
    *,
    source: str | None = None,
    q: str | None = None,
    success: bool | None = None,
    from_at: datetime | None = None,
    to_at: datetime | None = None,
    since: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    repo = ProviderLogRepository(db)
    parsed_source = _parse_source(source)
    filters = {
        "source": parsed_source,
        "q": q,
        "success": success,
        "from_at": from_at,
        "to_at": to_at,
        "since": since,
    }
    items = await repo.list_logs(
        source=parsed_source,
        q=q,
        success=success,
        from_at=from_at,
        to_at=to_at,
        since=since,
        limit=limit,
        offset=offset,
    )
    total = await repo.count_logs(**{k: v for k, v in filters.items() if k != "since"})
    latest_at = items[0]["created_at"] if items else None
    return {
        "items": items,
        "total": total,
        "has_more": offset + len(items) < total,
        "latest_at": latest_at,
    }


async def export_zynd_logs_csv(
    db: AsyncSession,
    *,
    source: str | None = None,
    q: str | None = None,
    success: bool | None = None,
    from_at: datetime | None = None,
    to_at: datetime | None = None,
) -> str:
    repo = ProviderLogRepository(db)
    items = await repo.export_logs(
        source=_parse_source(source),
        q=q,
        success=success,
        from_at=from_at,
        to_at=to_at,
    )

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "created_at",
            "source",
            "user_email",
            "user_id",
            "action",
            "method",
            "path",
            "status_code",
            "success",
            "duration_ms",
            "error_code",
        ]
    )
    for item in items:
        writer.writerow(
            [
                item["created_at"].isoformat(),
                item["source"],
                item.get("user_email") or "",
                str(item.get("user_id") or ""),
                item["action"],
                item["method"],
                item["path"],
                item.get("status_code") or "",
                "true" if item.get("success") else "false",
                item.get("duration_ms") or "",
                item.get("error_code") or "",
            ]
        )
    return buffer.getvalue()
