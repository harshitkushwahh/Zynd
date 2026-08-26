from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

from app.infrastructure.kyc.fp_clients import FpClientError, lookup_ifsc
from app.infrastructure.kyc.kyckart_client import KyckartError, kyckart_bank_account_holder_name
from app.infrastructure.kyc.poa_client import poa_verify_bank_account


ACCOUNT_TYPE_MAP = {
    "Savings": "savings",
    "Current": "current",
    "NRE": "nre_savings",
    "NRO": "nro_savings",
    "savings": "savings",
    "current": "current",
    "nre": "nre_savings",
    "nro": "nro_savings",
}

IFSC_CODE_PATTERN = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")


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


def normalize_ifsc_code(ifsc_code: str) -> str:
    return ifsc_code.strip().upper()


def validate_ifsc_format(ifsc_code: str) -> str:
    code = normalize_ifsc_code(ifsc_code)
    if not IFSC_CODE_PATTERN.match(code):
        raise BankVerificationError(
            "Enter a valid 11-character IFSC code.",
            "invalid_ifsc",
            400,
        )
    return code


async def resolve_ifsc_details(ifsc_code: str, *, require_bank_name: bool = True) -> tuple[str, str, str]:
    code = validate_ifsc_format(ifsc_code)
    try:
        payload = await lookup_ifsc(code)
    except FpClientError as exc:
        if exc.status_code == 404 and exc.code == "invalid_ifsc":
            raise BankVerificationError(
                "IFSC code not found. Check the code and try again.",
                "invalid_ifsc",
                400,
            ) from exc
        raise BankVerificationError(exc.message, exc.code, exc.status_code) from exc

    if payload.get("lookup_fallback"):
        return code, "", ""

    bank_name = str(payload.get("bank_name") or payload.get("bankName") or "").strip()
    branch = str(payload.get("branch") or payload.get("branch_name") or "").strip()
    if require_bank_name and not bank_name:
        raise BankVerificationError(
            "IFSC code not found. Check the code and try again.",
            "invalid_ifsc",
            400,
        )
    return code, bank_name, branch


def extract_bank_metadata_from_poa(poa_result: dict[str, Any]) -> tuple[str, str]:
    bank_result = extract_bank_account_result(poa_result)
    value = bank_result.get("value")
    if isinstance(value, dict):
        bank_name = str(value.get("bank_name") or value.get("bank") or "").strip()
        branch = str(value.get("branch_name") or value.get("branch") or "").strip()
        return bank_name, branch
    return "", ""


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


def poa_field_status(result: dict[str, Any]) -> dict[str, Any]:
    return {
        "status": result.get("status"),
        "code": result.get("code"),
        "reason": result.get("reason"),
    }


def resolve_poa_pan_status_for_display(
    pan_result: dict[str, Any],
    *,
    pan_step_verified: bool,
) -> dict[str, Any]:
    """Bank POA often omits pan.status; reuse PAN-step result when already verified."""
    if str(pan_result.get("status") or "").strip():
        return poa_field_status(pan_result)
    if pan_step_verified:
        return {"status": "verified", "code": None, "reason": None}
    return poa_field_status(pan_result)


def resolve_poa_readiness_status_for_display(
    readiness_result: dict[str, Any],
    *,
    kyc_already_registered: bool | None,
    readiness_code: str | None,
    readiness_reason: str | None,
) -> dict[str, Any]:
    """Bank POA may omit readiness; hydrate from the PAN-step readiness check."""
    if str(readiness_result.get("status") or "").strip():
        return poa_field_status(readiness_result)
    if kyc_already_registered is True:
        return {"status": "verified", "code": None, "reason": None}
    if readiness_code:
        return {
            "status": "failed",
            "code": readiness_code,
            "reason": readiness_reason,
        }
    return poa_field_status(readiness_result)


CYBRILLA_BANK_CODE_MESSAGES: dict[str, str] = {
    "bank_verification_failed": (
        "Bank account verification failed. Collect another account from the investor or retry."
    ),
    "low_confidence": (
        "Bank account details do not match the investor and cannot be used for transactions. "
        "Collect the correct account and retry."
    ),
    "uncertain": (
        "Bank verification is uncertain. This account may be eligible for manual verification with proof."
    ),
    "bank_account_proof_required": (
        "Bank account proof is required to verify this account."
    ),
}


def format_bank_verification_failure(
    *,
    bank_result: dict[str, Any],
    pan_result: dict[str, Any] | None = None,
    pan_verified: bool = True,
) -> dict[str, Any]:
    pan_result = pan_result or {}
    bank_code = str(bank_result.get("code") or "").strip().lower()
    bank_reason = str(bank_result.get("reason") or "").strip()
    pan_code = str(pan_result.get("code") or "").strip().lower()
    pan_reason = str(pan_result.get("reason") or "").strip()

    if not pan_verified:
        if pan_reason:
            reason = pan_reason
        elif pan_code == "mismatch":
            reason = "PAN name does not match IT department records."
        elif pan_code == "invalid":
            reason = "PAN number is invalid or non-existent."
        elif pan_code == "aadhaar_not_linked":
            reason = "Aadhaar is not seeded with this PAN record."
        else:
            reason = "PAN verification failed during Cybrilla pre-verification."
        return {
            "field": "pan",
            "code": pan_code or bank_code or "pan_verification_failed",
            "reason": reason,
        }

    if bank_code in CYBRILLA_BANK_CODE_MESSAGES:
        return {
            "field": "bank_account",
            "code": bank_code,
            "reason": bank_reason or CYBRILLA_BANK_CODE_MESSAGES[bank_code],
        }

    if bank_reason:
        return {"field": "bank_account", "code": bank_code or None, "reason": bank_reason}

    return {
        "field": "bank_account",
        "code": bank_code or "verification_failed",
        "reason": "Bank account verification failed.",
    }


