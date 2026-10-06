from __future__ import annotations

import hashlib
import os
import re
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.documents.client_id_service import assign_client_id
from app.application.documents.document_audit_service import audit_document_uploaded
from app.application.documents.document_image_validation import (
    max_bytes_for_doc_type,
    validate_profile_image_content,
)
from app.application.documents.document_scan_service import dispatch_document_scan
from app.application.documents.document_storage_service import build_storage_key, extension_for_mime
from app.application.documents.errors import DocumentError
from app.core.config import Settings, get_settings
from app.infrastructure.persistence.models import (
    DocumentStatus,
    DocumentStorageProvider,
    DocumentType,
    KycReviewStatus,
    User,
    UserDocument,
)
from app.application.documents.document_worm_policy import is_kyc_doc_type
from app.application.notifications.account_notification_service import notify_profile_image_updated
from app.infrastructure.security.rate_limit import check_rate_limit
from app.infrastructure.storage.documents.bucket_policy import bucket_for_doc_type, is_pii_doc_type
from app.infrastructure.storage.documents.factory import get_document_storage

_ALLOWED_MIME_BY_TYPE: dict[DocumentType, set[str]] = {
    DocumentType.aadhaar: {"application/pdf", "image/png", "image/jpeg", "image/webp"},
    DocumentType.pan: {"application/pdf", "image/png", "image/jpeg", "image/webp"},
    DocumentType.profile_image: {
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/heic",
        "image/heif",
    },
    DocumentType.family_group_avatar: {
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/heic",
        "image/heif",
    },
    DocumentType.bank_statement: {"application/pdf", "image/png", "image/jpeg", "image/webp"},
    DocumentType.signature: {"image/png", "image/jpeg", "image/webp"},
    DocumentType.address_proof: {"application/pdf", "image/png", "image/jpeg", "image/webp"},
    DocumentType.nominee_id: {"application/pdf", "image/png", "image/jpeg", "image/webp"},
}

_SAFE_FILENAME_PATTERN = re.compile(r"[^A-Za-z0-9._-]+")


def _sanitize_filename(filename: str, *, fallback: str) -> str:
    base = os.path.basename(filename or "").strip()
    cleaned = _SAFE_FILENAME_PATTERN.sub("_", base).strip("._")
    if not cleaned:
        return fallback
    return cleaned[:120]


def _document_to_dict(document: UserDocument) -> dict[str, Any]:
    return {
        "id": document.id,
        "client_id": document.client_id,
        "doc_type": document.doc_type.value,
        "version": document.version,
        "original_filename": document.original_filename,
        "mime_type": document.mime_type,
        "size_bytes": document.size_bytes,
        "sha256": document.sha256,
        "status": document.status.value,
        "immutable_at": document.immutable_at,
        "legal_hold": document.legal_hold,
        "kyc_review_status": document.kyc_review_status.value if document.kyc_review_status else None,
        "created_at": document.created_at,
    }


async def _next_version(db: AsyncSession, *, user_id, doc_type: DocumentType) -> int:
    result = await db.execute(
        select(func.max(UserDocument.version)).where(
            UserDocument.user_id == user_id,
            UserDocument.doc_type == doc_type,
        )
    )
    current = result.scalar_one_or_none()
    return (current or 0) + 1


async def finalize_document_scans(
    db: AsyncSession,
    document_ids: list[UUID],
    *,
    user: User | None = None,
    settings: Settings | None = None,
) -> None:
    """Run malware scan after the upload transaction is committed (safe for async queue + workers)."""
    if not document_ids:
        return

    settings = settings or get_settings()
    for document_id in document_ids:
        await dispatch_document_scan(document_id, settings=settings)

    for document_id in document_ids:
        result = await db.execute(select(UserDocument).where(UserDocument.id == document_id))
        document = result.scalar_one_or_none()
        if not document:
            continue
        if document.status == DocumentStatus.rejected:
            raise DocumentError(
                "Could not verify the uploaded file right now. Try again in a moment.",
                "scan_unavailable",
                422,
            )
        if user is not None and document.doc_type == DocumentType.profile_image:
            notify_profile_image_updated(user=user, document_id=document.id)


async def finalize_document_scan(
    db: AsyncSession,
    document_id: UUID,
    *,
    user: User | None = None,
    settings: Settings | None = None,
) -> dict[str, Any]:
    await finalize_document_scans(db, [document_id], user=user, settings=settings)
    result = await db.execute(select(UserDocument).where(UserDocument.id == document_id))
    document = result.scalar_one()
    return _document_to_dict(document)


