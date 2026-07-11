from __future__ import annotations

import asyncio
import re
import uuid
from typing import Any

from app.core.config import get_settings

_CORPORATE_PAN = re.compile(r"^[A-Z]{3}[C][A-Z][0-9]{4}[A-Z]$")
_INDIVIDUAL_PAN = re.compile(r"^[A-Z]{3}[P][A-Z][0-9]{4}[A-Z]$")
_INVALID_PAN = re.compile(r"^[A-Z]{3}[I][0-9]{4}[A-Z]$")
_AADHAAR_NOT_LINKED = re.compile(r"^[A-Z]{3}[A][N][0-9]{4}[A-Z]$")
_KRA_REGISTERED = re.compile(r"^[A-Z]{3}[R][A-Z][0-9]{4}[A-Z]$")


def _split_name(full_name: str) -> tuple[str, str]:
    parts = [part for part in full_name.strip().split() if part]
    if not parts:
        return "INVESTOR", "USER"
    if len(parts) == 1:
        return parts[0], parts[0]
    return parts[0], parts[-1]


async def stub_kyckart_pan_to_name_dob(pan_number: str) -> dict[str, Any]:
    await asyncio.sleep(0.05)
    pan = pan_number.upper()
    if _CORPORATE_PAN.match(pan):
        return {
            "firstName": "ACME",
            "lastName": "CORPORATION",
            "fullName": "ACME CORPORATION",
            "dateOfBirth": "1990-01-15",
            "panCategory": "corporate",
        }
    first, last = _split_name("RAHUL SHARMA")
    if pan.startswith("LORD"):
        first, last = "Lord", "Voldemort"
    return {
        "firstName": first,
        "lastName": last,
        "fullName": f"{first} {last}".strip(),
        "dateOfBirth": "1992-09-12",
        "panCategory": "individual",
    }


async def stub_poa_readiness(pan_number: str) -> dict[str, Any]:
    await asyncio.sleep(0.05)
    pan = pan_number.upper()
    if _KRA_REGISTERED.match(pan):
        return {
            "id": f"pv_stub_readiness_{uuid.uuid4().hex[:12]}",
            "status": "completed",
            "readiness": {"status": "verified", "code": None, "reason": None},
        }
    if pan.startswith("DEAD"):
        return {
            "id": f"pv_stub_readiness_{uuid.uuid4().hex[:12]}",
            "status": "completed",
            "readiness": {
                "status": "failed",
                "code": "kyc_deactivated",
                "reason": "KYC record deactivated at KRA.",
            },
        }
    return {
        "id": f"pv_stub_readiness_{uuid.uuid4().hex[:12]}",
        "status": "completed",
        "readiness": {
            "status": "failed",
            "code": "kyc_unavailable",
            "reason": "No KYC record available for this investor at KRA.",
        },
    }


async def stub_poa_pan_validation(
    *,
    pan_number: str,
    full_name: str,
    date_of_birth: str,
) -> dict[str, Any]:
    await asyncio.sleep(0.05)
    pan = pan_number.upper()
    name_result = {"status": "verified", "code": None, "reason": None, "value": full_name}
    if full_name.strip().lower() == "lord voldemort":
        name_result = {
            "status": "failed",
            "code": "mismatch",
            "reason": "Name does not match PAN records.",
            "value": full_name,
        }
    pan_result = {"status": "verified", "code": None, "reason": None, "value": pan}
    if _INVALID_PAN.match(pan):
        pan_result = {
            "status": "failed",
            "code": "invalid",
            "reason": "PAN number is invalid or non-existent.",
            "value": pan,
        }
    elif _AADHAAR_NOT_LINKED.match(pan):
        pan_result = {
            "status": "failed",
            "code": "aadhaar_not_linked",
            "reason": "Aadhaar is not seeded with this PAN record.",
            "value": pan,
        }
    dob_result = {"status": "verified", "code": None, "reason": None, "value": date_of_birth}
    if date_of_birth == "2000-01-01":
        dob_result = {
            "status": "failed",
            "code": "mismatch",
            "reason": "Date of birth does not match PAN records.",
            "value": date_of_birth,
        }
    return {
        "id": f"pv_stub_pan_{uuid.uuid4().hex[:12]}",
        "status": "completed",
        "pan": pan_result,
        "name": name_result,
        "date_of_birth": dob_result,
    }


