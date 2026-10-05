from __future__ import annotations

import logging
import re
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.kyc.errors import KycError
from app.application.kyc.journey_gate_service import (
    derive_kyc_already_registered,
    requires_digilocker_for_readiness,
    requires_full_kyc_submission,
)
from app.infrastructure.kyc.cybrilla_terminal_log import log_kyc_step
from app.application.kyc.user_name_sync_service import sync_user_name_from_verified_kyc
from app.application.investor.investor_identity_uniqueness_service import (
    InvestorIdentityConflictError,
    assert_pan_not_used_by_other_user,
)
from app.application.kyc.journey_state_service import get_or_create_journey, save_journey_state
from app.application.kyc.kyc_notification_service import notify_kyc_initiated
from app.application.kyc.master_data import TERMINAL_READINESS_CODES
from app.infrastructure.kyc.date_utils import normalize_kyc_date_of_birth
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.kyc.poa_client import (
    poa_check_readiness,
    poa_fetch_pan_validation,
    poa_fetch_readiness,
    poa_validate_pan_name_dob,
)
from app.infrastructure.persistence.models import KycJourneyState, User

logger = logging.getLogger(__name__)

PAN_PATTERN = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
_PAN_NAME_PATTERN = re.compile(r"^[A-Z][A-Z .'-]*$")


def normalize_pan_number(pan_number: str) -> str:
    pan = (pan_number or "").upper().strip()
    if not PAN_PATTERN.fullmatch(pan):
        raise KycError(
            "Enter a valid PAN number, for example ABCDE1234F.",
            "invalid_pan",
            400,
        )
    return pan


def _normalize_full_name(full_name: str) -> str:
    name = " ".join((full_name or "").split())
    if len(name.replace(" ", "")) < 1 or not _PAN_NAME_PATTERN.fullmatch(name.upper()):
        raise KycError("Enter your name exactly as it appears on the PAN card.", "invalid_name", 400)
    return name


def _split_full_name(full_name: str) -> tuple[str, str, str]:
    parts = full_name.split()
    if len(parts) == 1:
        return parts[0], "", ""
    return parts[0], " ".join(parts[1:-1]), parts[-1]


def _compose_full_name(*, first_name: str, middle_name: str, last_name: str) -> str:
    parts = [first_name.strip(), middle_name.strip(), last_name.strip()]
    return " ".join(part for part in parts if part)


def _normalize_name_key(name: str) -> str:
    return " ".join(name.upper().split())


def _pan_name_is_single_word(full_name: str) -> bool:
    return len([part for part in full_name.split() if part]) == 1


def _normalize_pan_name_draft(pan_draft: dict[str, Any]) -> dict[str, Any]:
    """Avoid duplicating a mononym into both first and last name fields."""
    draft = dict(pan_draft)
    full_name = str(draft.get("fullName") or "").strip()
    first = str(draft.get("firstName") or "").strip()
    last = str(draft.get("lastName") or "").strip()
    if _pan_name_is_single_word(full_name) or (
        first and last and first.upper() == last.upper() and _pan_name_is_single_word(full_name or first)
    ):
        draft["lastName"] = ""
        draft["singleNameOnly"] = True
    else:
        draft["singleNameOnly"] = False
    return draft


def _field_failure(preverify: dict[str, Any], field: str) -> dict[str, Any] | None:
    block = preverify.get(field) or {}
    status = block.get("status")
    if status and status != "verified":
        return {
            "field": field,
            "status": status,
            "code": block.get("code") or status,
            "reason": block.get("reason") or f"{field.replace('_', ' ').capitalize()} does not match PAN records.",
        }
    return None


def _same_pan_inputs(journey: KycJourneyState, *, pan: str, full_name: str, dob: str) -> tuple[bool, bool]:
    """Return (same_pan, same_pan_name_dob) against the last stored PAN pre-verification inputs."""
    draft = journey.pan_draft_json or {}
    same_pan = str(draft.get("panNumber") or "").upper().strip() == pan
    same_all = (
        same_pan
        and _normalize_name_key(str(draft.get("fullName") or "")) == _normalize_name_key(full_name)
        and str(draft.get("dateOfBirth") or "").strip() == dob
    )
    return same_pan, same_all


async def _resolve_readiness(journey: KycJourneyState, *, pan: str, same_pan: bool) -> dict[str, Any]:
    existing_id = journey.poa_readiness_preverify_id
    if same_pan and existing_id:
        try:
            return await poa_fetch_readiness(existing_id, pan_number=pan)
        except FpClientError:
            logger.warning("kyc_readiness_preverify_reuse_failed id=%s", existing_id)
    return await poa_check_readiness(pan)


async def _resolve_pan_validation(
    journey: KycJourneyState,
    *,
    pan: str,
    full_name: str,
    dob: str,
    same_inputs: bool,
) -> dict[str, Any]:
    existing_id = journey.poa_pan_preverify_id
    if same_inputs and existing_id:
        try:
            return await poa_fetch_pan_validation(
                existing_id,
                pan_number=pan,
                full_name=full_name,
                date_of_birth=dob,
            )
        except FpClientError:
            logger.warning("kyc_pan_preverify_reuse_failed id=%s", existing_id)
    return await poa_validate_pan_name_dob(pan_number=pan, full_name=full_name, date_of_birth=dob)


