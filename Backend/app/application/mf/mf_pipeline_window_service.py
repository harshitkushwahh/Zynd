from __future__ import annotations

from datetime import datetime, time, timedelta, timezone

from app.application.mf.mf_scheduler_skip_service import IST
from app.core.config import get_settings


def _parse_hhmm(value: str) -> time:
    hour_str, minute_str = value.split(":", 1)
    return time(hour=int(hour_str), minute=int(minute_str))


def _time_within_window(current: time, start: time, end: time) -> bool:
    if start <= end:
        return start <= current < end
    return current >= start or current < end


def _next_window_open(now_ist: datetime, start: time, end: time) -> datetime:
    current = now_ist.time()
    if _time_within_window(current, start, end):
        return now_ist
    if start <= end:
        if current < start:
            return now_ist.replace(hour=start.hour, minute=start.minute, second=0, microsecond=0)
        return (now_ist + timedelta(days=1)).replace(
            hour=start.hour,
            minute=start.minute,
            second=0,
            microsecond=0,
        )
    if current >= end and current < start:
        return now_ist.replace(hour=start.hour, minute=start.minute, second=0, microsecond=0)
    return now_ist


def pipeline_manual_window_status(*, now: datetime | None = None) -> dict:
    settings = get_settings()
    start_label = settings.zynd_mf_pipeline_manual_window_start_ist
    end_label = settings.zynd_mf_pipeline_manual_window_end_ist
    start = _parse_hhmm(start_label)
    end = _parse_hhmm(end_label)

    if not settings.zynd_mf_pipeline_manual_window_enabled:
        return {
            "enabled": False,
            "enforced": False,
            "start": start_label,
            "end": end_label,
            "within_window": True,
            "opens_at_ist": None,
        }

    enforce = settings.app_env != "development" or settings.zynd_mf_pipeline_window_enforce_in_dev
    now_ist = (now or datetime.now(timezone.utc)).astimezone(IST)
    within = _time_within_window(now_ist.time(), start, end)
    opens_at = None if within else _next_window_open(now_ist, start, end).isoformat()

    return {
        "enabled": True,
        "enforced": enforce,
        "start": start_label,
        "end": end_label,
        "within_window": within,
        "opens_at_ist": opens_at,
    }


def assert_admin_pipeline_window_allowed(*, triggered_by: str) -> None:
    if triggered_by != "ADMIN":
        return
    window = pipeline_manual_window_status()
    if window["enforced"] and not window["within_window"]:
        raise RuntimeError(
            f"Manual pipeline runs are only allowed between {window['start']} and {window['end']} IST"
        )
