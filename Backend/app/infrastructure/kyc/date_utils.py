from __future__ import annotations

import re
from datetime import datetime

_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

_DOB_FORMATS = (
    "%d-%m-%Y",
    "%d/%m/%Y",
    "%d.%m.%Y",
    "%d-%m-%y",
    "%d/%m/%y",
    "%Y/%m/%d",
    "%d %b %Y",
    "%d-%b-%Y",
    "%d/%b/%Y",
)


def normalize_kyc_date_of_birth(raw: str) -> str:
    value = str(raw or "").strip()
    if not value:
        raise ValueError("Date of birth is required.")

    if _ISO_DATE.match(value):
        datetime.strptime(value, "%Y-%m-%d")
        return value

    for fmt in _DOB_FORMATS:
        try:
            return datetime.strptime(value, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue

    raise ValueError(f"Unsupported date of birth format: {value}")
