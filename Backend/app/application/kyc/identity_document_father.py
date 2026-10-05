from __future__ import annotations

import re
from typing import Any

KYC_PERSON_NAME_MAX_LENGTH = 80

# Aadhaar / DigiLocker care-of relation prefixes (apply in order; loop until stable).
_FATHER_PREFIX_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"^(?:son|daughter|wife|husband|care|father|mother|so|do|wo|co|ho|fo)\s+of\s*:?\s*",
        re.IGNORECASE,
    ),
    re.compile(
        r"^(?:s|d|w|c|h|f)(?:\s*[/\-]\s*|\s+)o\.?\s*:?\s*",
        re.IGNORECASE,
    ),
    re.compile(
        r"^(?:s|d|w|c|h|f)\.\s*o\.?\s*:?\s*",
        re.IGNORECASE,
    ),
    re.compile(
        r"^(?:so|do|wo|co|ho|fo)\.?\s*:?\s*",
        re.IGNORECASE,
    ),
)


def normalize_fathers_name_value(value: str | None) -> str:
    """Strip DigiLocker care-of / relation prefixes and sanitize for KYC personal draft."""
    raw = str(value or "").strip()
    if not raw:
        return ""
    return sanitize_kyc_person_name(strip_kyc_father_name_prefixes(raw))


def strip_kyc_father_name_prefixes(value: str) -> str:
    result = value.strip()
    while result:
        changed = False
        for pattern in _FATHER_PREFIX_PATTERNS:
            stripped = pattern.sub("", result, count=1).strip()
            if stripped != result:
                result = stripped
                changed = True
                break
        if not changed:
            break
    return result


def sanitize_kyc_person_name(value: str, *, max_length: int = KYC_PERSON_NAME_MAX_LENGTH) -> str:
    cleaned = re.sub(r"[^A-Za-z\s.'-]", "", value)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned[:max_length]


def resolve_fathers_name_from_identity_data(data: dict[str, Any] | None) -> str:
    """Derive father's name from Finprim identity_documents / DigiLocker Aadhaar data."""
    if not data or not isinstance(data, dict):
        return ""

    care_of = str(data.get("care_of") or data.get("careOf") or "").strip()
    father_direct = str(
        data.get("father_name")
        or data.get("fatherName")
        or data.get("fathers_name")
        or data.get("father")
        or ""
    ).strip()

    from_direct = normalize_fathers_name_value(father_direct) if father_direct else ""
    from_care_of = normalize_fathers_name_value(care_of) if care_of else ""
    return from_direct or from_care_of


def resolve_fathers_name_from_care_of(care_of: str | None) -> str:
    raw = str(care_of or "").strip()
    if not raw:
        return ""
    return resolve_fathers_name_from_identity_data({"care_of": raw})
