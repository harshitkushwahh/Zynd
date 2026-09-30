from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.documents.document_audit_service import (
    audit_document_deleted,
    audit_document_legal_hold_updated,
    audit_document_verified,
)
from app.application.documents.document_worm_policy import (
    admin_may_delete_document,
    data_class_for_doc_type,
    is_kyc_doc_type,
)
from app.application.documents.errors import DocumentError
from app.application.compliance.retention_service import get_retention_policy
from app.core.config import Settings, get_settings
from app.infrastructure.persistence.models import DocumentStatus, DocumentType, KycReviewStatus, User, UserDocument
from app.infrastructure.storage.documents.factory import get_document_storage

logger = logging.getLogger(__name__)


async def _get_document_row(
    db: AsyncSession,
    *,
    document_id: UUID,
) -> UserDocument:
    result = await db.execute(select(UserDocument).where(UserDocument.id == document_id))
    document = result.scalar_one_or_none()
    if not document:
        raise DocumentError("Document not found.", "document_not_found", 404)
    return document


async def _retention_days_for_document(
    db: AsyncSession,
    *,
    document: UserDocument,
    settings: Settings,
) -> int:
    if settings.documents_worm_retention_days > 0:
        return settings.documents_worm_retention_days
    data_class = data_class_for_doc_type(document.doc_type)
    policy = await get_retention_policy(db, data_class)
    if policy:
        return policy.min_retention_days
    return 1825


def _apply_storage_worm_lock(
    *,
    document: UserDocument,
    retain_until: datetime,
    settings: Settings,
) -> None:
    storage = get_document_storage(settings)
    apply_lock = getattr(storage, "apply_worm_retention", None)
    if not callable(apply_lock):
        return
    try:
        apply_lock(
            bucket=document.storage_bucket,
            storage_key=document.storage_key,
            retain_until=retain_until,
        )
    except Exception:
        logger.exception(
            "Failed to apply storage WORM lock document_id=%s bucket=%s key=%s",
            document.id,
            document.storage_bucket,
            document.storage_key,
        )
        if settings.documents_worm_s3_object_lock_enabled:
            raise


async def verify_document(
    db: AsyncSession,
    *,
    document_id: UUID,
    admin: User,
    ip: str | None,
    settings: Settings | None = None,
) -> dict[str, Any]:
    settings = settings or get_settings()
    document = await _get_document_row(db, document_id=document_id)

    if document.status != DocumentStatus.active:
        raise DocumentError(
            "Only active documents can be verified.",
            "document_not_verifiable",
            409,
        )
    if document.immutable_at is not None:
        raise DocumentError("Document is already immutable.", "document_already_immutable", 409)

    now = datetime.now(timezone.utc)
    retention_days = await _retention_days_for_document(db, document=document, settings=settings)
    retain_until = now + timedelta(days=retention_days)

    document.immutable_at = now
    document.kyc_review_status = KycReviewStatus.approved
    await db.flush()

    if settings.documents_worm_s3_object_lock_enabled or settings.document_storage_provider == "local":
        _apply_storage_worm_lock(document=document, retain_until=retain_until, settings=settings)

    await audit_document_verified(
        db,
        document=document,
        admin_user_id=admin.id,
        ip=ip,
        retain_until=retain_until.isoformat(),
    )
    await db.refresh(document)
    return _worm_document_dict(document)


async def verify_user_kyc_documents(
    db: AsyncSession,
    *,
    user_id: UUID,
    admin: User,
    ip: str | None,
    settings: Settings | None = None,
) -> dict[str, Any]:
    settings = settings or get_settings()
    result = await db.execute(
        select(UserDocument).where(
            UserDocument.user_id == user_id,
            UserDocument.status == DocumentStatus.active,
        )
    )
    documents = [row for row in result.scalars() if is_kyc_doc_type(row.doc_type)]
    verified: list[dict[str, Any]] = []
    skipped = 0
    for document in documents:
        if document.immutable_at is not None:
            skipped += 1
            continue
        verified.append(
            await verify_document(
                db,
                document_id=document.id,
                admin=admin,
                ip=ip,
                settings=settings,
            )
        )
    return {"verified_count": len(verified), "skipped_count": skipped, "documents": verified}


async def set_document_legal_hold(
    db: AsyncSession,
    *,
    document_id: UUID,
    enabled: bool,
    admin: User,
    ip: str | None,
) -> dict[str, Any]:
    document = await _get_document_row(db, document_id=document_id)
    document.legal_hold = enabled
    await db.flush()
    await audit_document_legal_hold_updated(
        db,
        document=document,
        admin_user_id=admin.id,
        enabled=enabled,
        ip=ip,
    )
    await db.refresh(document)
    return _worm_document_dict(document)


async def delete_document_admin(
    db: AsyncSession,
    *,
    document_id: UUID,
    admin: User,
    ip: str | None,
    reason: str,
    settings: Settings | None = None,
) -> dict[str, Any]:
    settings = settings or get_settings()
    document = await _get_document_row(db, document_id=document_id)

    if not admin_may_delete_document(document):
        raise DocumentError(
            "Document is under legal hold and cannot be deleted.",
            "document_legal_hold",
            409,
        )

    storage = get_document_storage(settings)
    if storage.exists(bucket=document.storage_bucket, storage_key=document.storage_key):
        try:
            storage.delete_object(
                bucket=document.storage_bucket,
                storage_key=document.storage_key,
                force=True,
            )
        except Exception as exc:
            raise DocumentError(
                "Document storage is protected and could not be deleted.",
                "document_worm_protected",
                409,
            ) from exc

    snapshot = _worm_document_dict(document)
    await audit_document_deleted(
        db,
        document=document,
        admin_user_id=admin.id,
        ip=ip,
        reason=reason,
    )
    await db.delete(document)
    await db.flush()
    return snapshot


def _worm_document_dict(document: UserDocument) -> dict[str, Any]:
    return {
        "id": document.id,
        "user_id": document.user_id,
        "client_id": document.client_id,
        "doc_type": document.doc_type.value,
        "version": document.version,
        "status": document.status.value,
        "immutable_at": document.immutable_at,
        "legal_hold": document.legal_hold,
        "kyc_review_status": document.kyc_review_status.value if document.kyc_review_status else None,
        "created_at": document.created_at,
    }
