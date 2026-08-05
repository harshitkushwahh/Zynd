"""Map local KYC + investor drafts to Finprim v2 investor object payloads."""

from __future__ import annotations

from datetime import date
from typing import Any

from app.application.investor.investor_bank_account_crypto import read_account_number
from app.application.kyc.kyc_form_mapper import _full_name
from app.infrastructure.persistence.investor_models import (
    InvestorAddress,
    InvestorBankAccount,
    InvestorEmailAddress,
    InvestorPhoneNumber,
    InvestorRelatedParty,
)
from app.infrastructure.persistence.models import KycJourneyState, User

FP_BANK_TYPE_MAP = {
    "savings": "savings",
    "current": "current",
    "nre_savings": "nre",
    "nro_savings": "nro",
}

FP_RELATIONSHIP_MAP = {
    "father": "father",
    "mother": "mother",
    "spouse": "spouse",
    "son": "son",
    "daughter": "daughter",
    "brother": "brother",
    "sister": "sister",
    "grandfather": "grand_father",
    "grandmother": "grand_mother",
    "father_in_law": "father_in_law",
    "mother_in_law": "mother_in_law",
    "others": "others",
}


class InvestorProvisionValidationError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _str(value: Any) -> str:
    return str(value or "").strip()


def _fp_country(value: str | None) -> str:
    normalized = _str(value).lower()
    if normalized in {"in", "india"}:
        return "IN"
    return normalized.upper()[:8] or "IN"


def _fp_isd(isd: str) -> str:
    raw = _str(isd).lstrip("+")
    return raw[:4] or "91"


def _fp_address_nature(local_nature: str) -> str:
    if local_nature == "business_location":
        return "business_location"
    return "residential"


def _format_date(value: date | str | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, date):
        return value.isoformat()
    raw = _str(value)
    return raw or None


def validate_early_investor_profile_inputs(*, journey: KycJourneyState | None) -> None:
    if journey is None:
        raise InvestorProvisionValidationError("kyc_journey_missing", "KYC journey not found for user")

    pan = journey.pan_draft_json if isinstance(journey.pan_draft_json, dict) else {}
    if journey.pan_verification_status != "verified":
        raise InvestorProvisionValidationError("pan_not_verified", "Verified PAN is required before provisioning")
    if not _str(pan.get("panNumber")):
        raise InvestorProvisionValidationError("pan_missing", "Verified PAN is required before provisioning")
    if not _str(pan.get("dateOfBirth")):
        raise InvestorProvisionValidationError("dob_missing", "Date of birth is required before provisioning")
    if not _full_name(pan):
        raise InvestorProvisionValidationError("name_missing", "Investor name is required before provisioning")


def build_early_investor_profile_payload(*, user: User, journey: KycJourneyState) -> dict[str, Any]:
    """Minimal Finprim investor profile payload after PAN confirmation (before personal/bank steps)."""
    validate_early_investor_profile_inputs(journey=journey)
    pan = journey.pan_draft_json or {}
    personal = journey.personal_draft_json if isinstance(journey.personal_draft_json, dict) else {}
    contact = journey.contact_draft_json if isinstance(journey.contact_draft_json, dict) else {}
    permanent = contact.get("permanent") if isinstance(contact.get("permanent"), dict) else {}

    place_of_birth = _str(personal.get("placeOfBirth")) or _str(permanent.get("city")) or "India"
    return {
        "type": "individual",
        "tax_status": "resident_individual",
        "name": _full_name(pan)[:70],
        "date_of_birth": _str(pan.get("dateOfBirth")),
        "gender": _str(personal.get("gender")) or "male",
        "occupation": _str(personal.get("occupation")) or "others",
        "pan": _str(pan.get("panNumber")).upper(),
        "country_of_birth": "IN",
        "place_of_birth": place_of_birth[:60],
        "nationality_country": "IN",
        "income_slab": _str(personal.get("incomeSlab")) or "upto_1lakh",
        "pep_details": _str(personal.get("pepExposed")) or "not_applicable",
        "source_of_wealth": "salary",
        "use_default_tax_residences": True,
    }


