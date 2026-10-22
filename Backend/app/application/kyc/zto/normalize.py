"""Normalization + extraction of review-form fields from raw Cybrilla lookup payloads."""

from __future__ import annotations

import json
import re
from datetime import date, datetime, timezone
from typing import Any, Mapping

ADDRESS_REVIEW_FIELDS = ("address_line_1", "address_line_2", "city", "state", "pincode")

REVIEW_FIELDS = (
    "name",
    "pan",
    "date_of_birth",
    "bank_account_number",
    "ifsc_code",
    *ADDRESS_REVIEW_FIELDS,
)

_PINCODE_RE = re.compile(r"^[1-9][0-9]{5}$")

_PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
_IFSC_RE = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")
_ACCOUNT_RE = re.compile(r"^[0-9]{6,24}$")
_DOB_FORMATS = ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y")


class ZtoValidationError(ValueError):
    def __init__(self, field: str, message: str) -> None:
        super().__init__(message)
        self.field = field
        self.message = message


def _clean(value: Any) -> str | None:
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text or None


def normalize_name(value: Any) -> str | None:
    return _clean(value)


def normalize_pan(value: Any) -> str | None:
    text = _clean(value)
    return text.replace(" ", "").upper() if text else None


def normalize_ifsc(value: Any) -> str | None:
    text = _clean(value)
    return text.replace(" ", "").upper() if text else None


def normalize_account(value: Any) -> str | None:
    text = _clean(value)
    return re.sub(r"[\s-]", "", text) if text else None


def normalize_address(value: Any) -> str | None:
    return _clean(value)


def normalize_dob(value: Any) -> str | None:
    """Return ISO yyyy-mm-dd, or None when blank. Raises ValueError when unparseable."""
    text = _clean(value)
    if not text:
        return None
    if isinstance(value, (date, datetime)):
        return (value.date() if isinstance(value, datetime) else value).isoformat()
    for fmt in _DOB_FORMATS:
        try:
            return datetime.strptime(text[:10], fmt).date().isoformat()
        except ValueError:
            continue
    raise ValueError(f"Unparseable date: {text}")


def _lenient(fn, value: Any) -> str | None:
    try:
        return fn(value)
    except ValueError:
        return None


def validate_review_field(field: str, value: Any) -> str | None:
    """Normalize + validate a user-submitted review field. Blank values become None."""
    if field == "name":
        return normalize_name(value)
    if field in ("address_line_1", "address_line_2", "city", "state"):
        return normalize_address(value)
    if field == "pincode":
        pin = _clean(value)
        if not pin:
            return None
        if not _PINCODE_RE.match(pin):
            raise ZtoValidationError(field, "Enter a valid 6-digit pincode.")
        return pin
    if field == "address_line":
        return normalize_address(value)
    if field == "pan":
        pan = normalize_pan(value)
        if pan and not _PAN_RE.match(pan):
            raise ZtoValidationError(field, "Enter a valid PAN (e.g. ABCDE1234F).")
        return pan
    if field == "ifsc_code":
        ifsc = normalize_ifsc(value)
        if ifsc and not _IFSC_RE.match(ifsc):
            raise ZtoValidationError(field, "Enter a valid IFSC code.")
        return ifsc
    if field == "bank_account_number":
        account = normalize_account(value)
        if account and not _ACCOUNT_RE.match(account):
            raise ZtoValidationError(field, "Enter a valid bank account number.")
        return account
    if field == "date_of_birth":
        try:
            dob = normalize_dob(value)
        except ValueError as exc:
            raise ZtoValidationError(field, "Enter a valid date of birth.") from exc
        if dob and datetime.strptime(dob, "%Y-%m-%d").date() > date.today():
            raise ZtoValidationError(field, "Date of birth cannot be in the future.")
        return dob
    raise ZtoValidationError(field, "Unknown field.")


