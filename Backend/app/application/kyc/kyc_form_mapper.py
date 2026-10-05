from __future__ import annotations

import base64
import re
from typing import Any

from app.application.kyc.geolocation_service import round_kyc_geo_coordinate
from app.application.kyc.identity_document_father import normalize_fathers_name_value

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
    "no_exposure": "no_exposure",
    "pep_exposed": "pep",
    "pep": "pep",
    "pep_related": "related_pep",
    "related_pep": "related_pep",
}

POA_KYC_FORM_PATCH_KEYS = frozenset(
    {
        "email_address",
        "phone_number",
        "residential_status",
        "gender",
        "marital_status",
        "father_name",
        "spouse_name",
        "occupation_type",
        "aadhaar_number",
        "country_of_birth",
        "place_of_birth",
        "income_slab",
        "pep_details",
        "citizenship_countries",
        "nationality_country",
        "tax_residency_other_than_india",
        "non_indian_tax_residency_1",
        "non_indian_tax_residency_2",
        "non_indian_tax_residency_3",
        "geolocation",
        "geo_location",
    }
)

POA_PROOF_FIELDS_NEEDED = frozenset({"identity_proof", "address", "signature"})

POA_OCCUPATION_TYPES = frozenset(
    {
        "business",
        "professional",
        "retired",
        "housewife",
        "student",
        "public_sector_service",
        "private_sector_service",
        "government_service",
        "agriculture",
        "doctor",
        "forex_dealer",
        "service",
        "others",
    }
)


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


def build_kyc_form_patch_payload(
    *,
    user_email: str,
    user_phone: str | None,
    journey: Any,
    include_geolocation: bool = True,
) -> dict[str, Any]:
    pan_draft = journey.pan_draft_json or {}
    personal = journey.personal_draft_json or {}
    contact = journey.contact_draft_json or {}

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
    pep = str(personal.get("pepExposed") or "not_applicable").strip().lower()
    nationality = _country_code(str(personal.get("nationality") or "India"))
    place_of_birth = str(personal.get("placeOfBirth") or permanent.get("city") or "India").strip() or "India"

    payload: dict[str, Any] = {
        "email_address": user_email,
        "phone_number": _normalize_phone(user_phone),
        "residential_status": "resident",
        "gender": gender,
        "marital_status": marital_status,
        "occupation_type": _map_poa_occupation(occupation),
        "country_of_birth": nationality,
        "place_of_birth": place_of_birth[:60],
        "income_slab": income_slab,
        "pep_details": PEP_MAP.get(pep, "no_exposure"),
        "citizenship_countries": [nationality],
        "nationality_country": nationality,
        "tax_residency_other_than_india": False,
        "non_indian_tax_residency_1": None,
        "non_indian_tax_residency_2": None,
        "non_indian_tax_residency_3": None,
    }

    father_name = normalize_fathers_name_value(str(personal.get("fathersName") or ""))
    if not father_name and isinstance(contact, dict):
        from app.application.kyc.identity_document_father import resolve_fathers_name_from_care_of

        father_name = resolve_fathers_name_from_care_of(
            str(contact.get("careOf") or contact.get("care_of") or "")
        )
    if father_name:
        payload["father_name"] = father_name

    if marital_status == "married":
        spouse_name = str(personal.get("spouseName") or "").strip()
        if spouse_name:
            payload["spouse_name"] = spouse_name

    if include_geolocation:
        geolocation = journey.geolocation_json or {}
        if geolocation.get("latitude") is not None and geolocation.get("longitude") is not None:
            payload["geolocation"] = {
                "latitude": round_kyc_geo_coordinate(float(geolocation["latitude"])),
                "longitude": round_kyc_geo_coordinate(float(geolocation["longitude"])),
            }

    aadhaar_last4 = str(pan_draft.get("aadhaarLast4") or "").strip()
    if not aadhaar_last4 and isinstance(journey.personal_draft_json, dict):
        aadhaar_last4 = str(journey.personal_draft_json.get("aadhaarLast4") or "").strip()
    digits = "".join(ch for ch in aadhaar_last4 if ch.isdigit())
    if len(digits) >= 4:
        payload["aadhaar_number"] = digits[-4:]

    # Address on the KYC form comes from DigiLocker proof_details, not manual address patches.
    _ = _full_name(pan_draft)
    return payload


def _map_poa_occupation(raw: str) -> str:
    mapped = OCCUPATION_MAP.get(raw, raw)
    if mapped in POA_OCCUPATION_TYPES:
        return mapped
    return "others"


def kyc_form_needs_demographic_patch(form: dict[str, Any], payload: dict[str, Any]) -> bool:
    checks = (
        "email_address",
        "gender",
        "marital_status",
        "occupation_type",
        "income_slab",
        "pep_details",
        "country_of_birth",
        "place_of_birth",
        "nationality_country",
    )
    for key in checks:
        if not str(form.get(key) or "").strip() and payload.get(key):
            return True
    phone = form.get("phone_number")
    if not isinstance(phone, dict) or not str(phone.get("number") or "").strip():
        if payload.get("phone_number"):
            return True
    return False


def filter_kyc_form_patch_for_requirements(
    form: dict[str, Any],
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Only PATCH fields Cybrilla POA expects for the current requirements.fields_needed."""
    req = form.get("requirements") or {}
    fields_needed = req.get("fields_needed")
    if not isinstance(fields_needed, list):
        return payload

    needed = {str(item).strip() for item in fields_needed if item}
    if not needed:
        return payload

    if needed <= POA_PROOF_FIELDS_NEEDED:
        return {}

    allowed = {name for name in needed if name in POA_KYC_FORM_PATCH_KEYS}
    if not allowed:
        return {}

    filtered = {key: value for key, value in payload.items() if key in allowed}
    if "marital_status" in allowed and payload.get("marital_status") == "married":
        if payload.get("spouse_name"):
            filtered["spouse_name"] = payload["spouse_name"]
    if "marital_status" in allowed and payload.get("marital_status") in {"unmarried", "others"}:
        if payload.get("father_name"):
            filtered["father_name"] = payload["father_name"]
    if "tax_residency_other_than_india" in allowed:
        filtered["non_indian_tax_residency_1"] = payload.get("non_indian_tax_residency_1")
        filtered["non_indian_tax_residency_2"] = payload.get("non_indian_tax_residency_2")
        filtered["non_indian_tax_residency_3"] = payload.get("non_indian_tax_residency_3")
    return filtered
