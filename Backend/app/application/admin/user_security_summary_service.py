from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models import AuditEventType, AuditLog, User


def _resolve_login_method(event_type: AuditEventType, metadata: dict[str, Any] | None) -> str:
    metadata = metadata or {}
    if event_type == AuditEventType.login_sms_otp_verified:
        return "sms"
    if event_type == AuditEventType.mfa_challenge_success:
        method = metadata.get("method")
        if method == "sms":
            return "sms"
        if method == "backup":
            return "backup"
        return "authenticator"
    if event_type == AuditEventType.login_success:
        provider = metadata.get("provider")
        if provider:
            return "oauth"
        return "password"
    return "password"


async def get_user_last_login_summary(
    db: AsyncSession,
    user_id: UUID,
) -> dict[str, Any]:
    result = await db.execute(
        select(AuditLog)
        .where(
            AuditLog.user_id == user_id,
            AuditLog.event_type.in_(
                (
                    AuditEventType.login_success,
                    AuditEventType.login_sms_otp_verified,
                    AuditEventType.mfa_challenge_success,
                )
            ),
        )
        .order_by(AuditLog.created_at.desc())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    if not row:
        return {"last_login_at": None, "last_login_method": None}
    metadata = row.metadata_ if isinstance(row.metadata_, dict) else {}
    return {
        "last_login_at": row.created_at,
        "last_login_method": _resolve_login_method(row.event_type, metadata),
    }


def build_admin_security_summary(user: User, last_login: dict[str, Any]) -> dict[str, Any]:
    from app.application.auth.account_service import fund_eligibility_status

    eligibility = fund_eligibility_status(user)
    return {
        "mfa_enrolled": user.mfa_enrolled_at is not None,
        "pin_enrolled": user.pin_hash is not None,
        "phone_verified": user.phone_verified_at is not None,
        "fund_movement_eligible": eligibility["eligible"],
        "last_login_at": last_login.get("last_login_at"),
        "last_login_method": last_login.get("last_login_method"),
    }
