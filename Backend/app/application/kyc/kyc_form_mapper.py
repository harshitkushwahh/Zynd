from __future__ import annotations

import base64
import re
from typing import Any

ACCOUNT_TYPE_MAP = {
    "Savings": "savings",
    "Current": "current",
    "NRE": "nre_savings",
    "NRO": "nro_savings",
}

OCCUPATION_MAP = {
    "business": "business",
    "professional": "professional",
    "retired": "retired",
    "housewife": "housewife",
    "student": "student",
    "public_sector": "public_sector_service",
    "private_sector": "private_sector_service",
    "government_sector": "government_service",
    "others": "others",
}

MARITAL_STATUS_MAP = {
    "single": "unmarried",
    "unmarried": "unmarried",
    "married": "married",
    "others": "others",
}

INCOME_SLAB_MAP = {
    "below_1l": "upto_1lakh",
    "upto_1lakh": "upto_1lakh",
    "above_1lakh_upto_5lakh": "above_1lakh_upto_5lakh",
    "above_5lakh_upto_10lakh": "above_5lakh_upto_10lakh",
    "above_10lakh_upto_25lakh": "above_10lakh_upto_25lakh",
    "above_25lakh_upto_1cr": "above_25lakh_upto_1cr",
    "above_1cr": "above_1cr",
}

PEP_MAP = {
    "not_applicable": "no_exposure",
    "pep_exposed": "pep",
    "pep_related": "related_pep",
}


def _full_name(pan_draft: dict[str, Any]) -> str:
    middle = str(pan_draft.get("middleName") or "").strip()
    first = str(pan_draft.get("firstName") or "").strip()
    last = str(pan_draft.get("lastName") or "").strip()
    if pan_draft.get("fullName"):
        return str(pan_draft["fullName"]).strip()
    return " ".join(part for part in [first, middle, last] if part).strip()


def _country_code(value: str) -> str:
    normalized = value.strip().lower()
    if normalized in {"in", "india"}:
        return "in"
    return normalized[:2] if len(normalized) == 2 else normalized


def _normalize_phone(phone: str | None) -> dict[str, str]:
    raw = (phone or "").strip()
    if raw.startswith("+91"):
        raw = raw[3:]
    raw = raw.lstrip("+").replace(" ", "")
    return {"isd": "+91", "number": raw or "9999999999"}


def data_url_to_file(data_url: str) -> tuple[bytes, str, str]:
    match = re.match(r"^data:([^;]+);base64,(.+)$", data_url.strip())
    if not match:
        raise ValueError("Invalid signature data URL.")
    content_type = match.group(1)
    content = base64.b64decode(match.group(2))
    extension = "png" if "png" in content_type else "jpg"
    return content, f"signature.{extension}", content_type


def _map_cybrilla_address(raw: dict[str, Any] | None) -> dict[str, str] | None:
    if not raw:
        return None
    line_1 = str(raw.get("line1") or raw.get("line_1") or "").strip()
    if not line_1:
        return None
    country = _country_code(str(raw.get("country") or "India"))
    payload = {
        "line_1": line_1[:120],
        "city": str(raw.get("city") or "").strip()[:60],
        "state": str(raw.get("state") or "").strip()[:60],
        "pincode": str(raw.get("pincode") or raw.get("postal_code") or "").strip()[:10],
        "country": country,
    }
    line_2 = str(raw.get("line2") or raw.get("line_2") or "").strip()
    if line_2:
        payload["line_2"] = line_2[:120]
    line_3 = str(raw.get("line3") or raw.get("line_3") or "").strip()
    if line_3:
        payload["line_3"] = line_3[:120]
    return payload


