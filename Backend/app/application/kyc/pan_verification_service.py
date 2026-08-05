from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.kyc.errors import KycError
from app.application.kyc.journey_gate_service import is_rekyc_readiness_code
from app.application.investor.investor_early_provision_service import ensure_investor_profile_after_pan_confirm
from app.application.kyc.journey_state_service import get_or_create_journey, save_journey_state
from app.application.kyc.master_data import TERMINAL_READINESS_CODES
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.kyc.kyckart_client import KyckartError, kyckart_pan_to_name_dob
from app.infrastructure.kyc.poa_client import poa_check_readiness, poa_validate_pan_name_dob
from app.infrastructure.persistence.models import User


def _compose_full_name(*, first_name: str, middle_name: str, last_name: str) -> str:
    parts = [first_name.strip(), middle_name.strip(), last_name.strip()]
    return " ".join(part for part in parts if part)


def _normalize_name_key(name: str) -> str:
    return " ".join(name.upper().split())


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
        "requiresDigilocker": not kyc_already_registered and not is_rekyc_readiness_code(readiness_code),
    }


async def confirm_pan_names(
    db: AsyncSession,
    *,
    user: User,
    first_name: str,
    middle_name: str,
    last_name: str,
) -> dict[str, Any]:
    journey = await get_or_create_journey(db, user.id)
    if journey.pan_verification_status != "verified":
        raise KycError("Complete PAN verification first.", "pan_not_verified", 403)

    pan_draft = dict(journey.pan_draft_json or {})
    pan = str(pan_draft.get("panNumber") or "").upper().strip()
    dob = str(pan_draft.get("dateOfBirth") or "").strip()
    if not pan or not dob:
        raise KycError("PAN details are incomplete.", "pan_incomplete", 400)

    first = first_name.strip()
    middle = middle_name.strip()
    last = last_name.strip()
    if len(first) < 2 or len(last) < 2:
        raise KycError("Enter valid first and last names.", "invalid_name", 400)

    full_name = _compose_full_name(first_name=first, middle_name=middle, last_name=last)
    stored_full = str(pan_draft.get("fullName") or "")
    needs_revalidation = _normalize_name_key(full_name) != _normalize_name_key(stored_full)

    poa_pan_preverify_id = journey.poa_pan_preverify_id
    if needs_revalidation:
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
                        "panVerificationFailureJson": failure,
                    },
                )
                return {
                    "success": False,
                    "blocked": True,
                    "blockType": "pan_verification",
                    "failure": failure,
                }
        poa_pan_preverify_id = pan_validation.get("id")

    updated_draft = {
        **pan_draft,
        "firstName": first,
        "middleName": middle,
        "lastName": last,
        "fullName": full_name,
    }
    await save_journey_state(
        db,
        user=user,
        payload={
            "panDraftJson": updated_draft,
            "panVerificationFailureJson": None,
            "poaPanPreverifyId": poa_pan_preverify_id,
        },
    )

    await ensure_investor_profile_after_pan_confirm(db, user=user, journey=journey)

    return {
        "success": True,
        "blocked": False,
        "panDraft": updated_draft,
    }
