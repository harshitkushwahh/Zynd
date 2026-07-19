from __future__ import annotations

import logging
from datetime import date, datetime

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class AmfiNavFetchError(Exception):
    pass


AMFI_NAV_HISTORY_URL = "https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx"


async def fetch_amfi_nav_all(*, max_retries: int = 3) -> tuple[str, int]:
    settings = get_settings()
    url = settings.zynd_mf_amfi_nav_url
    timeout = settings.zynd_mf_fetch_timeout_seconds
    last_error: Exception | None = None

    for attempt in range(1, max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=float(timeout), follow_redirects=True) as client:
                response = await client.get(url)
                response.raise_for_status()
                body = response.text
            if len(body.encode("utf-8")) < settings.zynd_mf_min_file_size_bytes:
                raise AmfiNavFetchError(
                    f"AMFI NAV file too small ({len(body.encode('utf-8'))} bytes)"
                )
            return body, len(body.encode("utf-8"))
        except Exception as exc:
            last_error = exc
            logger.warning("AMFI NAV fetch attempt %s/%s failed: %s", attempt, max_retries, exc)

    raise AmfiNavFetchError(f"AMFI NAV fetch failed after {max_retries} attempts: {last_error}")


async def fetch_amfi_nav_history_window(
    from_date: date,
    to_date: date,
    *,
    max_retries: int = 3,
) -> tuple[str, int]:
    settings = get_settings()
    timeout = settings.zynd_mf_fetch_timeout_seconds
    url = (
        f"{AMFI_NAV_HISTORY_URL}?tp=1"
        f"&frmdt={from_date.strftime('%d-%b-%Y')}"
        f"&todt={to_date.strftime('%d-%b-%Y')}"
    )
    last_error: Exception | None = None

    for attempt in range(1, max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=float(timeout), follow_redirects=True) as client:
                response = await client.get(url)
                response.raise_for_status()
                body = response.text
            if not body.strip():
                raise AmfiNavFetchError(f"Empty AMFI history response for {from_date}..{to_date}")
            return body, len(body.encode("utf-8"))
        except Exception as exc:
            last_error = exc
            logger.warning(
                "AMFI NAV history fetch attempt %s/%s failed window=%s..%s: %s",
                attempt,
                max_retries,
                from_date,
                to_date,
                exc,
            )

    raise AmfiNavFetchError(
        f"AMFI NAV history fetch failed for {from_date}..{to_date} after {max_retries} attempts: {last_error}"
    )


def parse_amfi_nav_date(raw: str) -> date | None:
    raw = raw.strip()
    for fmt in ("%d-%b-%Y", "%d-%B-%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None
