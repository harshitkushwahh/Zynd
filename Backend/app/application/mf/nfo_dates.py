from __future__ import annotations

from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.config import get_settings


def nfo_scheduler_timezone() -> ZoneInfo:
    settings = get_settings()
    try:
        return ZoneInfo(settings.zynd_nfo_scheduler_timezone or "Asia/Kolkata")
    except ZoneInfoNotFoundError:
        return ZoneInfo("Asia/Kolkata")


def today_ist(now: datetime | None = None) -> date:
    current = now or datetime.now(timezone.utc)
    return current.astimezone(nfo_scheduler_timezone()).date()
