from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.user_admin_service import _display_name
from app.application.risk_profile.attempt_service import get_or_create_attempt_state
from app.infrastructure.persistence.models import AuditEventType, AuditLog, User
from app.infrastructure.persistence.risk_profile_models import RiskProfileUnlockGrant

RISK_PROFILE_UNLOCK_OTP_TTL_SECONDS = 600

_UNLOCK_AUDIT_ACTIONS = (
    "risk_profile_unlock_otp_requested",
    "risk_profile_unlock_otp_failed",
)


def _iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def _admin_id_from_metadata(metadata: dict[str, Any]) -> UUID | None:
    raw = metadata.get("admin_id")
    if not raw:
        return None
    try:
        return UUID(str(raw))
    except ValueError:
        return None


def _serialize_admin(user: User | None) -> dict[str, str | None]:
    if not user:
        return {"admin_id": None, "admin_email": None, "admin_display_name": None}
    return {
        "admin_id": str(user.id),
        "admin_email": user.email,
        "admin_display_name": _display_name(user),
    }


def _append_abandoned_otp_steps(steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not steps:
        return steps

    enriched: list[dict[str, Any]] = []
    index = 0
    while index < len(steps):
        step = steps[index]
        enriched.append(step)
        if step["kind"] != "otp_requested":
            index += 1
            continue

        request_time = datetime.fromisoformat(step["created_at"])
        admin_id = step.get("admin_id")
        resolved = False
        superseded_at: datetime | None = None

        cursor = index + 1
        while cursor < len(steps):
            candidate = steps[cursor]
            if candidate["kind"] == "otp_requested":
                superseded_at = datetime.fromisoformat(candidate["created_at"])
                break
            if candidate["kind"] in {"otp_failed", "granted"} and candidate.get("admin_id") == admin_id:
                resolved = True
                break
            cursor += 1

        if not resolved:
            expiry_time = request_time + timedelta(seconds=RISK_PROFILE_UNLOCK_OTP_TTL_SECONDS)
            closed_at = superseded_at if superseded_at and superseded_at < expiry_time else expiry_time
            enriched.append(
                {
                    "id": f"{step['id']}:expired",
                    "kind": "otp_expired",
                    "title": "Unlock code expired",
                    "description": "No confirmation was received before the code expired.",
                    "status": "Expired",
                    "created_at": _iso(closed_at),
                    "admin_id": admin_id,
                    "admin_email": step.get("admin_email"),
                    "admin_display_name": step.get("admin_display_name"),
                    "attempts_granted": None,
                    "metadata": {"source_request_id": step["id"]},
                }
            )
        index += 1

    enriched.sort(key=lambda item: item["created_at"])
    return enriched


async def get_unlock_journey(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    attempt_state = await get_or_create_attempt_state(db, user_id)

    audit_result = await db.execute(
        select(AuditLog)
        .where(AuditLog.user_id == user_id)
        .where(
            or_(
                AuditLog.event_type.in_([AuditEventType.risk_profile_locked]),
                and_(
                    AuditLog.event_type == AuditEventType.admin_action_requested,
                    AuditLog.metadata_["action"].astext.in_(_UNLOCK_AUDIT_ACTIONS),
                ),
            )
        )
        .order_by(AuditLog.created_at.asc())
    )

    grants_result = await db.execute(
        select(RiskProfileUnlockGrant)
        .where(RiskProfileUnlockGrant.user_id == user_id)
        .order_by(RiskProfileUnlockGrant.created_at.asc())
    )
    grants = list(grants_result.scalars())

    admin_ids: set[UUID] = {grant.admin_id for grant in grants if grant.admin_id}
    raw_steps: list[dict[str, Any]] = []

    for row in audit_result.scalars():
        metadata = row.metadata_ or {}
        admin_id = _admin_id_from_metadata(metadata)
        if admin_id:
            admin_ids.add(admin_id)

        if row.event_type == AuditEventType.risk_profile_locked:
            raw_steps.append(
                {
                    "id": str(row.id),
                    "kind": "locked",
                    "title": "Profile locked",
                    "description": (
                        f"Completed {metadata.get('completed_count', '—')} of "
                        f"{metadata.get('granted_attempts', '—')} granted attempts."
                    ),
                    "status": "Locked",
                    "created_at": _iso(row.created_at),
                    "admin_id": None,
                    "admin_email": None,
                    "admin_display_name": None,
                    "attempts_granted": None,
                    "metadata": metadata,
                }
            )
            continue

        if row.event_type == AuditEventType.admin_action_requested:
            action = metadata.get("action")
            if action == "risk_profile_unlock_otp_requested":
                raw_steps.append(
                    {
                        "id": str(row.id),
                        "kind": "otp_requested",
                        "title": "Unlock code sent",
                        "description": "Unlock code delivered to the user's in-app notifications.",
                        "status": "Code sent",
                        "created_at": _iso(row.created_at),
                        "admin_id": str(admin_id) if admin_id else None,
                        "admin_email": None,
                        "admin_display_name": None,
                        "attempts_granted": None,
                        "metadata": metadata,
                    }
                )
            elif action == "risk_profile_unlock_otp_failed":
                raw_steps.append(
                    {
                        "id": str(row.id),
                        "kind": "otp_failed",
                        "title": "Unlock confirmation failed",
                        "description": "The code entered was invalid or expired.",
                        "status": "Failed",
                        "created_at": _iso(row.created_at),
                        "admin_id": str(admin_id) if admin_id else None,
                        "admin_email": None,
                        "admin_display_name": None,
                        "attempts_granted": None,
                        "metadata": metadata,
                    }
                )

    for grant in grants:
        if grant.admin_id:
            admin_ids.add(grant.admin_id)
        raw_steps.append(
            {
                "id": str(grant.id),
                "kind": "granted",
                "title": "Attempts granted",
                "description": f"Granted {grant.attempts_granted} additional assessment attempt(s).",
                "status": "Granted",
                "created_at": _iso(grant.created_at),
                "admin_id": str(grant.admin_id) if grant.admin_id else None,
                "admin_email": None,
                "admin_display_name": None,
                "attempts_granted": grant.attempts_granted,
                "metadata": {"grant_id": str(grant.id)},
            }
        )

    raw_steps.sort(key=lambda item: item["created_at"])

    admins: dict[str, User] = {}
    if admin_ids:
        admin_rows = await db.execute(select(User).where(User.id.in_(admin_ids)))
        admins = {str(row.id): row for row in admin_rows.scalars()}

    for step in raw_steps:
        admin_id = step.get("admin_id")
        if not admin_id:
            continue
        admin = admins.get(admin_id)
        step.update(_serialize_admin(admin))

    steps = _append_abandoned_otp_steps(raw_steps)

    for step in steps:
        admin_id = step.get("admin_id")
        if not admin_id or step.get("admin_display_name"):
            continue
        admin = admins.get(admin_id)
        step.update(_serialize_admin(admin))

    return {
        "user_id": str(user_id),
        "attempt_state": {
            "completed_count": attempt_state.completed_count,
            "granted_attempts": attempt_state.granted_attempts,
            "attempts_remaining": max(0, attempt_state.granted_attempts - attempt_state.completed_count),
            "is_locked": attempt_state.completed_count >= attempt_state.granted_attempts,
            "locked_at": _iso(attempt_state.locked_at) if attempt_state.locked_at else None,
        },
        "steps": steps,
    }
