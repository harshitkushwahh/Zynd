from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.compliance.anonymization import anonymize_user_profile
from app.application.compliance.retention_service import can_delete_on_request
from app.application.documents.document_retention_service import purge_due_documents_for_user
from app.application.auth.audit_service import write_audit
from app.application.security.pii_vault_service import apply_pii_vault_deletion_policy
from app.core.config import Settings, get_settings
from app.infrastructure.notifications.email_service import send_security_email
from app.infrastructure.persistence.models import (
    AuditEventType,
    AuditLog,
    DeletionEventType,
    DeletionLedger,
    Device,
    OAuthAccount,
    OAuthLinkRequest,
    SecurityReviewItem,
    Session,
    User,
    UserBackupCode,
    UserMfaSecret,
    UserRole,
    UserStatus,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def fetch_due_deletion_users(
    db: AsyncSession,
    *,
    limit: int | None = None,
) -> list[User]:
    settings = get_settings()
    batch_size = limit or settings.deletion_executor_batch_size
    result = await db.execute(
        select(User)
        .where(
            User.status == UserStatus.deletion_pending,
            User.role == UserRole.user,
            User.deletion_scheduled_at.is_not(None),
            User.deletion_scheduled_at <= _now(),
        )
        .order_by(User.deletion_scheduled_at.asc())
        .limit(batch_size)
    )
    return list(result.scalars())


async def _purge_auth_credentials(db: AsyncSession, user_id: UUID) -> None:
    await db.execute(delete(UserMfaSecret).where(UserMfaSecret.user_id == user_id))
    await db.execute(delete(UserBackupCode).where(UserBackupCode.user_id == user_id))
    await db.execute(delete(OAuthAccount).where(OAuthAccount.user_id == user_id))
    await db.execute(delete(OAuthLinkRequest).where(OAuthLinkRequest.user_id == user_id))
    await db.execute(delete(Session).where(Session.user_id == user_id))
    await db.execute(delete(Device).where(Device.user_id == user_id))
    await db.execute(delete(SecurityReviewItem).where(SecurityReviewItem.user_id == user_id))


async def _anonymize_audit_logs(db: AsyncSession, user_id: UUID) -> None:
    await db.execute(update(AuditLog).where(AuditLog.user_id == user_id).values(user_id=None))


async def execute_account_deletion(
    db: AsyncSession,
    *,
    user: User,
    ip: str | None = None,
    notify_email: str | None = None,
) -> dict[str, Any]:
    if user.status != UserStatus.deletion_pending:
        raise ValueError("User is not pending deletion.")
    if user.role != UserRole.user:
        raise ValueError("Only customer accounts can be erased through the deletion executor.")
    if user.deletion_scheduled_at and user.deletion_scheduled_at > _now():
        raise ValueError("Deletion grace period has not expired.")

    settings = get_settings()
    original_email = notify_email or user.email
    user_id = user.id

    document_retention = await purge_due_documents_for_user(db, user_id=user_id)

    if await can_delete_on_request(db, "auth_credentials"):
        await _purge_auth_credentials(db, user_id)

    await apply_pii_vault_deletion_policy(db, user_id=user_id)

    if await can_delete_on_request(db, "profile_pii"):
        anonymize_user_profile(user, settings)
    else:
        user.phone = None
        user.first_name = None
        user.middle_name = None
        user.last_name = None

    user.status = UserStatus.deleted
    user.deleted_at = _now()
    user.deletion_requested_at = None
    user.deletion_scheduled_at = None

    await _anonymize_audit_logs(db, user_id)

    db.add(
        DeletionLedger(
            user_id=user_id,
            event_type=DeletionEventType.deletion_executed,
            retention_policy="dpdp_grace_30d",
            metadata_={
                "anonymized_email": user.email,
                "executed_by": "system",
                "documents_purged_count": document_retention["documents_purged_count"],
                "documents_retained_count": document_retention["documents_retained_count"],
            },
        )
    )
    await write_audit(
        db,
        event_type=AuditEventType.account_deletion_executed,
        user_id=user_id,
        ip=ip,
        metadata={"anonymized_email": user.email},
    )

    if original_email and "@" in original_email and not original_email.startswith("deleted+"):
        await send_security_email(
            to_email=original_email,
            subject="Your ZYND account has been deleted",
            body=(
                "Your ZYND account deletion is complete.\n\n"
                "Personal credentials and profile data covered by our erasure policy have been removed "
                "or anonymized. Records we must keep for legal/regulatory reasons remain under retention "
                "controls.\n\n"
                "If you did not request this, contact support immediately."
            ),
        )

    await db.flush()
    return {
        "user_id": str(user_id),
        "deleted_at": user.deleted_at,
        "anonymized_email": user.email,
    }


async def run_deletion_executor(
    db: AsyncSession,
    *,
    limit: int | None = None,
    ip: str | None = None,
) -> dict[str, Any]:
    due_users = await fetch_due_deletion_users(db, limit=limit)
    executed: list[dict[str, Any]] = []
    failures: list[dict[str, str]] = []

    for user in due_users:
        notify_email = user.email
        try:
            result = await execute_account_deletion(
                db,
                user=user,
                ip=ip,
                notify_email=notify_email,
            )
            executed.append(result)
        except Exception as exc:  # noqa: BLE001 - batch executor must continue
            failures.append({"user_id": str(user.id), "error": str(exc)})

    return {
        "processed": len(due_users),
        "executed": len(executed),
        "failed": len(failures),
        "results": executed,
        "failures": failures,
    }