def _first(mapping: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if mapping.get(key) not in (None, ""):
            return mapping[key]
    return None


def _data_block(payload: dict[str, Any] | None) -> Any:
    if not payload:
        return None
    return payload.get("data", payload)


def _empty_address_parts() -> dict[str, str | None]:
    return dict.fromkeys(ADDRESS_REVIEW_FIELDS)


def _extract_address_parts(raw: Any) -> dict[str, str | None]:
    parts = _empty_address_parts()
    if raw is None:
        return parts
    if isinstance(raw, list):
        raw = raw[0] if raw else None
    if isinstance(raw, str):
        parts["address_line_1"] = normalize_address(raw)
        return parts
    if not isinstance(raw, dict):
        return parts
    line1 = _first(raw, "line1", "line_1", "address_line_1", "line", "address")
    line2 = _first(raw, "line2", "line_2", "address_line_2", "line3", "line_3", "address_line_3")
    parts["address_line_1"] = normalize_address(line1)
    parts["address_line_2"] = normalize_address(line2)
    parts["city"] = normalize_address(_first(raw, "city", "district"))
    parts["state"] = normalize_address(_first(raw, "state", "state_code"))
    pin = _clean(_first(raw, "pincode", "pin_code", "postal_code"))
    parts["pincode"] = pin if pin else None
    return parts


def format_address_display(parts_or_snapshot: Mapping[str, Any]) -> str | None:
    """Single-line address for display (API `address_line`)."""
    legacy = _clean(parts_or_snapshot.get("address_line"))
    if legacy:
        return legacy
    segments = [parts_or_snapshot.get(key) for key in ADDRESS_REVIEW_FIELDS]
    joined = ", ".join(str(part).strip() for part in segments if part not in (None, ""))
    return joined or None


def address_parts_to_storage(parts: Mapping[str, Any]) -> str | None:
    payload = {key: normalize_address(parts.get(key)) if key != "pincode" else _clean(parts.get(key)) for key in ADDRESS_REVIEW_FIELDS}
    if not any(payload.values()):
        return None
    return json.dumps(payload, separators=(",", ":"))


def address_parts_from_storage(raw: str | None) -> dict[str, str | None]:
    parts = _empty_address_parts()
    if not raw:
        return parts
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parts["address_line_1"] = normalize_address(raw)
        return parts
    if not isinstance(parsed, dict):
        parts["address_line_1"] = normalize_address(raw)
        return parts
    for key in ADDRESS_REVIEW_FIELDS:
        value = parsed.get(key)
        parts[key] = _clean(value) if key == "pincode" else normalize_address(value)
    return parts


def extract_bank_fields(payload: dict[str, Any] | None) -> dict[str, str | None]:
    data = _data_block(payload)
    account: Any = None
    if isinstance(data, dict):
        accounts = data.get("bank_accounts") or data.get("accounts")
        account = accounts[0] if isinstance(accounts, list) and accounts else data
    elif isinstance(data, list) and data:
        account = data[0]
    if not isinstance(account, dict):
        return {"bank_account_number": None, "ifsc_code": None}
    return {
        "bank_account_number": normalize_account(_first(account, "account_number", "bank_account_number")),
        "ifsc_code": normalize_ifsc(_first(account, "ifsc_code", "ifsc")),
    }


def extract_customer_fields(payload: dict[str, Any] | None) -> dict[str, str | None]:
    data = _data_block(payload)
    if not isinstance(data, dict):
        base: dict[str, str | None] = {"name": None, "pan": None, "date_of_birth": None}
        base.update(_empty_address_parts())
        return base
    address_raw = _first(data, "addresses", "address")
    result: dict[str, str | None] = {
        "name": normalize_name(_first(data, "name", "full_name")),
        "pan": normalize_pan(_first(data, "pan", "pan_number")),
        "date_of_birth": _lenient(normalize_dob, _first(data, "date_of_birth", "dob")),
    }
    result.update(_extract_address_parts(address_raw))
    return result


def build_lookup_snapshot(
    bank_payload: dict[str, Any] | None,
    customer_payload: dict[str, Any] | None,
) -> dict[str, str | None]:
    """Normalized values Cybrilla returned (None when absent) for every review field."""
    snapshot: dict[str, str | None] = dict.fromkeys(REVIEW_FIELDS)
    snapshot.update(extract_bank_fields(bank_payload))
    snapshot.update(extract_customer_fields(customer_payload))
    return snapshot


_LOOPBACK_V6 = frozenset({"::1", "0:0:0:0:0:0:0:1"})


def normalize_lookup_phone(phone: str | None) -> str:
    """Ten-digit mobile key sent to Cybrilla lookup create (matches Multiplus phoneKey)."""
    if not phone:
        return ""
    digits = re.sub(r"\D", "", phone)
    if len(digits) > 10:
        digits = digits[-10:]
    return digits


def normalize_lookup_consent_ip(ip: str | None) -> str:
    """Cybrilla consent blocks expect a usable IPv4; local dev often records ::1."""
    if not ip or not ip.strip():
        return "127.0.0.1"
    cleaned = ip.strip()
    if cleaned in _LOOPBACK_V6:
        return "127.0.0.1"
    return cleaned


def format_lookup_consent_collected_at(collected_at: datetime) -> str:
    """Naive ISO timestamp without fractional seconds (Multiplus LocalDateTime.toString())."""
    dt = collected_at
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt.replace(microsecond=0).isoformat(timespec="seconds")


def build_cybrilla_lookup_consent(
    *,
    text: str,
    mode: str,
    collected_at: datetime,
    ip_address: str | None,
) -> dict[str, str]:
    return {
        "collected_at": format_lookup_consent_collected_at(collected_at),
        "text": text,
        "mode": mode,
        "ip_address": normalize_lookup_consent_ip(ip_address),
    }
