from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.kyc.errors import KycError
from app.application.kyc.journey_state_service import get_or_create_journey, get_or_create_status
from app.application.kyc.kyc_completion_service import on_kyc_completed
from app.infrastructure.kyc.poa_client import poa_check_readiness
from app.infrastructure.persistence.models import KycOverallStatus, User


async def check_kra_readiness_status(db: AsyncSession, *, user: User) -> dict[str, Any]:
    journey = await get_or_create_journey(db, user.id)
    status = await get_or_create_status(db, user.id)

    if status.overall_status == KycOverallStatus.completed:
        completion = await on_kyc_completed(db, user=user, journey=journey)
        return {
            "kraVerified": True,
            "nameUpdated": completion["nameUpdated"],
            "overallStatus": status.overall_status.value,
            "readiness": {
                "status": "verified",
                "code": journey.readiness_code,
                "reason": journey.readiness_reason,
            },
            "message": "Your KYC is verified at the KRA.",
        }

    if status.overall_status != KycOverallStatus.submitted:
        raise KycError(
            "Submit your KYC application before checking KRA status.",
            "kyc_not_submitted",
            409,
        )

    pan_draft = journey.pan_draft_json or {}
    pan = str(pan_draft.get("panNumber") or "").upper().strip()
    if not pan:
        raise KycError("PAN details are missing from your KYC journey.", "pan_missing", 400)

    readiness_result = await poa_check_readiness(pan)
    readiness = readiness_result.get("readiness") or {}
    readiness_status = readiness.get("status")
    readiness_code = readiness.get("code")
    readiness_reason = readiness.get("reason")

    journey.readiness_code = readiness_code
    journey.readiness_reason = readiness_reason
    journey.poa_readiness_preverify_id = readiness_result.get("id")

    kra_verified = readiness_status == "verified"
    name_updated = False
    if kra_verified:
        status.overall_status = KycOverallStatus.completed
        completion = await on_kyc_completed(db, user=user, journey=journey)
        name_updated = completion["nameUpdated"]

    await db.flush()

    if kra_verified:
        message = "Your KYC is verified at the KRA."
    elif readiness_status == "failed":
        message = readiness_reason or "KYC verification is still pending at the KRA."
    else:
        message = "KYC verification is still pending at the KRA."

    return {
        "kraVerified": kra_verified,
        "nameUpdated": name_updated,
        "overallStatus": status.overall_status.value,
        "readiness": {
            "status": readiness_status,
            "code": readiness_code,
            "reason": readiness_reason,
        },
        "message": message,
    }
