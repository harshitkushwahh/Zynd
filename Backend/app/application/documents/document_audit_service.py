from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.audit_service import write_audit
from app.infrastructure.persistence.models import AuditEventType, UserDocument


def document_audit_metadata(document: UserDocument, **extra: Any) -> dict[str, Any]:
    return {
        "document_id": str(document.id),
        "doc_type": document.doc_type.value,
        "version": document.version,
        "status": document.status.value,
        "sha256_prefix": document.sha256[:12],
        **extra,
    }


async def audit_document_uploaded(
    db: AsyncSession,
    *,
    document: UserDocument,
    user_id: UUID,
    ip: str | None,
) -> None:
    await write_audit(
        db,
        event_type=AuditEventType.document_uploaded,
        user_id=user_id,
        ip=ip,
        metadata=document_audit_metadata(document),
    )


async def audit_document_scan_passed(
    db: AsyncSession,
    *,
    document: UserDocument,
) -> None:
    await write_audit(
        db,
        event_type=AuditEventType.document_scan_passed,
        user_id=document.user_id,
        metadata=document_audit_metadata(document),
    )


async def audit_document_scan_failed(
    db: AsyncSession,
    *,
    document: UserDocument,
    reason: str,
) -> None:
    await write_audit(
        db,
        event_type=AuditEventType.document_scan_failed,
        user_id=document.user_id,
        metadata=document_audit_metadata(document, reason=reason),
    )


async def audit_document_quarantined(
    db: AsyncSession,
    *,
    document: UserDocument,
    signature: str | None = None,
) -> None:
    await write_audit(
        db,
        event_type=AuditEventType.document_quarantined,
        user_id=document.user_id,
        metadata=document_audit_metadata(
            document,
            malware_signature=signature,
        ),
    )


async def audit_document_download_requested(
    db: AsyncSession,
    *,
    document: UserDocument,
    actor_user_id: UUID,
    ip: str | None,
    actor_type: str = "user",
) -> None:
    await write_audit(
        db,
        event_type=AuditEventType.document_download_requested,
        user_id=document.user_id,
        ip=ip,
        metadata=document_audit_metadata(
            document,
            actor_user_id=str(actor_user_id),
            actor_type=actor_type,
        ),
    )


async def audit_documents_viewed_by_admin(
    db: AsyncSession,
    *,
    target_user_id: UUID,
    admin_user_id: UUID,
    document_count: int,
    ip: str | None,
) -> None:
    await write_audit(
        db,
        event_type=AuditEventType.document_viewed_by_admin,
        user_id=target_user_id,
        ip=ip,
        metadata={
            "admin_user_id": str(admin_user_id),
            "document_count": document_count,
        },
    )


async def audit_document_viewed_by_admin(
    db: AsyncSession,
    *,
    document: UserDocument,
    admin_user_id: UUID,
    ip: str | None,
) -> None:
    await write_audit(
        db,
        event_type=AuditEventType.document_viewed_by_admin,
        user_id=document.user_id,
        ip=ip,
        metadata=document_audit_metadata(
            document,
            admin_user_id=str(admin_user_id),
        ),
    )


async def audit_document_verified(
    db: AsyncSession,
    *,
    document: UserDocument,
    admin_user_id: UUID,
    ip: str | None,
    retain_until: str,
) -> None:
    await write_audit(
        db,
        event_type=AuditEventType.document_verified,
        user_id=document.user_id,
        ip=ip,
        metadata=document_audit_metadata(
            document,
            admin_user_id=str(admin_user_id),
            retain_until=retain_until,
        ),
    )


async def audit_document_legal_hold_updated(
    db: AsyncSession,
    *,
    document: UserDocument,
    admin_user_id: UUID,
    enabled: bool,
    ip: str | None,
) -> None:
    await write_audit(
        db,
        event_type=AuditEventType.document_legal_hold_updated,
        user_id=document.user_id,
        ip=ip,
        metadata=document_audit_metadata(
            document,
            admin_user_id=str(admin_user_id),
            legal_hold=enabled,
        ),
    )


async def audit_document_deleted(
    db: AsyncSession,
    *,
    document: UserDocument,
    admin_user_id: UUID,
    ip: str | None,
    reason: str,
) -> None:
    await write_audit(
        db,
        event_type=AuditEventType.document_deleted,
        user_id=document.user_id,
        ip=ip,
        metadata=document_audit_metadata(
            document,
            admin_user_id=str(admin_user_id),
            reason=reason,
        ),
    )


async def audit_document_kyc_rejected(
    db: AsyncSession,
    *,
    document: UserDocument,
    admin_user_id: UUID,
    ip: str | None,
    reason: str,
) -> None:
    await write_audit(
        db,
        event_type=AuditEventType.document_kyc_rejected,
        user_id=document.user_id,
        ip=ip,
        metadata=document_audit_metadata(
            document,
            admin_user_id=str(admin_user_id),
            reason=reason,
        ),
    )