async def stub_create_kyc_request(*, user_email: str, pan: str, name: str, dob: str) -> dict[str, Any]:
    _ = (user_email, pan, name, dob)
    kyc_request_id = f"kycr_stub_{uuid.uuid4().hex[:16]}"
    identity_document_id = f"iddoc_stub_{uuid.uuid4().hex[:16]}"
    settings = get_settings()
    redirect_url = (
        f"{settings.resolved_kyc_digilocker_callback_url}"
        f"?identity_document={identity_document_id}&status=successful&stub=1"
    )
    return {
        "kycRequestId": kyc_request_id,
        "identityDocumentId": identity_document_id,
        "redirectUrl": redirect_url,
    }


async def stub_fetch_identity_document(document_id: str) -> dict[str, Any]:
    await asyncio.sleep(0.05)
    if document_id.endswith("_failed"):
        return {
            "id": document_id,
            "fetch": {"status": "failed", "reason": "user cancelled"},
            "data": None,
        }
    return {
        "id": document_id,
        "fetch": {"status": "successful", "reason": None},
        "data": {
            "number": "0000000000512",
            "line_1": "36TH CROSS SOUTH JAYANAGAR BENGALURU",
            "city": "Bengaluru",
            "pincode": "560041",
            "country": "in",
            "state_name": "Karnataka",
            "father_name": "Rajesh Gupta",
        },
    }


def stub_pincode_lookup(pincode: str) -> dict[str, Any]:
    if pincode == "560102":
        return {
            "code": pincode,
            "city": "Bangalore South",
            "district": "Bangalore",
            "state_name": "Karnataka",
            "country_ansi_code": "IN",
        }
    return {
        "code": pincode,
        "city": "City",
        "district": "District",
        "state_name": "Karnataka",
        "country_ansi_code": "IN",
    }


def stub_states() -> list[dict[str, str]]:
    return [
        {"name": "Karnataka", "state_code": "KA", "country_ansi_code": "IN"},
        {"name": "Maharashtra", "state_code": "MH", "country_ansi_code": "IN"},
        {"name": "Delhi", "state_code": "DL", "country_ansi_code": "IN"},
    ]


def stub_countries() -> list[dict[str, str]]:
    return [
        {"name": "India", "ansi_code": "IN"},
        {"name": "United States", "ansi_code": "US"},
    ]


async def stub_kyckart_bank_holder_name(*, account_number: str, ifsc_code: str) -> dict[str, Any]:
    await asyncio.sleep(0.05)
    if ifsc_code.upper() == "INVALID0000" or account_number == "000000000000":
        return {"accountHolderName": "", "name": ""}
    return {"accountHolderName": "RAHUL SHARMA", "name": "RAHUL SHARMA"}


def stub_ifsc_lookup(ifsc_code: str) -> dict[str, Any]:
    bank_by_ifsc: dict[str, dict[str, str]] = {
        "HDFC0001234": {"bank_name": "HDFC Bank", "branch": "Connaught Place, New Delhi"},
        "SBIN0001234": {"bank_name": "State Bank of India", "branch": "Parliament Street, New Delhi"},
        "ICIC0001234": {"bank_name": "ICICI Bank", "branch": "Bandra Kurla Complex, Mumbai"},
    }
    info = bank_by_ifsc.get(ifsc_code.upper(), {"bank_name": "Axis Bank", "branch": "Koramangala, Bengaluru"})
    return {
        "ifsc_code": ifsc_code.upper(),
        "bank_name": info["bank_name"],
        "branch": info["branch"],
    }


