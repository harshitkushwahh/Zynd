from __future__ import annotations

import asyncio
import logging
from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

AMFI_BASE = "https://www.amfiindia.com"
AMFI_PORTAL = "https://portal.amfiindia.com"

_DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
}


def _referer_headers(referer_path: str) -> dict[str, str]:
    return {**_DEFAULT_HEADERS, "Referer": f"{AMFI_BASE}/{referer_path.lstrip('/')}"}


async def amfi_get_json(path: str, *, referer: str, params: dict[str, Any] | None = None) -> Any:
    settings = get_settings()
    timeout = float(settings.zynd_mf_fetch_timeout_seconds)
    async with httpx.AsyncClient(base_url=AMFI_BASE, timeout=timeout, follow_redirects=True) as client:
        response = await client.get(path, params=params or {}, headers=_referer_headers(referer))
        response.raise_for_status()
        return response.json()


async def amfi_get_bytes(url: str, *, referer: str | None = None) -> bytes:
    settings = get_settings()
    timeout = float(settings.zynd_mf_fetch_timeout_seconds)
    headers = dict(_DEFAULT_HEADERS)
    if referer:
        headers["Referer"] = referer if referer.startswith("http") else f"{AMFI_BASE}/{referer.lstrip('/')}"
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        return response.content


async def fetch_ter_page(*, month: str, page: int, page_size: int) -> tuple[list[dict], dict]:
    payload = await amfi_get_json(
        "/api/populate-te-rdata-revised",
        referer="ter-of-mf-schemes",
        params={
            "MF_ID": "All",
            "Month": month,
            "strCat": "-1",
            "strType": "-1",
            "page": page,
            "pageSize": page_size,
        },
    )
    if isinstance(payload, list):
        return payload, {}
    rows = payload.get("data") or []
    meta = payload.get("meta") or {}
    return rows if isinstance(rows, list) else [], meta


async def fetch_latest_ter_month(*, financial_year: str) -> str:
    months = await amfi_get_json(
        "/api/populate-ter-month",
        referer="ter-of-mf-schemes",
        params={"year": financial_year},
    )
    if not months:
        raise ValueError(f"No TER months for financial year {financial_year}")
    return str(months[0]["MonthNumber"])


async def fetch_all_ter_rows(*, month: str, page_size: int, max_pages: int | None = None) -> list[dict]:
    first_rows, meta = await fetch_ter_page(month=month, page=1, page_size=page_size)
    page_count = int(meta.get("pageCount") or 1)
    if max_pages is not None:
        page_count = min(page_count, max_pages)

    all_rows = list(first_rows)
    print(
        f"AMFI TER fetch: page 1/{page_count} rows={len(all_rows)}",
        flush=True,
    )
    for page in range(2, page_count + 1):
        rows, _ = await fetch_ter_page(month=month, page=page, page_size=page_size)
        all_rows.extend(rows)
        if page % 5 == 0 or page == page_count:
            print(
                f"AMFI TER fetch: page {page}/{page_count} rows={len(all_rows)}",
                flush=True,
            )
        if page % 10 == 0:
            await asyncio.sleep(0.05)
    return all_rows


async def discover_aaum_fy_and_period(*, str_type: str) -> tuple[int, int, str, str]:
    payload = await amfi_get_json(
        "/api/average-aum-schemewise",
        referer="aum-data/average-aum",
        params={"strType": str_type, "MF_ID": "0"},
    )
    if isinstance(payload, dict) and payload.get("type") == "financial_years":
        years = payload.get("data") or []
        if not years:
            raise ValueError("No AAUM financial years returned")
        fy_id = int(years[0]["id"])
        period_payload = await amfi_get_json(
            "/api/average-aum-schemewise",
            referer="aum-data/average-aum",
            params={"strType": str_type, "fyId": fy_id, "MF_ID": "0"},
        )
        periods = (period_payload.get("data") or {}).get("periods") or []
        if not periods:
            raise ValueError(f"No AAUM periods for fyId={fy_id}")
        period_id = int(periods[0]["id"])
        fy_label = str((period_payload.get("data") or {}).get("financial_year") or "")
        period_label = str(periods[0].get("period") or "")
        return fy_id, period_id, fy_label, period_label

    raise ValueError("Unexpected AAUM discovery response")


async def fetch_aaum_schemewise_json(*, str_type: str, fy_id: int, period_id: int) -> list[dict]:
    payload = await amfi_get_json(
        "/api/average-aum-schemewise",
        referer="aum-data/average-aum",
        params={
            "strType": str_type,
            "fyId": fy_id,
            "periodId": period_id,
            "MF_ID": "0",
        },
    )
    data = payload.get("data") if isinstance(payload, dict) else payload
    return data if isinstance(data, list) else []


def build_monthly_aum_portal_url(month_start) -> str:
    month_abbr = month_start.strftime("%b").lower()
    year = month_start.year
    return f"{AMFI_PORTAL}/spages/am{month_abbr}{year}repo.xls"


def encode_param(value: str) -> str:
    return quote(value, safe="")
