from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.infrastructure.kyc.fp_clients import FpClientError, lookup_ifsc
from app.infrastructure.kyc.kyckart_client import KyckartError, kyckart_bank_account_holder_name
from app.infrastructure.kyc.poa_client import poa_verify_bank_account


ACCOUNT_TYPE_MAP = {
    "Savings": "savings",
    "Current": "current",
    "NRE": "nre_savings",
    "NRO": "nro_savings",
}


class BankVerificationError(Exception):
    def __init__(self, message: str, code: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


def map_account_type(account_type: str) -> str:
    mapped = ACCOUNT_TYPE_MAP.get(account_type.strip())
    if not mapped:
        raise BankVerificationError("Invalid bank account type.", "invalid_account_type", 400)
    return mapped


def extract_field_result(payload: dict[str, Any], field: str) -> dict[str, Any]:
    value = payload.get(field)
    if isinstance(value, dict):
        return value
    return {}


def extract_bank_account_result(payload: dict[str, Any]) -> dict[str, Any]:
    accounts = payload.get("bank_accounts")
    if isinstance(accounts, list):
        for item in accounts:
            if isinstance(item, dict):
                return item
    return extract_field_result(payload, "bank_account")


def is_verified_result(result: dict[str, Any]) -> bool:
    return str(result.get("status") or "").lower() == "verified"


def extract_readiness_verified(poa_result: dict[str, Any], *, kyc_already_registered: bool | None) -> bool:
    readiness = poa_result.get("readiness")
    if isinstance(readiness, dict) and readiness.get("status"):
        return is_verified_result(readiness)
    if kyc_already_registered is True:
        return True
    return False


def holder_name_from_pan_draft(pan_draft: dict[str, Any]) -> str:
    full_name = str(pan_draft.get("fullName") or "").strip()
    if full_name:
        return full_name
    first_name = str(pan_draft.get("firstName") or "").strip()
    middle_name = str(pan_draft.get("middleName") or "").strip()
    last_name = str(pan_draft.get("lastName") or "").strip()
    return " ".join(part for part in (first_name, middle_name, last_name) if part).strip()


def resolve_bank_holder_names(
    pan_draft: dict[str, Any],
    *,
    kyckart_holder_name: str = "",
) -> tuple[str, str]:
    """Return (poa_name, display_name). POA always uses the PAN-verified name."""
    pan_holder_name = holder_name_from_pan_draft(pan_draft)
    display_holder_name = kyckart_holder_name.strip() or pan_holder_name
    return pan_holder_name, display_holder_name


@dataclass(frozen=True)
class HybridBankVerificationOutcome:
    poa_result: dict[str, Any]
    preverify_id: str
    bank_verified: bool
    pan_verified: bool
    readiness_verified: bool
    requires_manual: bool
    requires_proof_upload: bool
    failure: dict[str, Any] | None
    display_holder_name: str
    pan_holder_name: str
    bank_name: str
    branch: str
    poa_account_type: str
    account_number: str
    ifsc_code: str
    account_type_label: str


async def run_hybrid_bank_verification(
    *,
    pan_draft: dict[str, Any],
    pan_number: str,
    account_number: str,
    account_type: str,
    ifsc_code: str,
    kyc_already_registered: bool | None,
) -> HybridBankVerificationOutcome:
    ifsc = ifsc_code.strip().upper()
    account_no = account_number.strip()
    poa_account_type = map_account_type(account_type)

    ifsc_payload = await lookup_ifsc(ifsc)
    bank_name = str(ifsc_payload.get("bank_name") or ifsc_payload.get("bankName") or "").strip()
    branch = str(ifsc_payload.get("branch") or ifsc_payload.get("branch_name") or "").strip()

    kyckart_holder_name = ""
    try:
        holder = await kyckart_bank_account_holder_name(
            account_number=account_no,
            ifsc_code=ifsc,
        )
        kyckart_holder_name = str(holder.get("accountHolderName") or holder.get("name") or "").strip()
    except KyckartError:
        pass

    pan_holder_name, display_holder_name = resolve_bank_holder_names(
        pan_draft,
        kyckart_holder_name=kyckart_holder_name,
    )
    if not pan_holder_name:
        raise BankVerificationError(
            "Complete PAN verification before verifying your bank account.",
            "pan_name_unavailable",
            403,
        )

    try:
        poa_result = await poa_verify_bank_account(
            pan_number=pan_number,
            account_holder_name=pan_holder_name,
            account_number=account_no,
            ifsc_code=ifsc,
            account_type=poa_account_type,
        )
    except FpClientError as exc:
        raise BankVerificationError(exc.message, exc.code, exc.status_code) from exc

    preverify_id = str(poa_result.get("id") or "")
    bank_result = extract_bank_account_result(poa_result)
    pan_result = extract_field_result(poa_result, "pan")

    bank_verified = is_verified_result(bank_result)
    pan_verified = is_verified_result(pan_result)
    readiness_verified = extract_readiness_verified(
        poa_result,
        kyc_already_registered=kyc_already_registered,
    )
    bank_code = str(bank_result.get("code") or "").lower()
    requires_manual = bank_code in {
        "bank_account_proof_required",
        "uncertain",
        "manual_verification_required",
    }
    requires_proof_upload = bank_code == "bank_account_proof_required"

    failure: dict[str, Any] | None = None
    if not bank_verified and not requires_manual:
        failure = {
            "field": "bank_account",
            "code": bank_result.get("code"),
            "reason": bank_result.get("reason") or "Bank account verification failed.",
        }

    return HybridBankVerificationOutcome(
        poa_result=poa_result,
        preverify_id=preverify_id,
        bank_verified=bank_verified,
        pan_verified=pan_verified,
        readiness_verified=readiness_verified,
        requires_manual=requires_manual,
        requires_proof_upload=requires_proof_upload,
        failure=failure,
        display_holder_name=display_holder_name,
        pan_holder_name=pan_holder_name,
        bank_name=bank_name,
        branch=branch,
        poa_account_type=poa_account_type,
        account_number=account_no,
        ifsc_code=ifsc,
        account_type_label=account_type,
    )
