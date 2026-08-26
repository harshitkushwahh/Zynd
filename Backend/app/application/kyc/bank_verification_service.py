from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.investor.investor_identity_uniqueness_service import (
    InvestorIdentityConflictError,
    assert_bank_not_used_by_other_user,
)
from app.application.kyc.bank_verification_core import (
    BankVerificationError,
    extract_bank_account_result,
    extract_field_result,
    extract_readiness_verified,
    format_bank_verification_failure,
    holder_name_from_pan_draft,
    is_verified_result,
    map_account_type,
    poa_field_status,
    resolve_bank_holder_names,
    resolve_poa_pan_status_for_display,
    resolve_poa_readiness_status_for_display,
    run_hybrid_bank_verification,
)
from app.application.kyc.errors import KycError
from app.application.kyc.journey_gate_service import require_pan_verified, require_phase1_complete
from app.application.kyc.journey_state_service import get_or_create_journey, get_or_create_status
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.persistence.models import KycOverallStatus, KycStepStatus, User


def _map_bank_verification_error(exc: BankVerificationError) -> KycError:
    return KycError(exc.message, exc.code, exc.status_code)


# Backward-compatible re-exports for existing tests/imports.
def _extract_readiness_verified(poa_result: dict[str, Any], journey: Any) -> bool:
    return extract_readiness_verified(
        poa_result,
        kyc_already_registered=getattr(journey, "kyc_already_registered", None),
    )


_holder_name_from_pan_draft = holder_name_from_pan_draft
_resolve_bank_holder_names = resolve_bank_holder_names
_map_account_type = map_account_type
_extract_bank_account_result = extract_bank_account_result
_is_verified = is_verified_result