def resolve_bank_holder_names(
    pan_draft: dict[str, Any],
    *,
    kyckart_holder_name: str = "",
) -> tuple[str, str]:
    """Return (poa_name, kyckart_display_name). POA uses PAN name; Kyckart is UI-only."""
    pan_holder_name = holder_name_from_pan_draft(pan_draft)
    kyckart_display_name = kyckart_holder_name.strip()
    return pan_holder_name, kyckart_display_name


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
    kyckart_holder_name: str
    kyckart_lookup_error: str | None
    pan_holder_name: str
    poa_pan_status: dict[str, Any]
    poa_bank_status: dict[str, Any]
    poa_readiness_status: dict[str, Any]
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
    pan_step_verified: bool = False,
    readiness_code: str | None = None,
    readiness_reason: str | None = None,
) -> HybridBankVerificationOutcome:
    account_no = account_number.strip()
    poa_account_type = map_account_type(account_type)
    ifsc, bank_name, branch = await resolve_ifsc_details(ifsc_code, require_bank_name=False)

    kyckart_holder_name = ""
    kyckart_lookup_error: str | None = None
    try:
        holder = await kyckart_bank_account_holder_name(
            account_number=account_no,
            ifsc_code=ifsc,
        )
        kyckart_holder_name = str(holder.get("accountHolderName") or holder.get("name") or "").strip()
    except KyckartError as exc:
        kyckart_lookup_error = exc.message
        logger.info(
            "kyckart_bank_lookup_skipped account_last4=%s code=%s",
            account_no[-4:],
            exc.code,
        )

    pan_holder_name, kyckart_display_name = resolve_bank_holder_names(
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
    readiness_result = extract_field_result(poa_result, "readiness")

    bank_verified = is_verified_result(bank_result)
    pan_verified = is_verified_result(pan_result) or pan_step_verified
    readiness_verified = extract_readiness_verified(
        poa_result,
        kyc_already_registered=kyc_already_registered,
    )
    poa_pan_status = resolve_poa_pan_status_for_display(
        pan_result,
        pan_step_verified=pan_step_verified,
    )
    poa_readiness_status = resolve_poa_readiness_status_for_display(
        readiness_result,
        kyc_already_registered=kyc_already_registered,
        readiness_code=readiness_code,
        readiness_reason=readiness_reason,
    )
    bank_code = str(bank_result.get("code") or "").lower()
    requires_manual = bank_code in {
        "bank_account_proof_required",
        "uncertain",
        "manual_verification_required",
    }
    requires_proof_upload = bank_code == "bank_account_proof_required"

    if not bank_name or not branch:
        poa_bank_name, poa_branch = extract_bank_metadata_from_poa(poa_result)
        bank_name = bank_name or poa_bank_name
        branch = branch or poa_branch

    failure: dict[str, Any] | None = None
    if not bank_verified:
        failure = format_bank_verification_failure(
            bank_result=bank_result,
            pan_result=pan_result,
            pan_verified=pan_verified,
        )
        if not requires_manual:
            logger.warning(
                "bank_verification_failed account_last4=%s bank_code=%s bank_reason=%r "
                "pan_verified=%s pan_code=%s readiness_verified=%s",
                account_no[-4:],
                bank_result.get("code"),
                bank_result.get("reason"),
                pan_verified,
                pan_result.get("code"),
                readiness_verified,
            )
        elif failure:
            logger.info(
                "bank_verification_manual_required account_last4=%s bank_code=%s reason=%r",
                account_no[-4:],
                bank_result.get("code"),
                failure.get("reason"),
            )

    return HybridBankVerificationOutcome(
        poa_result=poa_result,
        preverify_id=preverify_id,
        bank_verified=bank_verified,
        pan_verified=pan_verified,
        readiness_verified=readiness_verified,
        requires_manual=requires_manual,
        requires_proof_upload=requires_proof_upload,
        failure=failure,
        kyckart_holder_name=kyckart_display_name,
        kyckart_lookup_error=kyckart_lookup_error,
        pan_holder_name=pan_holder_name,
        poa_pan_status=poa_pan_status,
        poa_bank_status=poa_field_status(bank_result),
        poa_readiness_status=poa_readiness_status,
        bank_name=bank_name,
        branch=branch,
        poa_account_type=poa_account_type,
        account_number=account_no,
        ifsc_code=ifsc,
        account_type_label=account_type,
    )