def validate_provision_inputs(*, user: User, journey: KycJourneyState | None) -> None:
    if journey is None:
        raise InvestorProvisionValidationError("kyc_journey_missing", "KYC journey not found for user")

    pan = journey.pan_draft_json if isinstance(journey.pan_draft_json, dict) else {}
    personal = journey.personal_draft_json if isinstance(journey.personal_draft_json, dict) else {}
    bank = journey.bank_draft_json if isinstance(journey.bank_draft_json, dict) else {}

    if not _str(pan.get("panNumber")):
        raise InvestorProvisionValidationError("pan_missing", "Verified PAN is required before provisioning")
    if not _str(pan.get("dateOfBirth")):
        raise InvestorProvisionValidationError("dob_missing", "Date of birth is required before provisioning")
    if not _full_name(pan):
        raise InvestorProvisionValidationError("name_missing", "Investor name is required before provisioning")
    if not _str(personal.get("gender")):
        raise InvestorProvisionValidationError("gender_missing", "Gender is required before provisioning")
    if not _str(personal.get("occupation")):
        raise InvestorProvisionValidationError("occupation_missing", "Occupation is required before provisioning")
    if not _str(personal.get("incomeSlab")):
        raise InvestorProvisionValidationError("income_missing", "Income slab is required before provisioning")
    if not _str(personal.get("pepExposed")):
        raise InvestorProvisionValidationError("pep_missing", "PEP declaration is required before provisioning")
    if not _str(bank.get("accountNumber")) or not _str(bank.get("ifscCode")):
        raise InvestorProvisionValidationError("bank_missing", "Verified bank account is required before provisioning")
    if not _str(user.email):
        raise InvestorProvisionValidationError("email_missing", "User email is required before provisioning")
    if not _str(user.phone):
        raise InvestorProvisionValidationError("phone_missing", "User phone is required before provisioning")


def validate_provision_drafts(
    *,
    addresses: list[InvestorAddress],
    bank_accounts: list[InvestorBankAccount],
    email_addresses: list[InvestorEmailAddress],
    phone_numbers: list[InvestorPhoneNumber],
) -> None:
    if not email_addresses:
        raise InvestorProvisionValidationError("email_draft_missing", "Investor email draft is missing")
    if not phone_numbers:
        raise InvestorProvisionValidationError("phone_draft_missing", "Investor phone draft is missing")
    if not bank_accounts:
        raise InvestorProvisionValidationError("bank_draft_missing", "Investor bank draft is missing")
    if not any(address.nature != "correspondence" for address in addresses):
        raise InvestorProvisionValidationError("address_draft_missing", "Investor address draft is missing")


def build_investor_profile_payload(*, user: User, journey: KycJourneyState) -> dict[str, Any]:
    validate_provision_inputs(user=user, journey=journey)
    pan = journey.pan_draft_json or {}
    personal = journey.personal_draft_json or {}
    contact = journey.contact_draft_json if isinstance(journey.contact_draft_json, dict) else {}
    permanent = contact.get("permanent") if isinstance(contact.get("permanent"), dict) else {}

    place_of_birth = _str(personal.get("placeOfBirth")) or _str(permanent.get("city")) or "India"
    return {
        "type": "individual",
        "tax_status": "resident_individual",
        "name": _full_name(pan)[:70],
        "date_of_birth": _str(pan.get("dateOfBirth")),
        "gender": _str(personal.get("gender")),
        "occupation": _str(personal.get("occupation")),
        "pan": _str(pan.get("panNumber")).upper(),
        "country_of_birth": "IN",
        "place_of_birth": place_of_birth[:60],
        "nationality_country": "IN",
        "income_slab": _str(personal.get("incomeSlab")),
        "pep_details": _str(personal.get("pepExposed")),
        "source_of_wealth": "salary",
        "use_default_tax_residences": True,
    }


def build_bank_account_payload(
    *,
    profile_id: str,
    bank_row: InvestorBankAccount,
    journey: KycJourneyState,
) -> dict[str, Any]:
    bank_draft = journey.bank_draft_json if journey and isinstance(journey.bank_draft_json, dict) else {}
    account_number = read_account_number(bank_row) or ""
    if not account_number:
        account_number = _str(bank_draft.get("accountNumber"))
    if not account_number:
        raise InvestorProvisionValidationError("bank_missing", "Full bank account number is unavailable")

    holder = _str(bank_row.pan_account_holder_name) or _str(bank_row.primary_account_holder_name)
    if not holder:
        holder = _str(bank_draft.get("panAccountHolderName")) or _str(bank_draft.get("accountHolderName"))
    if not holder:
        holder = bank_row.primary_account_holder_name

    payload: dict[str, Any] = {
        "profile": profile_id,
        "account_number": account_number,
        "primary_account_holder_name": holder[:120],
        "type": FP_BANK_TYPE_MAP.get(bank_row.account_type, bank_row.account_type),
        "ifsc_code": bank_row.ifsc_code.upper(),
    }
    cheque_id = _str(bank_row.cancelled_cheque_file_id)
    if cheque_id:
        payload["cancelled_cheque"] = cheque_id
    return payload


