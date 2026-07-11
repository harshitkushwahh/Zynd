from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.kyc.errors import KycError
from app.application.kyc.journey_state_service import save_journey_state
from app.application.kyc.master_data import TERMINAL_READINESS_CODES
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.kyc.kyckart_client import KyckartError, kyckart_pan_to_name_dob
from app.infrastructure.kyc.poa_client import poa_check_readiness, poa_validate_pan_name_dob
from app.infrastructure.persistence.models import User


def _field_failure(preverify: dict[str, Any], field: str) -> dict[str, Any] | None:
    block = preverify.get(field) or {}
    if block.get("status") == "failed":
        return {
            "field": field,
            "code": block.get("code"),
            "reason": block.get("reason") or f"{field} verification failed.",
        }
    return None


async def verify_pan(db: AsyncSession, *, user: User, pan_number: str) -> dict[str, Any]:
    pan = pan_number.upper().strip()
    if len(pan) != 10:
        raise KycError("Enter a valid 10-character PAN number.", "invalid_pan", 400)

    try:
        kyckart = await kyckart_pan_to_name_dob(pan)
    except KyckartError as exc:
        raise KycError(exc.message, exc.code, exc.status_code) from exc
    if kyckart.get("panCategory") == "corporate":
        return {
            "success": False,
            "blocked": True,
            "blockType": "corporate_pan",
            "message": "Corporate PAN cards cannot be used for individual KYC on Zynd.",
        }

    try:
        readiness_result = await poa_check_readiness(pan)
    except FpClientError as exc:
        raise KycError(exc.message, exc.code, exc.status_code) from exc
    readiness = readiness_result.get("readiness") or {}
    readiness_status = readiness.get("status")
    readiness_code = readiness.get("code")
    readiness_reason = readiness.get("reason")

    if readiness_status == "failed" and readiness_code in TERMINAL_READINESS_CODES:
        return {
            "success": False,
            "blocked": True,
            "blockType": "readiness_terminal",
            "readiness": {
                "status": readiness_status,
                "code": readiness_code,
                "reason": readiness_reason,
            },
            "message": readiness_reason or "Investor is not eligible to proceed with KYC.",
        }

    full_name = str(kyckart.get("fullName") or "").strip()
    dob = str(kyckart.get("dateOfBirth") or "").strip()

    try:
        pan_validation = await poa_validate_pan_name_dob(
            pan_number=pan,
            full_name=full_name,
            date_of_birth=dob,
        )
    except FpClientError as exc:
        raise KycError(exc.message, exc.code, exc.status_code) from exc
    for field in ("pan", "name", "date_of_birth"):
        failure = _field_failure(pan_validation, field)
        if failure:
            await save_journey_state(
                db,
                user=user,
                payload={
                    "panDraftJson": {
                        "panNumber": pan,
                        "firstName": kyckart.get("firstName"),
                        "lastName": kyckart.get("lastName"),
                        "middleName": "",
                        "dateOfBirth": dob,
                        "panCategory": kyckart.get("panCategory"),
                        "fullName": full_name,
                    },
                    "panVerificationStatus": "failed",
                    "panVerificationFailureJson": failure,
                    "poaReadinessPreverifyId": readiness_result.get("id"),
                    "poaPanPreverifyId": pan_validation.get("id"),
                },
            )
            return {
                "success": False,
                "blocked": True,
                "blockType": "pan_verification",
                "failure": failure,
            }

    kyc_already_registered = readiness_status == "verified"
    pan_draft = {
        "panNumber": pan,
        "firstName": kyckart.get("firstName"),
        "lastName": kyckart.get("lastName"),
        "middleName": "",
        "dateOfBirth": dob,
        "panCategory": kyckart.get("panCategory"),
        "fullName": full_name,
    }
    await save_journey_state(
        db,
        user=user,
        payload={
            "panDraftJson": pan_draft,
            "kycAlreadyRegistered": kyc_already_registered,
            "readinessCode": readiness_code,
            "readinessReason": readiness_reason,
            "panVerificationStatus": "verified",
            "panVerificationFailureJson": None,
            "poaReadinessPreverifyId": readiness_result.get("id"),
            "poaPanPreverifyId": pan_validation.get("id"),
            "lastCompletedStep": "pan",
        },
    )

    return {
        "success": True,
        "blocked": False,
        "panDraft": pan_draft,
        "kycAlreadyRegistered": kyc_already_registered,
        "readiness": {
            "status": readiness_status,
            "code": readiness_code,
            "reason": readiness_reason,
        },
        "requiresDigilocker": not kyc_already_registered,
    }
