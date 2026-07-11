from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.kyc.errors import KycError
from app.application.kyc.journey_gate_service import require_phase1_complete
from app.application.kyc.journey_state_service import get_or_create_journey, get_or_create_status
from app.infrastructure.kyc.fp_clients import FpClientError, lookup_ifsc
from app.infrastructure.kyc.kyckart_client import KyckartError, kyckart_bank_account_holder_name
from app.infrastructure.kyc.poa_client import poa_verify_bank_account
from app.infrastructure.persistence.models import KycOverallStatus, KycStepStatus, User


ACCOUNT_TYPE_MAP = {
    "Savings": "savings",
    "Current": "current",
    "NRE": "nre_savings",
    "NRO": "nro_savings",
}


def _map_account_type(account_type: str) -> str:
    mapped = ACCOUNT_TYPE_MAP.get(account_type.strip())
    if not mapped:
        raise KycError("Invalid bank account type.", "invalid_account_type", 400)
    return mapped


def _extract_field_result(payload: dict[str, Any], field: str) -> dict[str, Any]:
    value = payload.get(field)
    if isinstance(value, dict):
        return value
    return {}


def _extract_bank_account_result(payload: dict[str, Any]) -> dict[str, Any]:
    accounts = payload.get("bank_accounts")
    if isinstance(accounts, list):
        for item in accounts:
            if isinstance(item, dict):
                return item
    return _extract_field_result(payload, "bank_account")


def _is_verified(result: dict[str, Any]) -> bool:
    return str(result.get("status") or "").lower() == "verified"


def _extract_readiness_verified(poa_result: dict[str, Any], journey: Any) -> bool:
    readiness = poa_result.get("readiness")
    if isinstance(readiness, dict) and readiness.get("status"):
        return _is_verified(readiness)
    if journey.kyc_already_registered is True:
        return True
    return False


def _holder_name_from_pan_draft(pan_draft: dict[str, Any]) -> str:
    full_name = str(pan_draft.get("fullName") or "").strip()
    if full_name:
        return full_name
    first_name = str(pan_draft.get("firstName") or "").strip()
    middle_name = str(pan_draft.get("middleName") or "").strip()
    last_name = str(pan_draft.get("lastName") or "").strip()
    return " ".join(part for part in (first_name, middle_name, last_name) if part).strip()


async def verify_bank_hybrid(
    db: AsyncSession,
    *,
    user: User,
    account_number: str,
    account_type: str,
    ifsc_code: str,
) -> dict[str, Any]:
    journey = await get_or_create_journey(db, user.id)
    require_phase1_complete(journey)

    pan_draft = journey.pan_draft_json or {}
    pan_number = str(pan_draft.get("panNumber") or "").strip().upper()
    if not pan_number:
        raise KycError("Complete PAN verification first.", "pan_not_verified", 403)

    ifsc = ifsc_code.strip().upper()
    account_no = account_number.strip()
    poa_account_type = _map_account_type(account_type)

    ifsc_payload = await lookup_ifsc(ifsc)
    bank_name = str(ifsc_payload.get("bank_name") or ifsc_payload.get("bankName") or "").strip()
    branch = str(ifsc_payload.get("branch") or ifsc_payload.get("branch_name") or "").strip()

    account_holder_name = ""
    try:
        holder = await kyckart_bank_account_holder_name(
            account_number=account_no,
            ifsc_code=ifsc,
        )
        account_holder_name = str(holder.get("accountHolderName") or holder.get("name") or "").strip()
    except KyckartError as exc:
        if exc.code == "kyckart_bank_failed":
            raise KycError(exc.message, exc.code, exc.status_code) from exc
        account_holder_name = _holder_name_from_pan_draft(pan_draft)

    if not account_holder_name:
        account_holder_name = _holder_name_from_pan_draft(pan_draft)
    if not account_holder_name:
        raise KycError(
            "Complete PAN verification before verifying your bank account.",
            "pan_name_unavailable",
            403,
        )

    try:
        poa_result = await poa_verify_bank_account(
            pan_number=pan_number,
            account_holder_name=account_holder_name,
            account_number=account_no,
            ifsc_code=ifsc,
            account_type=poa_account_type,
        )
    except FpClientError as exc:
        raise KycError(exc.message, exc.code, exc.status_code) from exc
    preverify_id = str(poa_result.get("id") or "")
    bank_result = _extract_bank_account_result(poa_result)
    pan_result = _extract_field_result(poa_result, "pan")

    bank_verified = _is_verified(bank_result)
    pan_verified = _is_verified(pan_result)
    readiness_verified = _extract_readiness_verified(poa_result, journey)
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

    journey.poa_bank_preverify_id = preverify_id or journey.poa_bank_preverify_id
    journey.bank_verification_status = "verified" if bank_verified else ("manual_required" if requires_manual else "failed")
    journey.bank_verification_failure_json = failure
    journey.bank_draft_json = {
        "accountNumber": account_no,
        "accountType": account_type,
        "ifscCode": ifsc,
        "accountHolderName": account_holder_name,
        "bankName": bank_name,
        "branch": branch,
        "poaAccountType": poa_account_type,
        "readinessVerified": readiness_verified,
    }

    status = await get_or_create_status(db, user.id)
    if bank_verified:
        status.bank_step_status = KycStepStatus.verified
    elif requires_manual:
        status.bank_step_status = KycStepStatus.pending
    else:
        status.bank_step_status = KycStepStatus.failed

    await db.flush()

    return {
        "success": bank_verified,
        "accountHolderName": account_holder_name,
        "bankName": bank_name,
        "branch": branch,
        "panVerified": pan_verified,
        "bankVerified": bank_verified,
        "readinessVerified": readiness_verified,
        "requiresManualVerification": requires_manual,
        "requiresProofUpload": requires_proof_upload,
        "preverifyId": preverify_id,
        "failure": failure,
    }