async def upload_user_document(
    db: AsyncSession,
    *,
    user: User,
    doc_type: DocumentType,
    filename: str,
    mime_type: str,
    content: bytes,
    settings: Settings | None = None,
    ip: str | None = None,
    defer_scan: bool = False,
) -> dict[str, Any]:
    settings = settings or get_settings()

    if not content:
        raise DocumentError("Uploaded file is empty.", "empty_file", 400)

    max_bytes = max_bytes_for_doc_type(doc_type, settings)
    if len(content) > max_bytes:
        raise DocumentError("File is too large.", "file_too_large", 413)

    allowed_mimes = _ALLOWED_MIME_BY_TYPE.get(doc_type)
    if not allowed_mimes or mime_type not in allowed_mimes:
        raise DocumentError("Unsupported file type for this document.", "invalid_mime_type", 400)

    if doc_type in {DocumentType.profile_image, DocumentType.family_group_avatar}:
        if not await check_rate_limit(
            f"profile-image-upload:{user.id}",
            settings.documents_profile_image_upload_limit,
            settings.documents_profile_image_upload_window_seconds,
        ):
            raise DocumentError(
                "Too many profile photo uploads. Try again later.",
                "rate_limited",
                429,
            )

        pending = await db.execute(
            select(UserDocument.id)
            .where(
                UserDocument.user_id == user.id,
                UserDocument.doc_type.in_(
                    [DocumentType.profile_image, DocumentType.family_group_avatar]
                ),
                UserDocument.status == DocumentStatus.pending_scan,
            )
            .limit(1)
        )
        if pending.scalar_one_or_none() is not None:
            raise DocumentError(
                "An image upload is still processing. Wait for it to finish.",
                "document_processing",
                409,
            )

        try:
            content, mime_type = validate_profile_image_content(content, settings=settings)
        except DocumentError:
            raise
        except Exception as exc:
            raise DocumentError(
                "Invalid or corrupted image file.",
                "invalid_image",
                400,
            ) from exc

    try:
        extension = extension_for_mime(mime_type)
    except ValueError as exc:
        raise DocumentError("Unsupported file type.", "invalid_mime_type", 400) from exc

    safe_filename = _sanitize_filename(filename, fallback=f"{doc_type.value}{extension}")

    client_id = await assign_client_id(db, user)
    version = await _next_version(db, user_id=user.id, doc_type=doc_type)
    storage_key = build_storage_key(
        client_id=client_id,
        user_id=user.id,
        doc_type=doc_type,
        version=version,
        extension=extension,
    )
    sha256 = hashlib.sha256(content).hexdigest()
    bucket = bucket_for_doc_type(doc_type, settings)
    storage = get_document_storage(settings)
    encrypt_at_rest = is_pii_doc_type(doc_type) and settings.document_storage_provider == "local"
    storage.write_bytes(
        bucket=bucket,
        storage_key=storage_key,
        content=content,
        encrypt_at_rest=encrypt_at_rest,
    )

    document = UserDocument(
        user_id=user.id,
        client_id=client_id,
        doc_type=doc_type,
        version=version,
        original_filename=safe_filename,
        mime_type=mime_type,
        size_bytes=len(content),
        sha256=sha256,
        storage_provider=DocumentStorageProvider(settings.document_storage_provider),
        storage_bucket=bucket,
        storage_key=storage_key,
        status=DocumentStatus.pending_scan,
        kyc_review_status=KycReviewStatus.pending if is_kyc_doc_type(doc_type) else None,
    )
    db.add(document)
    await db.flush()
    await audit_document_uploaded(db, document=document, user_id=user.id, ip=ip)
    if not defer_scan:
        await dispatch_document_scan(document.id, settings=settings, db=db)
        await db.refresh(document)
        if document.status == DocumentStatus.rejected:
            raise DocumentError(
                "Could not verify the uploaded file right now. Try again in a moment.",
                "scan_unavailable",
                422,
            )
        if doc_type == DocumentType.profile_image:
            notify_profile_image_updated(user=user, document_id=document.id)
    await db.refresh(document)
    return _document_to_dict(document)


async def list_user_documents(db: AsyncSession, *, user: User) -> list[dict[str, Any]]:
    result = await db.execute(
        select(UserDocument)
        .where(UserDocument.user_id == user.id)
        .order_by(UserDocument.doc_type.asc(), UserDocument.version.desc(), UserDocument.created_at.desc())
    )
    return [_document_to_dict(document) for document in result.scalars()]


async def get_latest_document(
    db: AsyncSession,
    *,
    user: User,
    doc_type: DocumentType,
) -> dict[str, Any] | None:
    result = await db.execute(
        select(UserDocument)
        .where(UserDocument.user_id == user.id, UserDocument.doc_type == doc_type)
        .order_by(UserDocument.version.desc(), UserDocument.created_at.desc())
        .limit(1)
    )
    document = result.scalar_one_or_none()
    if not document:
        return None
    return _document_to_dict(document)


async def get_user_document(
    db: AsyncSession,
    *,
    user: User,
    document_id: UUID,
) -> dict[str, Any] | None:
    result = await db.execute(
        select(UserDocument).where(
            UserDocument.id == document_id,
            UserDocument.user_id == user.id,
        )
    )
    document = result.scalar_one_or_none()
    if not document:
        return None
    return _document_to_dict(document)
