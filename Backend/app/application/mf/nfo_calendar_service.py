from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_PLAN_NOISE = re.compile(
    r"\b(regular|direct)\s+plan\b|\b(regular|direct)\b|\b(growth|idcw|dividend)\b|\bplan\b",
    re.IGNORECASE,
)
_NON_ALNUM = re.compile(r"[^a-z0-9]+")
_ISO_DATE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})")


@dataclass(frozen=True)
class NfoCalendarWindow:
    scheme_name: str
    open_date: date | None
    close_date: date | None
    allotment_date: date | None
    normalized_name: str


def normalize_nfo_scheme_name(name: str | None) -> str:
    text = _NON_ALNUM.sub(" ", (name or "").lower())
    text = _PLAN_NOISE.sub(" ", text)
    return " ".join(text.split())


def parse_nfo_calendar_date(value: Any) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    text = str(value).strip()
    iso = _ISO_DATE.match(text)
    if iso:
        return date(int(iso.group(1)), int(iso.group(2)), int(iso.group(3)))
    for fmt in ("%d %b %Y", "%d %B %Y", "%d-%b-%Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def extract_nfo_dates_from_scheme(raw: dict[str, Any] | None) -> dict[str, date | None]:
    payload = raw or {}
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    return {
        "open_date": _first_date(
            data,
            (
                "nfo_start_date",
                "nfo_open_date",
                "subscription_open_date",
                "subscription_start_date",
                "offer_open_date",
            ),
        ),
        "close_date": _first_date(
            data,
            (
                "nfo_end_date",
                "nfo_close_date",
                "subscription_close_date",
                "subscription_end_date",
                "offer_close_date",
            ),
        ),
        "allotment_date": _first_date(data, ("allotment_date", "nfo_allotment_date")),
    }


def _first_date(payload: dict[str, Any], keys: tuple[str, ...]) -> date | None:
    for key in keys:
        parsed = parse_nfo_calendar_date(payload.get(key))
        if parsed:
            return parsed
    return None


def match_nfo_calendar_window(
    scheme_name: str | None,
    windows: list[NfoCalendarWindow],
) -> NfoCalendarWindow | None:
    needle = normalize_nfo_scheme_name(scheme_name)
    if not needle or len(needle) < 8:
        return None
    exact = [item for item in windows if item.normalized_name == needle]
    if len(exact) == 1:
        return exact[0]
    contained = [
        item
        for item in windows
        if item.normalized_name and (item.normalized_name in needle or needle in item.normalized_name)
    ]
    if len(contained) == 1:
        return contained[0]
    return None


def calendar_status_for_window(window: NfoCalendarWindow, today: date) -> str | None:
    if window.open_date and today < window.open_date:
        return "UPCOMING"
    if window.close_date and today > window.close_date:
        return "CLOSED"
    if window.open_date or window.close_date:
        return "OPEN"
    return None


def _row_to_window(row: dict[str, Any]) -> NfoCalendarWindow | None:
    name = str(row.get("schemeName") or row.get("scheme_name") or row.get("name") or "").strip()
    if not name:
        return None
    return NfoCalendarWindow(
        scheme_name=name,
        open_date=parse_nfo_calendar_date(row.get("openDate") or row.get("open_date") or row.get("nfoOpenDate")),
        close_date=parse_nfo_calendar_date(row.get("closeDate") or row.get("close_date") or row.get("nfoCloseDate")),
        allotment_date=parse_nfo_calendar_date(row.get("allotmentDate") or row.get("allotment_date")),
        normalized_name=normalize_nfo_scheme_name(name),
    )


async def fetch_nfo_calendar_windows() -> list[NfoCalendarWindow]:
    settings = get_settings()
    url = (settings.zynd_nfo_calendar_url or "").strip()
    if not url:
        return []
    timeout = float(settings.zynd_mf_fetch_timeout_seconds)
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            response = await client.get(
                url,
                headers={"Accept": "application/json", "User-Agent": "Zynd-NFO-Scheduler/1.0"},
            )
            response.raise_for_status()
            payload = response.json()
    except Exception:
        logger.warning("NFO calendar fetch failed url=%s", url, exc_info=True)
        return []

    rows: list[dict[str, Any]] = []
    if isinstance(payload, list):
        rows = [row for row in payload if isinstance(row, dict)]
    elif isinstance(payload, dict):
        for key in ("mf", "items", "data", "nfo", "sif"):
            value = payload.get(key)
            if isinstance(value, list):
                rows.extend(row for row in value if isinstance(row, dict))
    windows = [window for row in rows if (window := _row_to_window(row))]
    logger.info("NFO calendar loaded rows=%s url=%s", len(windows), url)
    return windows