def build_address_payload(*, profile_id: str, address_row: InvestorAddress) -> dict[str, Any]:
    return {
        "profile": profile_id,
        "line1": address_row.line1,
        "line2": address_row.line2,
        "line3": address_row.line3,
        "city": address_row.city,
        "state": address_row.state,
        "postal_code": address_row.postal_code,
        "country": _fp_country(address_row.country),
        "nature": _fp_address_nature(address_row.nature),
    }


def build_email_payload(*, profile_id: str, email_row: InvestorEmailAddress) -> dict[str, Any]:
    return {
        "profile": profile_id,
        "email": email_row.email.lower(),
    }


def build_phone_payload(*, profile_id: str, phone_row: InvestorPhoneNumber) -> dict[str, Any]:
    return {
        "profile": profile_id,
        "isd": _fp_isd(phone_row.isd),
        "number": phone_row.number,
    }


def _normalize_party_relationship(value: str) -> str:
    normalized = _str(value).lower().replace(" ", "_")
    return FP_RELATIONSHIP_MAP.get(normalized, normalized or "others")


def build_related_party_payload(*, profile_id: str, party_row: InvestorRelatedParty) -> dict[str, Any]:
    relationship = _normalize_party_relationship(party_row.party_relationship)
    payload: dict[str, Any] = {
        "profile": profile_id,
        "name": party_row.name[:40],
        "relationship": relationship,
    }
    dob = _format_date(party_row.date_of_birth)
    if dob:
        payload["date_of_birth"] = dob
    if party_row.pan:
        payload["pan"] = party_row.pan.upper()
    if party_row.guardian_name:
        payload["guardian_name"] = party_row.guardian_name[:120]
    if party_row.guardian_pan:
        payload["guardian_pan"] = party_row.guardian_pan.upper()
    return payload


def _nominee_draft_from_row(party_row: InvestorRelatedParty) -> dict[str, Any]:
    raw = party_row.external_payload_json
    if isinstance(raw, dict):
        draft = raw.get("kyc_nominee")
        if isinstance(draft, dict):
            return draft
    return {}


def _fp_phone_from_raw(value: Any) -> dict[str, str] | None:
    if not isinstance(value, str):
        return None
    raw = value.strip()
    if not raw:
        return None
    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) < 10:
        return None
    return {"isd": "+91", "number": digits[-10:]}


def _fp_address_from_nominee_draft(draft: dict[str, Any]) -> dict[str, Any] | None:
    address = draft.get("address")
    if not isinstance(address, dict):
        return None
    line1 = _str(address.get("line1"))
    postal_code = _str(address.get("pincode") or address.get("postal_code"))
    if not line1 or not postal_code:
        return None
    country = _str(address.get("country")) or "in"
    return {
        "line1": line1[:255],
        "line2": _str(address.get("line2"))[:255] or None,
        "line3": None,
        "city": _str(address.get("city"))[:120] or None,
        "state": _str(address.get("state"))[:120] or None,
        "postal_code": postal_code[:16],
        "country": _fp_country(country),
    }


def build_related_party_patch_payload(*, party_row: InvestorRelatedParty) -> dict[str, Any] | None:
    if not party_row.external_related_party_id:
        return None

    draft = _nominee_draft_from_row(party_row)
    payload: dict[str, Any] = {"id": party_row.external_related_party_id}

    if party_row.pan:
        payload["pan"] = party_row.pan.upper()

    contact = draft.get("contact") if isinstance(draft.get("contact"), dict) else {}
    email = _str(contact.get("email"))
    if email:
        payload["email_address"] = email.lower()

    phone = _fp_phone_from_raw(contact.get("mobile"))
    if phone:
        payload["phone_number"] = phone

    address = _fp_address_from_nominee_draft(draft)
    if address:
        payload["address"] = address

    guardian = draft.get("guardian") if isinstance(draft.get("guardian"), dict) else {}
    if party_row.guardian_pan:
        payload["guardian_pan"] = party_row.guardian_pan.upper()
    guardian_email = _str(guardian.get("email"))
    if guardian_email:
        payload["guardian_email_address"] = guardian_email.lower()
    guardian_phone = _fp_phone_from_raw(guardian.get("mobile"))
    if guardian_phone:
        payload["guardian_phone_number"] = guardian_phone

    if len(payload) <= 1:
        return None
    return payload