async def stub_poa_bank_validation(
    *,
    pan_number: str,
    account_number: str,
    ifsc_code: str,
    account_type: str,
) -> dict[str, Any]:
    await asyncio.sleep(0.05)
    _ = account_type
    pan = pan_number.upper()
    if account_number == "111111111111":
        return {
            "id": f"pv_stub_bank_{uuid.uuid4().hex[:12]}",
            "status": "completed",
            "pan": {"status": "verified", "code": None, "reason": None, "value": pan},
            "bank_account": {
                "status": "failed",
                "code": "bank_account_proof_required",
                "reason": "Upload a cancelled cheque or bank statement to verify this account.",
                "value": account_number,
            },
        }
    if account_number == "222222222222":
        return {
            "id": f"pv_stub_bank_{uuid.uuid4().hex[:12]}",
            "status": "completed",
            "pan": {"status": "verified", "code": None, "reason": None, "value": pan},
            "bank_account": {
                "status": "failed",
                "code": "uncertain",
                "reason": "Bank verification is uncertain. Upload proof or retry manually.",
                "value": account_number,
            },
        }
    if account_number == "000000000000":
        return {
            "id": f"pv_stub_bank_{uuid.uuid4().hex[:12]}",
            "status": "completed",
            "pan": {"status": "verified", "code": None, "reason": None, "value": pan},
            "bank_account": {
                "status": "failed",
                "code": "mismatch",
                "reason": "Bank account could not be verified.",
                "value": account_number,
            },
        }
    return {
        "id": f"pv_stub_bank_{uuid.uuid4().hex[:12]}",
        "status": "completed",
        "readiness": {
            "status": "failed",
            "code": "kyc_unavailable",
            "reason": "No KYC record available for this investor at KRA.",
        },
        "pan": {"status": "verified", "code": None, "reason": None, "value": pan},
        "bank_account": {
            "status": "verified",
            "code": None,
            "reason": None,
            "value": account_number,
        },
    }


async def stub_poa_bank_validation_manual(
    *,
    pan_number: str,
    account_number: str,
    ifsc_code: str,
    account_type: str,
    proof_file_id: str,
) -> dict[str, Any]:
    await asyncio.sleep(0.05)
    _ = (ifsc_code, account_type)
    pan = pan_number.upper()
    if proof_file_id.endswith("_reject"):
        return {
            "id": f"pv_stub_bank_manual_{uuid.uuid4().hex[:12]}",
            "status": "completed",
            "pan": {"status": "verified", "code": None, "reason": None, "value": pan},
            "bank_account": {
                "status": "failed",
                "code": "manual_rejected",
                "reason": "Uploaded bank proof could not be verified.",
                "value": account_number,
            },
        }
    return {
        "id": f"pv_stub_bank_manual_{uuid.uuid4().hex[:12]}",
        "status": "completed",
        "pan": {"status": "verified", "code": None, "reason": None, "value": pan},
        "bank_account": {
            "status": "verified",
            "code": None,
            "reason": None,
            "value": account_number,
        },
    }


async def stub_poa_file_upload(*, filename: str) -> dict[str, Any]:
    await asyncio.sleep(0.05)
    safe_name = filename.replace(" ", "_").lower()
    return {"id": f"file_stub_{safe_name}_{uuid.uuid4().hex[:8]}"}


_STUB_KYC_FORMS: dict[str, dict[str, Any]] = {}


def _stub_kyc_form_base(
    *,
    form_id: str,
    form_type: str,
    pan: str,
    name: str,
    date_of_birth: str,
    proof_details_callback_url: str,
    esign_callback_url: str,
) -> dict[str, Any]:
    settings = get_settings()
    proof_url = (
        f"{settings.resolved_kyc_proof_callback_url}"
        f"?kyc_form_id={form_id}&status=successful&stub=1"
    )
    return {
        "object": "kyc_form",
        "id": form_id,
        "type": form_type,
        "status": "created",
        "reason": None,
        "pan": pan.upper(),
        "name": name,
        "date_of_birth": date_of_birth,
        "signature_provided": False,
        "proof_details": {
            "fetch_url": proof_url,
            "status": "pending",
        },
        "proof_details_callback_url": proof_details_callback_url,
        "esign_details": {"esign_url": None, "status": None},
        "esign_callback_url": esign_callback_url,
        "requirements": {"fields_needed": ["signature"]},
    }