async def verify_pan(
    db: AsyncSession,
    *,
    user: User,
    pan_number: str,
    date_of_birth: str,
    full_name: str = "",
    first_name: str = "",
    middle_name: str = "",
    last_name: str = "",
) -> dict[str, Any]:
    pan = normalize_pan_number(pan_number)
    if pan[3] == "C":
        return {
            "success": False,
            "blocked": True,
            "blockType": "corporate_pan",
            "message": "Corporate PAN cards cannot be used for individual KYC on Zynd.",
        }

    name = _normalize_full_name(
        full_name or _compose_full_name(first_name=first_name, middle_name=middle_name, last_name=last_name)
    )
    first, middle, last = _split_full_name(name)
    try:
        dob = normalize_kyc_date_of_birth(date_of_birth)
    except ValueError as exc:
        raise KycError("Enter a valid date of birth.", "invalid_date_of_birth", 400) from exc

    try:
        await assert_pan_not_used_by_other_user(db, pan_number=pan, user_id=user.id)
    except InvestorIdentityConflictError as exc:
        raise KycError(exc.message, exc.code, exc.status_code) from exc

    notify_kyc_initiated(user=user)

    identity = {
        "firstName": first,
        "lastName": last,
        "middleName": middle,
        "dateOfBirth": dob,
        "fullName": name,
    }

    journey = await get_or_create_journey(db, user.id)
    same_pan, same_inputs = _same_pan_inputs(journey, pan=pan, full_name=name, dob=dob)

    try:
        readiness_result = await _resolve_readiness(journey, pan=pan, same_pan=same_pan)
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

    full_name = str(identity["fullName"]).strip()

    try:
        pan_validation = await _resolve_pan_validation(
            journey,
            pan=pan,
            full_name=full_name,
            dob=dob,
            same_inputs=same_inputs,
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
                        "firstName": identity["firstName"],
                        "lastName": identity["lastName"],
                        "middleName": identity["middleName"],
                        "dateOfBirth": dob,
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

    kyc_already_registered = derive_kyc_already_registered(
        readiness_status=readiness_status,
        readiness_code=readiness_code,
    )
    log_kyc_step(
        "pan_verify_readiness",
        readiness_status=readiness_status,
        readiness_code=readiness_code,
        kyc_already_registered=kyc_already_registered,
        preverify_id=readiness_result.get("id"),
    )
    pan_draft = _normalize_pan_name_draft(
        {
            "panNumber": pan,
            "firstName": identity["firstName"],
            "lastName": identity["lastName"],
            "middleName": identity["middleName"],
            "dateOfBirth": dob,
            "fullName": full_name,
        }
    )
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
    log_kyc_step(
        "pan_verify_saved",
        pan_preverify_id=pan_validation.get("id"),
        readiness_preverify_id=readiness_result.get("id"),
    )

    journey = await get_or_create_journey(db, user.id)

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
        "requiresDigilocker": requires_digilocker_for_readiness(
            kyc_already_registered=kyc_already_registered,
            readiness_code=readiness_code,
        ),
        "requiresFullKycSubmission": requires_full_kyc_submission(journey),
    }


async def confirm_pan_names(
    db: AsyncSession,
    *,
    user: User,
    full_name: str = "",
    first_name: str = "",
    middle_name: str = "",
    last_name: str = "",
) -> dict[str, Any]:
    journey = await get_or_create_journey(db, user.id)
    if journey.pan_verification_status != "verified":
        raise KycError("Complete PAN verification first.", "pan_not_verified", 403)

    pan_draft = dict(journey.pan_draft_json or {})
    pan = str(pan_draft.get("panNumber") or "").upper().strip()
    dob = str(pan_draft.get("dateOfBirth") or "").strip()
    if not pan or not dob:
        raise KycError("PAN details are incomplete.", "pan_incomplete", 400)

    stored_full = str(pan_draft.get("fullName") or "").strip()
    full_name = _normalize_full_name(
        full_name or _compose_full_name(first_name=first_name, middle_name=middle_name, last_name=last_name)
    )
    first, middle, last = _split_full_name(full_name)
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

    updated_draft = _normalize_pan_name_draft(
        {
            **pan_draft,
            "firstName": first,
            "middleName": middle,
            "lastName": last,
            "fullName": full_name,
        }
    )
    journey, _ = await save_journey_state(
        db,
        user=user,
        payload={
            "panDraftJson": updated_draft,
            "panVerificationFailureJson": None,
            "poaPanPreverifyId": poa_pan_preverify_id,
        },
    )

    await sync_user_name_from_verified_kyc(db, user=user, journey=journey)

    return {
        "success": True,
        "blocked": False,
        "panDraft": updated_draft,
        "kycAlreadyRegistered": journey.kyc_already_registered,
        "requiresDigilocker": requires_digilocker_for_readiness(
            kyc_already_registered=bool(journey.kyc_already_registered),
            readiness_code=journey.readiness_code,
        ),
        "requiresFullKycSubmission": requires_full_kyc_submission(journey),
    }