def _map_nominees_for_kyc_form(nominee_draft: Any) -> list[dict[str, Any]]:
    if not isinstance(nominee_draft, list):
        return []
    nominees: list[dict[str, Any]] = []
    for item in nominee_draft:
        if not isinstance(item, dict):
            continue
        core = item.get("core") if isinstance(item.get("core"), dict) else {}
        name = str(core.get("fullName") or "").strip()
        if not name:
            continue
        entry: dict[str, Any] = {
            "name": name[:120],
            "relationship": str(core.get("relationship") or "others").strip(),
        }
        dob = str(core.get("dateOfBirth") or "").strip()
        if dob:
            entry["date_of_birth"] = dob
        share = str(core.get("sharePercent") or "").strip()
        if share:
            try:
                entry["allocation_percentage"] = int(float(share))
            except ValueError:
                pass
        nominees.append(entry)
    return nominees


def build_kyc_form_patch_payload(
    *,
    user_email: str,
    user_phone: str | None,
    journey: Any,
) -> dict[str, Any]:
    pan_draft = journey.pan_draft_json or {}
    personal = journey.personal_draft_json or {}
    contact = journey.contact_draft_json or {}
    bank = journey.bank_draft_json or {}
    nominee_draft = journey.nominee_draft_json

    permanent = (contact.get("permanent") or {}) if isinstance(contact, dict) else {}
    gender = str(personal.get("gender") or "").strip().lower() or "male"
    marital_status = MARITAL_STATUS_MAP.get(
        str(personal.get("maritalStatus") or "").strip().lower(),
        "unmarried",
    )
    occupation = str(personal.get("occupation") or "").strip().lower() or "others"
    income_slab = INCOME_SLAB_MAP.get(
        str(personal.get("incomeSlab") or "").strip().lower(),
        "upto_1lakh",
    )
    pep = str(personal.get("pepExposed") or "").strip().lower() or "no_exposure"
    nationality = _country_code(str(personal.get("nationality") or "India"))
    place_of_birth = str(personal.get("placeOfBirth") or permanent.get("city") or "India").strip() or "India"

    payload: dict[str, Any] = {
        "email_address": user_email,
        "phone_number": _normalize_phone(user_phone),
        "residential_status": "resident",
        "gender": gender,
        "marital_status": marital_status,
        "occupation_type": OCCUPATION_MAP.get(occupation, occupation),
        "country_of_birth": nationality,
        "place_of_birth": place_of_birth[:60],
        "income_slab": income_slab,
        "pep_details": PEP_MAP.get(pep, pep),
        "citizenship_countries": [nationality],
        "nationality_country": nationality,
        "tax_residency_other_than_india": False,
    }

    father_name = str(personal.get("fathersName") or "").strip()
    if father_name:
        payload["father_name"] = father_name

    if marital_status == "married":
        spouse_name = str(personal.get("spouseName") or "").strip()
        if spouse_name:
            payload["spouse_name"] = spouse_name

    geolocation = journey.geolocation_json or {}
    if geolocation.get("latitude") is not None and geolocation.get("longitude") is not None:
        payload["geolocation"] = {
            "latitude": float(geolocation["latitude"]),
            "longitude": float(geolocation["longitude"]),
        }

    aadhaar_last4 = str(pan_draft.get("aadhaarLast4") or "").strip()
    if not aadhaar_last4 and isinstance(journey.personal_draft_json, dict):
        aadhaar_last4 = str(journey.personal_draft_json.get("aadhaarLast4") or "").strip()
    if aadhaar_last4:
        payload["aadhaar_number"] = aadhaar_last4[-4:]

    permanent_address = _map_cybrilla_address(permanent if isinstance(permanent, dict) else None)
    if permanent_address:
        payload["permanent_address"] = permanent_address

    correspondence_raw = contact.get("correspondence") if isinstance(contact, dict) else None
    if contact.get("sameAsPermanent"):
        correspondence_address = permanent_address
    else:
        correspondence_address = _map_cybrilla_address(
            correspondence_raw if isinstance(correspondence_raw, dict) else None
        )
    if correspondence_address:
        payload["correspondence_address"] = correspondence_address

    nominees = _map_nominees_for_kyc_form(nominee_draft)
    if nominees:
        payload["nominees"] = nominees

    _ = bank  # bank verified via POA preverify; not embedded on kyc_form patch payload
    _ = _full_name(pan_draft)
    return payload