async def stub_create_kyc_form(
    *,
    form_type: str,
    pan: str,
    name: str,
    date_of_birth: str,
    proof_details_callback_url: str,
    esign_callback_url: str,
) -> dict[str, Any]:
    await asyncio.sleep(0.05)
    form_id = f"kycf_stub_{uuid.uuid4().hex[:16]}"
    payload = _stub_kyc_form_base(
        form_id=form_id,
        form_type=form_type,
        pan=pan,
        name=name,
        date_of_birth=date_of_birth,
        proof_details_callback_url=proof_details_callback_url,
        esign_callback_url=esign_callback_url,
    )
    if form_type == "modify":
        payload["proof_details"] = {"fetch_url": None, "status": "fetched"}
        payload["requirements"] = {"fields_needed": ["signature"]}
    _STUB_KYC_FORMS[form_id] = payload
    return payload


async def stub_fetch_kyc_form(form_id: str) -> dict[str, Any]:
    await asyncio.sleep(0.05)
    return _STUB_KYC_FORMS.get(form_id) or {
        "id": form_id,
        "status": "failed",
        "reason": "kyc_form_not_found",
    }


async def stub_patch_kyc_form(form_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    await asyncio.sleep(0.05)
    current = _STUB_KYC_FORMS.get(form_id) or await stub_fetch_kyc_form(form_id)
    current.update({k: v for k, v in payload.items() if k != "id"})
    _STUB_KYC_FORMS[form_id] = current
    return current


async def stub_upload_kyc_form_signature(form_id: str) -> dict[str, Any]:
    await asyncio.sleep(0.05)
    current = await stub_fetch_kyc_form(form_id)
    current["signature_provided"] = True
    settings = get_settings()
    esign_url = (
        f"{settings.resolved_kyc_esign_callback_url}"
        f"?kyc_form_id={form_id}&status=successful&stub=1"
    )
    current["status"] = "awaiting_esign"
    current["esign_details"] = {"esign_url": esign_url, "status": "pending"}
    current["requirements"] = {"fields_needed": None}
    if str(current.get("proof_details", {}).get("status")) == "pending":
        current["proof_details"] = {
            "fetch_url": current.get("proof_details", {}).get("fetch_url"),
            "status": "fetched",
        }
    _STUB_KYC_FORMS[form_id] = current
    return current


async def stub_retry_kyc_form_proof(form_id: str) -> dict[str, Any]:
    await asyncio.sleep(0.05)
    current = await stub_fetch_kyc_form(form_id)
    settings = get_settings()
    current["proof_details"] = {
        "fetch_url": (
            f"{settings.resolved_kyc_proof_callback_url}"
            f"?kyc_form_id={form_id}&status=successful&stub=1"
        ),
        "status": "pending",
    }
    _STUB_KYC_FORMS[form_id] = current
    return current


def stub_mark_kyc_form_proof_complete(form_id: str) -> dict[str, Any] | None:
    current = _STUB_KYC_FORMS.get(form_id)
    if not current:
        return None
    current["proof_details"] = {
        "fetch_url": current.get("proof_details", {}).get("fetch_url"),
        "status": "fetched",
    }
    _STUB_KYC_FORMS[form_id] = current
    return current


def stub_mark_kyc_form_esign_complete(form_id: str) -> dict[str, Any] | None:
    current = _STUB_KYC_FORMS.get(form_id)
    if not current:
        return None
    pan = str(current.get("pan") or "")
    # Sandbox: PAN ending with R simulates KRA rejection
    if pan[9:10].upper() == "R" if len(pan) >= 10 else False:
        current["status"] = "failed"
        current["reason"] = "kra_rejected"
        current["esign_details"] = {"esign_url": None, "status": "successful"}
    else:
        current["status"] = "submitted"
        current["reason"] = None
        current["esign_details"] = {"esign_url": None, "status": "successful"}
    _STUB_KYC_FORMS[form_id] = current
    return current
