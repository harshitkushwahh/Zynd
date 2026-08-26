from __future__ import annotations

import re
import unicodedata
from decimal import Decimal, InvalidOperation


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text).strip("-")
    return slug or "unknown"


def _looks_like_nav_date(raw: str) -> bool:
    raw = raw.strip()
    if not raw:
        return False
    for fmt in ("%d-%b-%Y", "%d-%B-%Y", "%d-%m-%Y"):
        try:
            from datetime import datetime

            datetime.strptime(raw, fmt)
            return True
        except ValueError:
            continue
    return False


def parse_amfi_nav_line(line: str) -> dict | None:
    stripped = line.strip()
    if not stripped or ";" not in stripped:
        return None
    parts = [part.strip() for part in stripped.split(";")]
    if len(parts) < 6:
        return None
    scheme_code = parts[0]
    if not scheme_code.isdigit():
        return None

    # Daily NAVAll.txt (plan/option columns): code;isin;isin_reinv;name;plan;option;nav;date
    if (
        len(parts) >= 8
        and parts[1].upper().startswith("INF")
        and _looks_like_nav_date(parts[7])
    ):
        isin_payout = parts[1]
        isin_reinvest = parts[2]
        scheme_name = parts[3]
        nav_raw = parts[6]
        nav_date_raw = parts[7]
    # History report (DownloadNAVHistoryReport): code;name;isin;isin_reinv;nav;rep;sale;date
    elif len(parts) >= 8 and _looks_like_nav_date(parts[7]):
        scheme_name = parts[1]
        isin_payout = parts[2]
        isin_reinvest = parts[3]
        nav_raw = parts[4]
        nav_date_raw = parts[7]
    elif parts[1].upper().startswith("INF"):
        # Legacy NAVAll.txt: code;isin;isin_reinv;name;nav;date
        isin_payout, isin_reinvest, scheme_name, nav_raw, nav_date_raw = parts[1:6]
    else:
        return None

    isin_growth = (isin_payout or isin_reinvest or "").strip()
    if isin_growth and not isin_growth.upper().startswith("INF"):
        return None
    try:
        nav_value = Decimal(nav_raw)
    except (InvalidOperation, ValueError):
        return None
    if nav_value <= 0:
        return None
    return {
        "scheme_code": scheme_code,
        "isin_growth": isin_growth.upper() if isin_growth else "",
        "isin_div_reinvestment": (isin_reinvest or None),
        "scheme_name": scheme_name,
        "nav_value": nav_value,
        "nav_date_raw": nav_date_raw,
    }


def parse_amfi_nav_file(body: str) -> list[dict]:
    records: list[dict] = []
    for line in body.splitlines():
        parsed = parse_amfi_nav_line(line)
        if parsed:
            records.append(parsed)
    return records


def parse_amfi_nav_file_with_context(body: str) -> list[dict]:
    """Parse NAVAll.txt rows and attach AMC name from section headers."""
    records: list[dict] = []
    current_amc: str | None = None
    for line in body.splitlines():
        parsed = parse_amfi_nav_line(line)
        if parsed:
            parsed["amc_name"] = current_amc
            records.append(parsed)
            continue
        stripped = line.strip()
        if not stripped or ";" in stripped:
            continue
        lowered = stripped.lower()
        if lowered.startswith("open ended") or lowered.startswith("close ended"):
            continue
        if "scheme" in lowered and "(" in stripped:
            continue
        if len(stripped) >= 4:
            current_amc = stripped
    return records
