from __future__ import annotations

from typing import Any

FINPRIM_GENDER_OPTIONS = [
    {"label": "Male", "value": "male"},
    {"label": "Female", "value": "female"},
    {"label": "Other", "value": "transgender"},
]

FINPRIM_MARITAL_STATUS_OPTIONS = [
    {"label": "Single", "value": "unmarried"},
    {"label": "Married", "value": "married"},
    {"label": "Other", "value": "others"},
]

FINPRIM_OCCUPATION_OPTIONS = [
    {"label": "Business", "value": "business"},
    {"label": "Professional", "value": "professional"},
    {"label": "Retired", "value": "retired"},
    {"label": "Homemaker", "value": "housewife"},
    {"label": "Student", "value": "student"},
    {"label": "Public Sector", "value": "public_sector"},
    {"label": "Private Sector", "value": "private_sector"},
    {"label": "Government Sector", "value": "government_sector"},
    {"label": "Other", "value": "others"},
]

FINPRIM_INCOME_SLAB_OPTIONS = [
    {"label": "Up to ₹1 lakh", "value": "upto_1lakh"},
    {"label": "₹1 lakh – ₹5 lakhs", "value": "above_1lakh_upto_5lakh"},
    {"label": "₹5 lakhs – ₹10 lakhs", "value": "above_5lakh_upto_10lakh"},
    {"label": "₹10 lakhs – ₹25 lakhs", "value": "above_10lakh_upto_25lakh"},
    {"label": "₹25 lakhs – ₹1 crore", "value": "above_25lakh_upto_1cr"},
    {"label": "Above ₹1 crore", "value": "above_1cr"},
]

FINPRIM_PEP_OPTIONS = [
    {"label": "No", "value": "not_applicable"},
    {"label": "Yes — I am PEP exposed", "value": "pep_exposed"},
    {"label": "Yes — related to a PEP", "value": "pep_related"},
]

TERMINAL_READINESS_CODES = frozenset({"kyc_deactivated", "kyc_underprocess"})


def master_data_enums() -> dict[str, list[dict[str, str]]]:
    return {
        "gender": FINPRIM_GENDER_OPTIONS,
        "maritalStatus": FINPRIM_MARITAL_STATUS_OPTIONS,
        "occupation": FINPRIM_OCCUPATION_OPTIONS,
        "incomeSlab": FINPRIM_INCOME_SLAB_OPTIONS,
        "pepExposed": FINPRIM_PEP_OPTIONS,
    }


def map_identity_document_to_drafts(document: dict[str, Any]) -> dict[str, Any]:
    data = document.get("data") or {}
    line_1 = str(data.get("line_1") or data.get("line1") or "").strip()
    city = str(data.get("city") or "").strip()
    pincode = str(data.get("pincode") or "").strip()
    country = str(data.get("country") or "in").strip()
    state_name = str(data.get("state_name") or data.get("state") or "").strip()
    father_name = str(data.get("father_name") or "").strip()
    return {
        "addressPrefill": {
            "permanent": {
                "line1": line_1,
                "line2": "",
                "city": city,
                "state": state_name,
                "pincode": pincode,
                "country": "India" if country.lower() in {"in", "india"} else country,
            },
            "sameAsPermanent": True,
        },
        "fathersName": father_name,
        "aadhaarLast4": str(data.get("number") or "")[-4:],
    }
