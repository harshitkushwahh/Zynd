from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.session_service import revoke_all_sessions
from app.infrastructure.notifications.email_service import send_security_email
from app.infrastructure.persistence.models import AuditEventType, AuditLog, User, UserStatus

SUSPENSION_REASON_CODES = {
    "suspicious_activity",
    "kyc_mismatch",
    "user_requested",
    "compliance_hold",
    "repeated_auth_failures",
    "chargeback_dispute",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def suspend_user(
    db: AsyncSession,
    *,
    user: User,
    admin: User,
    reason_code: str,
    ip: str | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    if reason_code not in SUSPENSION_REASON_CODES:
        raise ValueError("Invalid suspension reason code.")
    if user.status == UserStatus.deleted:
        raise ValueError("Deleted accounts cannot be suspended.")
    if user.status == UserStatus.suspended:
        raise ValueError("Account is already suspended.")
    if user.id == admin.id:
        raise ValueError("You cannot suspend your own account.")

    user.status = UserStatus.suspended
    user.suspended_at = _now()
    user.suspension_reason_code = reason_code
    user.suspended_by = admin.id
    user.is_locked = False
    user.locked_until = None

    revoked = await revoke_all_sessions(db, user_id=user.id, ip=ip, reason="account_suspended")
    db.add(
        AuditLog(
            user_id=user.id,
            event_type=AuditEventType.account_suspended,
            ip_address=ip,
            metadata_={
                "reason_code": reason_code,
                "admin_id": str(admin.id),
                "notes": notes,
                "revoked_sessions": revoked,
            },
        )
    )

    if user.email and not user.email.startswith("deleted+"):
        await send_security_email(
            to_email=user.email,
            subject="Your ZYND account has been suspended",
            body=(
                "Your ZYND account has been temporarily suspended.\n\n"
                "If you believe this is a mistake, contact support to appeal."
            ),
        )

    await db.flush()
    return {
        "user_id": str(user.id),
        "status": user.status.value,
        "suspension_reason_code": reason_code,
        "suspended_at": user.suspended_at,
    }


async def unsuspend_user(
    db: AsyncSession,
    *,
    user: User,
    admin: User,
    ip: str | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    if user.status != UserStatus.suspended:
        raise ValueError("Account is not suspended.")

    user.status = UserStatus.active
    user.suspended_at = None
    user.suspension_reason_code = None
    user.suspended_by = None

    db.add(
        AuditLog(
            user_id=user.id,
            event_type=AuditEventType.account_unsuspended,
            ip_address=ip,
            metadata_={"admin_id": str(admin.id), "notes": notes},
        )
    )

    if user.email and not user.email.startswith("deleted+"):
        await send_security_email(
            to_email=user.email,
            subject="Your ZYND account has been reactivated",
            body="Your ZYND account suspension has been lifted. You can sign in again.",
        )

    await db.flush()
    return {
        "user_id": str(user.id),
        "status": user.status.value,
    }


async def list_users(
    db: AsyncSession,
    *,
    email: str | None = None,
    status: UserStatus | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    query = select(User).order_by(User.created_at.desc())
    if email:
        normalized = email.lower().strip()
        query = query.where(User.email.ilike(f"%{normalized}%"))
    if status:
        query = query.where(User.status == status)
    query = query.limit(min(limit, 100)).offset(max(offset, 0))
    result = await db.execute(query)
    return [
        {
            "user_id": user.id,
            "email": user.email,
            "status": user.status.value,
            "role": user.role.value,
            "suspended_at": user.suspended_at,
            "mfa_enrolled": user.mfa_enrolled_at is not None,
            "created_at": user.created_at,
        }
        for user in result.scalars()
    ]


async def get_user_summary(db: AsyncSession, user_id: UUID) -> dict[str, Any] | None:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return None
    return {
        "user_id": user.id,
        "email": user.email,
        "status": user.status.value,
        "role": user.role.value,
        "suspended_at": user.suspended_at,
        "suspension_reason_code": user.suspension_reason_code,
        "mfa_enrolled": user.mfa_enrolled_at is not None,
        "created_at": user.created_at,
    }
