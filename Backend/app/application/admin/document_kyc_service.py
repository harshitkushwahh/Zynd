from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.documents.document_audit_service import audit_document_kyc_rejected
from app.application.documents.document_worm_policy import is_kyc_doc_type
from app.application.documents.errors import DocumentError
from app.application.kyc.kyc_notification_service import notify_kyc_rejected
from app.infrastructure.persistence.models import (
    DocumentStatus,
    KycReviewStatus,
    User,
    UserDocument,
)


def _kyc_document_dict(document: UserDocument) -> dict[str, Any]:
    return {
        "id": document.id,
        "doc_type": document.doc_type.value,
        "version": document.version,
        "status": document.status.value,
        "kyc_review_status": document.kyc_review_status.value if document.kyc_review_status else None,
        "immutable_at": document.immutable_at,
        "original_filename": document.original_filename,
        "mime_type": document.mime_type,
        "created_at": document.created_at,
    }


async def get_user_kyc_review(
    db: AsyncSession,
    *,
    user_id: UUID,
) -> dict[str, Any]:
    user = await db.get(User, user_id)
    if not user:
        raise DocumentError("User not found.", "user_not_found", 404)

    result = await db.execute(
        select(UserDocument)
        .where(UserDocument.user_id == user_id)
        .order_by(UserDocument.doc_type.asc(), UserDocument.version.desc(), UserDocument.created_at.desc())
    )
    documents = [row for row in result.scalars() if is_kyc_doc_type(row.doc_type)]

    latest_by_type: dict[str, UserDocument] = {}
    for document in documents:
        key = document.doc_type.value
        if key not in latest_by_type:
            latest_by_type[key] = document

    return {
        "user_id": user.id,
        "client_id": user.client_id,
        "email": user.email,
        "documents": [_kyc_document_dict(document) for document in latest_by_type.values()],
    }


async def reject_kyc_document(
    db: AsyncSession,
    *,
    document_id: UUID,
    admin: User,
    ip: str | None,
    reason: str,
) -> dict[str, Any]:
    result = await db.execute(select(UserDocument).where(UserDocument.id == document_id))
    document = result.scalar_one_or_none()
    if not document:
        raise DocumentError("Document not found.", "document_not_found", 404)
    if not is_kyc_doc_type(document.doc_type):
        raise DocumentError("Only KYC documents can be rejected.", "document_not_kyc", 409)
    if document.status != DocumentStatus.active:
        raise DocumentError("Only active documents can be rejected.", "document_not_rejectable", 409)
    if document.kyc_review_status == KycReviewStatus.approved:
        raise DocumentError("Approved documents cannot be rejected.", "document_already_approved", 409)

    document.kyc_review_status = KycReviewStatus.rejected
    await db.flush()
    await audit_document_kyc_rejected(
        db,
        document=document,
        admin_user_id=admin.id,
        ip=ip,
        reason=reason,
    )
    user = await db.get(User, document.user_id)
    if user:
        notify_kyc_rejected(
            user=user,
            reason=reason,
            doc_type=document.doc_type.value,
        )
    await db.refresh(document)
    return _kyc_document_dict(document)
