from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models import UserDocument


def _admin_document_dict(document: UserDocument) -> dict[str, Any]:
    return {
        "id": document.id,
        "user_id": document.user_id,
        "client_id": document.client_id,
        "doc_type": document.doc_type.value,
        "version": document.version,
        "original_filename": document.original_filename,
        "mime_type": document.mime_type,
        "size_bytes": document.size_bytes,
        "sha256": document.sha256,
        "status": document.status.value,
        "storage_provider": document.storage_provider.value,
        "storage_bucket": document.storage_bucket,
        "immutable_at": document.immutable_at,
        "legal_hold": document.legal_hold,
        "deletion_scheduled_at": document.deletion_scheduled_at,
        "kyc_review_status": document.kyc_review_status.value if document.kyc_review_status else None,
        "created_at": document.created_at,
    }


async def list_documents_for_user_admin(
    db: AsyncSession,
    *,
    user_id: UUID,
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(UserDocument)
        .where(UserDocument.user_id == user_id)
        .order_by(UserDocument.doc_type.asc(), UserDocument.version.desc(), UserDocument.created_at.desc())
    )
    return [_admin_document_dict(document) for document in result.scalars()]


async def get_document_admin_row(
    db: AsyncSession,
    *,
    document_id: UUID,
) -> UserDocument | None:
    result = await db.execute(select(UserDocument).where(UserDocument.id == document_id))
    return result.scalar_one_or_none()


async def get_document_admin(
    db: AsyncSession,
    *,
    document_id: UUID,
) -> dict[str, Any] | None:
    document = await get_document_admin_row(db, document_id=document_id)
    if not document:
        return None
    return _admin_document_dict(document)
