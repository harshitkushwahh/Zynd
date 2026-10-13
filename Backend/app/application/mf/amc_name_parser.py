from __future__ import annotations

import re

# Longest-first prefixes for scheme-name AMC extraction.
_KNOWN_AMC_PREFIXES: tuple[str, ...] = (
    "Aditya Birla Sun Life",
    "ICICI Prudential",
    "Nippon India",
    "Franklin Templeton",
    "Mirae Asset",
    "Motilal Oswal",
    "Bandhan",
    "Baroda BNP Paribas",
    "Bank of India",
    "Canara Robeco",
    "Edelweiss",
    "HSBC",
    "Invesco",
    "JM Financial",
    "Kotak Mahindra",
    "Kotak",
    "L&T",
    "Mahindra Manulife",
    "PGIM India",
    "Quant Mutual Fund",
    "Quantum",
    "Samco",
    "Sundaram",
    "Tata",
    "Trust Mutual Fund",
    "Union",
    "UTI",
    "WhiteOak Capital",
    "360 ONE",
    "Axis",
    "DSP",
    "HDFC",
    "HSBC",
    "ICICI",
    "IDBI",
    "IIFL",
    "ITI",
    "Lic",
    "LIC",
    "PPFAS",
    "SBI",
    "Shriram",
    "Groww",
    "Zerodha",
    "Abakkus",
)


_CANONICAL_AMC_NAMES: dict[str, str] = {
    "kotak mutual fund": "Kotak Mahindra Mutual Fund",
    "kotak mahindra mutual fund": "Kotak Mahindra Mutual Fund",
}


def canonical_amc_display_name(name: str) -> str:
    key = name.strip().lower()
    return _CANONICAL_AMC_NAMES.get(key, name.strip())


def parse_amc_from_scheme_name(scheme_name: str) -> str | None:
    name = scheme_name.strip()
    if not name:
        return None
    for prefix in _KNOWN_AMC_PREFIXES:
        if name.lower().startswith(prefix.lower()):
            parsed = prefix if prefix.endswith("Mutual Fund") else f"{prefix} Mutual Fund"
            return canonical_amc_display_name(parsed)
    match = re.match(r"^([A-Za-z0-9&\.\-\s]+?)\s+(?:Mutual Fund|MF)\b", name, re.IGNORECASE)
    if match:
        base = match.group(1).strip()
        if len(base) >= 3:
            return canonical_amc_display_name(f"{base} Mutual Fund")
    return None


def normalize_amc_display_name(raw: str | None) -> str | None:
    if not raw:
        return None
    text = raw.strip()
    if not text:
        return None
    if "mutual fund" not in text.lower() and not text.lower().endswith(" mf"):
        if text.lower().endswith(" amc"):
            return text
        return f"{text} Mutual Fund" if "Mutual Fund" not in text else text
    return text
