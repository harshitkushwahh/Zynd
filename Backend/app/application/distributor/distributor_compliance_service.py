from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.user_admin_service import get_user_summary
from app.application.distributor.distributor_client_link_service import list_book_client_user_ids_for_actor
from app.application.kyc.master_data import TERMINAL_READINESS_CODES
from app.infrastructure.persistence.models import KycJourneyState, KycOverallStatus, User, UserKycStatus


def _days_open(since: datetime | None) -> int:
    if since is None:
        return 0
    now = datetime.now(timezone.utc)
    if since.tzinfo is None:
        since = since.replace(tzinfo=timezone.utc)
    return max(0, (now - since).days)


def _issue_from_journey(
    *,
    journey: KycJourneyState | None,
    status: UserKycStatus | None,
) -> tuple[str, str, str] | None:
    if status and status.overall_status == KycOverallStatus.completed:
        return None

    readiness_code = str(journey.readiness_code or "").lower() if journey else ""
    if readiness_code in TERMINAL_READINESS_CODES:
        label = "Compliance exception"
        if readiness_code == "kyc_underprocess":
            stage = "KYC under process at KRA"
        else:
            stage = "KYC deactivated at KRA"
        return label, stage, "High"

    if journey and journey.kyc_form_status == "awaiting_esign":
        return "eSign pending", "Awaiting eSign", "High"

    if journey and journey.bank_verification_status == "failed":
        return "Bank verification", "Bank verification failed", "Medium"

    if journey and journey.nominee_draft_json is None and journey.last_completed_step in {
        "personal",
        "address",
        None,
    }:
        if journey.last_completed_step == "personal":
            return "Nominee incomplete", "Nominee details pending", "Medium"

    if not journey or journey.pan_verification_status != "verified":
        return "KYC pending", "PAN verification pending", "High"

    if status and status.overall_status == KycOverallStatus.submitted:
        return "KYC pending", "Submitted — awaiting KRA", "Medium"

    step = journey.last_completed_step or "pan"
    return "KYC pending", f"KYC in progress — last step: {step}", "Medium"


async def list_distributor_compliance_queue(
    db: AsyncSession,
    *,
    actor: User,
) -> list[dict[str, Any]]:
    client_ids = await list_book_client_user_ids_for_actor(db, actor=actor)
    if not client_ids:
        return []

    rows: list[dict[str, Any]] = []
    for client_user_id in client_ids:
        user = await db.get(User, client_user_id)
        if user is None:
            continue
        journey = await db.get(KycJourneyState, client_user_id)
        status = await db.get(UserKycStatus, client_user_id)
        issue = _issue_from_journey(journey=journey, status=status)
        if issue is None:
            continue

        issue_type, stage, severity = issue
        summary = await get_user_summary(db, client_user_id)
        display_name = summary.get("display_name") if summary else None
        if not display_name:
            display_name = user.email

        updated_at = (
            journey.updated_at
            if journey and journey.updated_at
            else user.created_at
        )
        rows.append(
            {
                "id": str(client_user_id),
                "client_id": str(client_user_id),
                "client_code": user.client_id,
                "client_label": display_name,
                "issue_type": issue_type,
                "stage": stage,
                "severity": severity,
                "days_open": _days_open(updated_at),
                "updated_at": updated_at,
            }
        )

    rows.sort(key=lambda item: (-item["days_open"], item["client_label"]))
    return rows
