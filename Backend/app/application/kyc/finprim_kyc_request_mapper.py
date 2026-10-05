from __future__ import annotations

from typing import Any

from app.application.kyc.kyc_form_mapper import build_kyc_form_patch_payload

# Finprim ``kyc_request`` enums differ from Cybrilla POA ``kyc_form`` patch values.
FINPRIM_PEP_DETAILS = frozenset({"pep_exposed", "pep_related", "not_applicable"})

FINPRIM_OCCUPATION_FROM_POA: dict[str, str] = {
    "private_sector_service": "private_sector",
    "public_sector_service": "public_sector",
    "government_service": "government_sector",
    "agriculture": "others",
    "doctor": "professional",
    "forex_dealer": "others",
    "service": "others",
}

FINPRIM_OCCUPATION_TYPES = frozenset(
    {
        "business",
        "professional",
        "retired",
        "housewife",
        "student",
        "public_sector",
        "private_sector",
        "government_sector",
        "others",
    }
)


def _map_finprim_pep_details(personal: dict[str, Any], poa_pep: str | None) -> str:
    raw = str(personal.get("pepExposed") or personal.get("pep_exposed") or "").strip().lower()
    if raw in FINPRIM_PEP_DETAILS:
        return raw
    if raw in {"pep", "yes"}:
        return "pep_exposed"
    if raw in {"related_pep", "pep_related"}:
        return "pep_related"
    if raw in {"no_exposure", "no", "not_applicable", ""}:
        return "not_applicable"
    # POA mapper may have converted to no_exposure / pep / related_pep
    poa_clean = str(poa_pep or "").strip().lower()
    if poa_clean == "pep":
        return "pep_exposed"
    if poa_clean == "related_pep":
        return "pep_related"
    if poa_clean in FINPRIM_PEP_DETAILS:
        return poa_clean
    return "not_applicable"


def _map_finprim_occupation_type(poa_occupation: str | None, personal: dict[str, Any]) -> str:
    raw = str(personal.get("occupation") or "").strip().lower()
    candidate = FINPRIM_OCCUPATION_FROM_POA.get(str(poa_occupation or "").strip().lower(), "")
    if not candidate and raw in FINPRIM_OCCUPATION_TYPES:
        candidate = raw
    if not candidate:
        candidate = FINPRIM_OCCUPATION_FROM_POA.get(raw, raw)
    if candidate in FINPRIM_OCCUPATION_TYPES:
        return candidate
    return "others"


def _strip_none_values(payload: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in payload.items() if value is not None}


def build_finprim_kyc_request_patch(
    *,
    user_email: str,
    user_phone: str | None,
    journey: Any,
    signature_file_id: str | None = None,
) -> dict[str, Any]:
    """Map wizard drafts to Finprim ``PATCH /v2/kyc_requests/{id}`` until ``esign_required``."""
    poa_patch = build_kyc_form_patch_payload(
        user_email=user_email,
        user_phone=user_phone,
        journey=journey,
    )
    identity_document_id = str(journey.external_identity_document_id or "").strip()
    if not identity_document_id:
        raise ValueError("external_identity_document_id is required")

    personal = journey.personal_draft_json if isinstance(journey.personal_draft_json, dict) else {}

    body: dict[str, Any] = {
        "email": user_email,
        "mobile": poa_patch.get("phone_number"),
        "gender": poa_patch.get("gender"),
        "marital_status": poa_patch.get("marital_status"),
        "residential_status": "resident_individual",
        "occupation_type": _map_finprim_occupation_type(
            str(poa_patch.get("occupation_type") or ""),
            personal,
        ),
        "country_of_birth": poa_patch.get("country_of_birth"),
        "place_of_birth": poa_patch.get("place_of_birth"),
        "income_slab": poa_patch.get("income_slab"),
        "pep_details": _map_finprim_pep_details(personal, str(poa_patch.get("pep_details") or "")),
        "citizenship_countries": poa_patch.get("citizenship_countries"),
        "nationality_country": poa_patch.get("nationality_country"),
        "tax_residency_other_than_india": poa_patch.get("tax_residency_other_than_india"),
        "non_indian_tax_residency_1": poa_patch.get("non_indian_tax_residency_1"),
        "non_indian_tax_residency_2": poa_patch.get("non_indian_tax_residency_2"),
        "non_indian_tax_residency_3": poa_patch.get("non_indian_tax_residency_3"),
        "identity_proof": identity_document_id,
        "address": {
            "proof": identity_document_id,
            "proof_type": "aadhaar",
        },
    }
    if poa_patch.get("geolocation"):
        body["geolocation"] = poa_patch["geolocation"]
    if poa_patch.get("father_name"):
        body["father_name"] = poa_patch["father_name"]
    if poa_patch.get("spouse_name"):
        body["spouse_name"] = poa_patch["spouse_name"]
    if poa_patch.get("aadhaar_number"):
        body["aadhaar_number"] = poa_patch["aadhaar_number"]
    if signature_file_id:
        body["signature"] = signature_file_id

    bank_draft = journey.bank_draft_json if isinstance(journey.bank_draft_json, dict) else {}
    account_number = str(bank_draft.get("accountNumber") or "").strip()
    ifsc_code = str(bank_draft.get("ifscCode") or "").strip().upper()
    if account_number and ifsc_code:
        # Finprim kyc_request: account + IFSC only (no account_type on PATCH — POA preverify covers type/holder).
        body["bank_account"] = {
            "account_number": account_number,
            "ifsc_code": ifsc_code,
        }

    return _strip_none_values(body)


def kyc_request_status(payload: dict[str, Any]) -> str:
    return str(payload.get("status") or "").strip().lower()


def kyc_request_fields_needed(payload: dict[str, Any]) -> list[str]:
    requirements = payload.get("requirements") or {}
    fields = requirements.get("fields_needed") if isinstance(requirements, dict) else None
    if not isinstance(fields, list):
        return []
    return [str(item).strip() for item in fields if str(item).strip()]
