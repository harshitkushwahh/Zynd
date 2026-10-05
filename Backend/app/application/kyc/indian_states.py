from __future__ import annotations

INDIAN_STATE_CODES: dict[str, str] = {
    "Andaman and Nicobar Islands": "AN",
    "Andhra Pradesh": "AP",
    "Arunachal Pradesh": "AR",
    "Assam": "AS",
    "Bihar": "BR",
    "Chandigarh": "CH",
    "Chhattisgarh": "CG",
    "Dadra and Nagar Haveli and Daman and Diu": "DH",
    "Delhi": "DL",
    "Goa": "GA",
    "Gujarat": "GJ",
    "Haryana": "HR",
    "Himachal Pradesh": "HP",
    "Jammu and Kashmir": "JK",
    "Jharkhand": "JH",
    "Karnataka": "KA",
    "Kerala": "KL",
    "Ladakh": "LA",
    "Lakshadweep": "LD",
    "Madhya Pradesh": "MP",
    "Maharashtra": "MH",
    "Manipur": "MN",
    "Meghalaya": "ML",
    "Mizoram": "MZ",
    "Nagaland": "NL",
    "Odisha": "OD",
    "Puducherry": "PY",
    "Punjab": "PB",
    "Rajasthan": "RJ",
    "Sikkim": "SK",
    "Tamil Nadu": "TN",
    "Telangana": "TS",
    "Tripura": "TR",
    "Uttar Pradesh": "UP",
    "Uttarakhand": "UK",
    "West Bengal": "WB",
}

INDIAN_STATE_NAMES: tuple[str, ...] = tuple(INDIAN_STATE_CODES.keys())

STATE_ALIASES: dict[str, str] = {
    "andaman & nicobar islands": "Andaman and Nicobar Islands",
    "andaman and nicobar": "Andaman and Nicobar Islands",
    "dadra and nagar haveli": "Dadra and Nagar Haveli and Daman and Diu",
    "daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
    "delhi nct": "Delhi",
    "jammu & kashmir": "Jammu and Kashmir",
    "nct delhi": "Delhi",
    "nct of delhi": "Delhi",
    "new delhi": "Delhi",
    "orissa": "Odisha",
    "pondicherry": "Puducherry",
    "uttaranchal": "Uttarakhand",
}

DEFAULT_KYC_COUNTRY = "India"


def canonicalize_state_name(candidate: str, extra_states: list[dict[str, str]] | None = None) -> str:
    normalized = str(candidate or "").strip()
    if not normalized:
        return ""

    lower = normalized.casefold()
    alias = STATE_ALIASES.get(lower)
    if alias:
        return alias

    for name in INDIAN_STATE_NAMES:
        if name.casefold() == lower:
            return name

    for item in extra_states or []:
        name = str(item.get("name") or "").strip()
        if name.casefold() == lower:
            return canonicalize_state_name(name) or name

    for name in INDIAN_STATE_NAMES:
        name_lower = name.casefold()
        if lower in name_lower or name_lower in lower:
            return name

    for item in extra_states or []:
        name = str(item.get("name") or "").strip()
        name_lower = name.casefold()
        if name and (lower in name_lower or name_lower in lower):
            return canonicalize_state_name(name) or name

    return normalized


def merge_indian_states(provider_states: list[dict[str, str]]) -> list[dict[str, str]]:
    by_key: dict[str, dict[str, str]] = {}

    for name in INDIAN_STATE_NAMES:
        by_key[name.casefold()] = {
            "name": name,
            "state_code": INDIAN_STATE_CODES.get(name, ""),
            "country_ansi_code": "IN",
        }

    for item in provider_states:
        raw_name = str(item.get("name") or "").strip()
        if not raw_name:
            continue
        canonical = canonicalize_state_name(raw_name, provider_states)
        key = canonical.casefold()
        existing = by_key.get(
            key,
            {
                "name": canonical,
                "state_code": "",
                "country_ansi_code": "IN",
            },
        )
        existing["name"] = canonical if canonical in INDIAN_STATE_NAMES else existing["name"]
        existing["state_code"] = str(item.get("state_code") or existing.get("state_code") or "").strip()
        existing["country_ansi_code"] = str(item.get("country_ansi_code") or "IN").strip() or "IN"
        by_key[key] = existing

    return sorted(by_key.values(), key=lambda row: row["name"].casefold())


def names_loosely_match(left: str, right: str) -> bool:
    first = " ".join(str(left or "").split()).casefold()
    second = " ".join(str(right or "").split()).casefold()
    if not first or not second:
        return False
    return first == second or first in second or second in first


def country_from_ansi(ansi_code: str) -> str:
    code = str(ansi_code or "IN").strip().upper()
    return DEFAULT_KYC_COUNTRY if code in {"", "IN", "IND"} else DEFAULT_KYC_COUNTRY