async def verify_bank_hybrid(
    db: AsyncSession,
    *,
    user: User,
    account_number: str,
    account_type: str,
    ifsc_code: str,
    skip_phase1_gate: bool = False,
) -> dict[str, Any]:
    journey = await get_or_create_journey(db, user.id)
    if skip_phase1_gate:
        require_pan_verified(journey)
    else:
        require_phase1_complete(journey)

    pan_draft = journey.pan_draft_json or {}
    pan_number = str(pan_draft.get("panNumber") or "").strip().upper()
    if not pan_number:
        raise KycError("Complete PAN verification first.", "pan_not_verified", 403)

    try:
        await assert_bank_not_used_by_other_user(
            db,
            account_number=account_number,
            ifsc_code=ifsc_code,
            user_id=user.id,
        )
    except InvestorIdentityConflictError as exc:
        raise KycError(exc.message, exc.code, exc.status_code) from exc

    try:
        outcome = await run_hybrid_bank_verification(
            pan_draft=pan_draft,
            pan_number=pan_number,
            account_number=account_number,
            account_type=account_type,
            ifsc_code=ifsc_code,
            kyc_already_registered=journey.kyc_already_registered,
            pan_step_verified=journey.pan_verification_status == "verified",
            readiness_code=journey.readiness_code,
            readiness_reason=journey.readiness_reason,
        )
    except BankVerificationError as exc:
        raise _map_bank_verification_error(exc) from exc

    journey.poa_bank_preverify_id = outcome.preverify_id or journey.poa_bank_preverify_id
    journey.bank_verification_status = (
        "verified" if outcome.bank_verified else ("manual_required" if outcome.requires_manual else "failed")
    )
    journey.bank_verification_failure_json = outcome.failure
    journey.bank_draft_json = {
        "accountNumber": outcome.account_number,
        "accountType": outcome.account_type_label,
        "ifscCode": outcome.ifsc_code,
        "accountHolderName": outcome.kyckart_holder_name or outcome.pan_holder_name,
        "panAccountHolderName": outcome.pan_holder_name,
        "kyckartAccountHolderName": outcome.kyckart_holder_name,
        "bankName": outcome.bank_name,
        "branch": outcome.branch,
        "poaAccountType": outcome.poa_account_type,
        "readinessVerified": outcome.readiness_verified,
        "poaPanStatus": outcome.poa_pan_status,
        "poaBankStatus": outcome.poa_bank_status,
        "poaReadinessStatus": outcome.poa_readiness_status,
    }

    status = await get_or_create_status(db, user.id)
    if outcome.bank_verified:
        status.bank_step_status = KycStepStatus.verified
    elif outcome.requires_manual:
        status.bank_step_status = KycStepStatus.pending
    else:
        status.bank_step_status = KycStepStatus.failed

    await db.flush()

    return {
        "success": outcome.bank_verified,
        "accountHolderName": outcome.kyckart_holder_name or outcome.pan_holder_name,
        "kyckartAccountHolderName": outcome.kyckart_holder_name,
        "kyckartLookupError": outcome.kyckart_lookup_error,
        "panHolderName": outcome.pan_holder_name,
        "bankName": outcome.bank_name,
        "branch": outcome.branch,
        "panVerified": outcome.pan_verified,
        "bankVerified": outcome.bank_verified,
        "readinessVerified": outcome.readiness_verified,
        "requiresManualVerification": outcome.requires_manual,
        "requiresProofUpload": outcome.requires_proof_upload,
        "preverifyId": outcome.preverify_id,
        "failure": outcome.failure,
        "poaPanStatus": outcome.poa_pan_status,
        "poaBankStatus": outcome.poa_bank_status,
        "poaReadinessStatus": outcome.poa_readiness_status,
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
    account_holder_name = holder_name_from_pan_draft(pan_draft)
    if not account_holder_name:
        raise KycError(
            "Complete PAN verification before verifying your bank account.",
            "pan_name_unavailable",
            403,
        )

    try:
        await assert_bank_not_used_by_other_user(
            db,
            account_number=account_number,
            ifsc_code=ifsc_code,
            user_id=user.id,
        )
    except InvestorIdentityConflictError as exc:
        raise KycError(exc.message, exc.code, exc.status_code) from exc

    from app.infrastructure.kyc.poa_client import poa_verify_bank_account_manual

    try:
        poa_result = await poa_verify_bank_account_manual(
            pan_number=pan_number,
            account_holder_name=account_holder_name,
            account_number=account_number,
            ifsc_code=ifsc_code,
            account_type=account_type
            if account_type in {"savings", "current", "nre_savings", "nro_savings"}
            else map_account_type(str(bank_draft.get("accountType") or "Savings")),
            proof_file_id=proof_file_id,
        )
    except FpClientError as exc:
        raise KycError(exc.message, exc.code, exc.status_code) from exc
    except BankVerificationError as exc:
        raise _map_bank_verification_error(exc) from exc

    bank_result = extract_bank_account_result(poa_result)
    bank_verified = is_verified_result(bank_result)
    readiness_verified = extract_readiness_verified(
        poa_result,
        kyc_already_registered=journey.kyc_already_registered,
    )

    failure: dict[str, Any] | None = None
    if not bank_verified:
        pan_holder_name = holder_name_from_pan_draft(pan_draft)
        failure = format_bank_verification_failure(
            bank_result=bank_result,
            pan_result=extract_field_result(poa_result, "pan"),
            pan_verified=is_verified_result(extract_field_result(poa_result, "pan")),
        )

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
    bank_result = extract_bank_account_result(payload)
    bank_verified = is_verified_result(bank_result)
    pan_result = extract_field_result(payload, "pan")
    readiness_result = extract_field_result(payload, "readiness")
    pan_step_verified = journey.pan_verification_status == "verified"
    reason = bank_result.get("reason")
    code = bank_result.get("code")
    if not bank_verified:
        failure = format_bank_verification_failure(
            bank_result=bank_result,
            pan_result=pan_result,
            pan_verified=is_verified_result(pan_result) or pan_step_verified,
        )
        reason = failure.get("reason")
        code = failure.get("code")
    return {
        "status": payload.get("status"),
        "bankVerified": bank_verified,
        "code": code,
        "reason": reason,
        "panVerified": is_verified_result(pan_result) or pan_step_verified,
        "readinessVerified": extract_readiness_verified(
            payload,
            kyc_already_registered=journey.kyc_already_registered,
        ),
        "poaPanStatus": resolve_poa_pan_status_for_display(
            pan_result,
            pan_step_verified=pan_step_verified,
        ),
        "poaBankStatus": poa_field_status(bank_result),
        "poaReadinessStatus": resolve_poa_readiness_status_for_display(
            readiness_result,
            kyc_already_registered=journey.kyc_already_registered,
            readiness_code=journey.readiness_code,
            readiness_reason=journey.readiness_reason,
        ),
    }