async def upload_bank_proof(
    db: AsyncSession,
    *,
    user: User,
    file_bytes: bytes,
    filename: str,
    content_type: str,
) -> dict[str, Any]:
    from app.infrastructure.kyc.poa_client import upload_poa_file

    journey = await get_or_create_journey(db, user.id)
    require_phase1_complete(journey)
    if not journey.poa_bank_preverify_id:
        raise KycError("Verify bank details before uploading proof.", "bank_not_started", 400)

    allowed_types = {"application/pdf", "image/jpeg", "image/jpg", "image/png"}
    if content_type not in allowed_types:
        raise KycError("Unsupported file type. Use PDF, JPEG, or PNG.", "invalid_file_type", 400)
    if len(file_bytes) > 10 * 1024 * 1024:
        raise KycError("File size must be 10MB or less.", "file_too_large", 400)

    uploaded = await upload_poa_file(
        file_bytes=file_bytes,
        filename=filename,
        content_type=content_type,
        purpose="bank account proof",
    )
    file_id = str(uploaded.get("id") or "")
    journey.poa_bank_proof_file_id = file_id
    await db.flush()
    return {"fileId": file_id}


async def verify_bank_manual(
    db: AsyncSession,
    *,
    user: User,
) -> dict[str, Any]:
    journey = await get_or_create_journey(db, user.id)
    require_phase1_complete(journey)

    preverify_id = journey.poa_bank_preverify_id
    proof_file_id = journey.poa_bank_proof_file_id
    bank_draft = journey.bank_draft_json or {}
    pan_draft = journey.pan_draft_json or {}

    if not preverify_id:
        raise KycError("Verify bank details before manual verification.", "bank_not_started", 400)
    if not proof_file_id:
        raise KycError("Upload bank account proof before manual verification.", "bank_proof_required", 400)

    pan_number = str(pan_draft.get("panNumber") or "").strip().upper()
    account_number = str(bank_draft.get("accountNumber") or "").strip()
    ifsc_code = str(bank_draft.get("ifscCode") or "").strip().upper()
    account_type = str(bank_draft.get("poaAccountType") or bank_draft.get("accountType") or "savings")
    account_holder_name = str(bank_draft.get("accountHolderName") or "").strip() or _holder_name_from_pan_draft(pan_draft)

    from app.infrastructure.kyc.poa_client import poa_verify_bank_account_manual

    try:
        poa_result = await poa_verify_bank_account_manual(
            pan_number=pan_number,
            account_holder_name=account_holder_name,
            account_number=account_number,
            ifsc_code=ifsc_code,
            account_type=account_type if account_type in {"savings", "current", "nre_savings", "nro_savings"} else _map_account_type(str(bank_draft.get("accountType") or "Savings")),
            proof_file_id=proof_file_id,
        )
    except FpClientError as exc:
        raise KycError(exc.message, exc.code, exc.status_code) from exc
    bank_result = _extract_bank_account_result(poa_result)
    bank_verified = _is_verified(bank_result)
    readiness_verified = _extract_readiness_verified(poa_result, journey)

    failure: dict[str, Any] | None = None
    if not bank_verified:
        failure = {
            "field": "bank_account",
            "code": bank_result.get("code"),
            "reason": bank_result.get("reason") or "Manual bank verification failed.",
        }

    journey.poa_bank_preverify_id = str(poa_result.get("id") or preverify_id)
    journey.bank_verification_status = "verified" if bank_verified else "failed"
    journey.bank_verification_failure_json = failure
    bank_draft = dict(journey.bank_draft_json or {})
    bank_draft["readinessVerified"] = readiness_verified
    journey.bank_draft_json = bank_draft

    status = await get_or_create_status(db, user.id)
    status.bank_step_status = KycStepStatus.verified if bank_verified else KycStepStatus.failed
    if bank_verified:
        status.overall_status = KycOverallStatus.phase2_complete

    await db.flush()

    return {
        "success": bank_verified,
        "bankVerified": bank_verified,
        "readinessVerified": readiness_verified,
        "requiresManualVerification": not bank_verified,
        "requiresProofUpload": False,
        "failure": failure,
    }


async def get_bank_preverify_status(
    db: AsyncSession,
    *,
    user_id: UUID,
    preverify_id: str,
) -> dict[str, Any]:
    from app.infrastructure.kyc.poa_client import fetch_poa_preverification

    journey = await get_or_create_journey(db, user_id)
    if journey.poa_bank_preverify_id != preverify_id:
        raise KycError("Pre-verification record not found.", "preverify_not_found", 404)

    try:
        payload = await fetch_poa_preverification(preverify_id)
    except FpClientError as exc:
        raise KycError(exc.message, exc.code, exc.status_code) from exc
    bank_result = _extract_bank_account_result(payload)
    return {
        "status": payload.get("status"),
        "bankVerified": _is_verified(bank_result),
        "code": bank_result.get("code"),
        "reason": bank_result.get("reason"),
    }
