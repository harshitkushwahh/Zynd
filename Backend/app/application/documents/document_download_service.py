from __future__ import annotations

from uuid import UUID

import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.documents.document_audit_service import audit_document_download_requested
from app.application.documents.document_cdn_service import cdn_delivery_payload, is_cdn_eligible_document
from app.application.documents.errors import DocumentError
from app.core.config import Settings, get_settings
from app.infrastructure.persistence.models import DocumentStatus, DocumentStorageProvider, User, UserDocument
from app.infrastructure.security.document_download_tokens import (
    create_document_download_token,
    decode_document_download_token,
)
from app.infrastructure.storage.documents.bucket_policy import is_pii_doc_type
from app.infrastructure.storage.documents.factory import get_document_storage
from app.infrastructure.storage.documents.s3_backend import S3DocumentStorageBackend


async def _get_owned_document(
    db: AsyncSession,
    *,
    user_id: UUID,
    document_id: UUID,
) -> UserDocument:
    result = await db.execute(
        select(UserDocument).where(
            UserDocument.id == document_id,
            UserDocument.user_id == user_id,
        )
    )
    document = result.scalar_one_or_none()
    if not document:
        raise DocumentError("Document not found.", "document_not_found", 404)
    return document


def _decrypt_at_rest_for_document(document: UserDocument, settings: Settings) -> bool:
    return (
        is_pii_doc_type(document.doc_type)
        and document.storage_provider == DocumentStorageProvider.local
        and settings.documents_local_encrypt_pii
    )


async def issue_document_download(
    db: AsyncSession,
    *,
    user: User,
    document_id: UUID,
    settings: Settings | None = None,
    ip: str | None = None,
) -> dict[str, object]:
    settings = settings or get_settings()
    document = await _get_owned_document(db, user_id=user.id, document_id=document_id)

    if document.status != DocumentStatus.active:
        raise DocumentError("Document is not available for download.", "document_unavailable", 409)

    storage = get_document_storage(settings)
    if not storage.exists(bucket=document.storage_bucket, storage_key=document.storage_key):
        raise DocumentError("Document file is missing.", "document_missing", 404)

    cdn_payload = cdn_delivery_payload(document, settings)
    if cdn_payload:
        await audit_document_download_requested(
            db,
            document=document,
            actor_user_id=user.id,
            ip=ip,
            actor_type="user",
        )
        return cdn_payload

    if settings.document_storage_provider == "s3":
        if not isinstance(storage, S3DocumentStorageBackend):
            raise DocumentError("Document storage is misconfigured.", "storage_misconfigured", 500)
        expires_in = settings.documents_download_url_ttl_seconds
        download_url = storage.generate_presigned_download_url(
            bucket=document.storage_bucket,
            storage_key=document.storage_key,
            expires_in=expires_in,
            mime_type=document.mime_type,
            filename=document.original_filename,
        )
    else:
        token, expires_in = create_document_download_token(
            document_id=document.id,
            user_id=user.id,
            settings=settings,
        )
        download_url = f"{settings.resolved_api_public_url}/documents/content/{token}"

    await audit_document_download_requested(
        db,
        document=document,
        actor_user_id=user.id,
        ip=ip,
        actor_type="user",
    )

    return {
        "download_url": download_url,
        "expires_in": expires_in,
        "mime_type": document.mime_type,
        "filename": document.original_filename,
        "delivery": "signed",
    }


async def read_document_content_for_token(
    db: AsyncSession,
    *,
    token: str,
    settings: Settings | None = None,
) -> tuple[bytes, str, str]:
    settings = settings or get_settings()

    try:
        payload = decode_document_download_token(token, settings)
        document_id = UUID(payload["doc_id"])
        user_id = UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise DocumentError("Download link is invalid or expired.", "download_expired", 401) from exc

    result = await db.execute(
        select(UserDocument).where(
            UserDocument.id == document_id,
            UserDocument.user_id == user_id,
        )
    )
    document = result.scalar_one_or_none()
    if not document:
        raise DocumentError("Document not found.", "document_not_found", 404)

    if document.status != DocumentStatus.active:
        raise DocumentError("Document is not available for download.", "document_unavailable", 409)

    storage = get_document_storage(settings)
    if not storage.exists(bucket=document.storage_bucket, storage_key=document.storage_key):
        raise DocumentError("Document file is missing.", "document_missing", 404)

    content = storage.read_bytes(
        bucket=document.storage_bucket,
        storage_key=document.storage_key,
        decrypt_at_rest=_decrypt_at_rest_for_document(document, settings),
    )
    return content, document.mime_type, document.original_filename


async def read_public_document_content(
    db: AsyncSession,
    *,
    document_id: UUID,
    settings: Settings | None = None,
) -> tuple[bytes, str, str, int]:
    settings = settings or get_settings()
    document = await _get_document_by_id(db, document_id=document_id)

    if not is_cdn_eligible_document(document, settings):
        raise DocumentError(
            "This document cannot be served from the public CDN.",
            "document_cdn_forbidden",
            403,
        )

    storage = get_document_storage(settings)
    if not storage.exists(bucket=document.storage_bucket, storage_key=document.storage_key):
        raise DocumentError("Document file is missing.", "document_missing", 404)

    content = storage.read_bytes(
        bucket=document.storage_bucket,
        storage_key=document.storage_key,
        decrypt_at_rest=False,
    )
    return (
        content,
        document.mime_type,
        document.original_filename,
        settings.documents_public_cache_max_age_seconds,
    )


async def _get_document_by_id(
    db: AsyncSession,
    *,
    document_id: UUID,
) -> UserDocument:
    result = await db.execute(select(UserDocument).where(UserDocument.id == document_id))
    document = result.scalar_one_or_none()
    if not document:
        raise DocumentError("Document not found.", "document_not_found", 404)
    return document


_ADMIN_DOWNLOADABLE_STATUSES = {DocumentStatus.active, DocumentStatus.quarantined}


async def issue_admin_document_download(
    db: AsyncSession,
    *,
    admin: User,
    document_id: UUID,
    settings: Settings | None = None,
    ip: str | None = None,
) -> dict[str, object]:
    settings = settings or get_settings()
    document = await _get_document_by_id(db, document_id=document_id)

    if document.status not in _ADMIN_DOWNLOADABLE_STATUSES:
        raise DocumentError("Document is not available for download.", "document_unavailable", 409)

    storage = get_document_storage(settings)
    if not storage.exists(bucket=document.storage_bucket, storage_key=document.storage_key):
        raise DocumentError("Document file is missing.", "document_missing", 404)

    if settings.document_storage_provider == "s3":
        if not isinstance(storage, S3DocumentStorageBackend):
            raise DocumentError("Document storage is misconfigured.", "storage_misconfigured", 500)
        expires_in = settings.documents_download_url_ttl_seconds
        download_url = storage.generate_presigned_download_url(
            bucket=document.storage_bucket,
            storage_key=document.storage_key,
            expires_in=expires_in,
            mime_type=document.mime_type,
            filename=document.original_filename,
        )
    else:
        token, expires_in = create_document_download_token(
            document_id=document.id,
            user_id=document.user_id,
            settings=settings,
        )
        download_url = f"{settings.resolved_api_public_url}/documents/content/{token}"

    await audit_document_download_requested(
        db,
        document=document,
        actor_user_id=admin.id,
        ip=ip,
        actor_type="admin",
    )

    return {
        "download_url": download_url,
        "expires_in": expires_in,
        "mime_type": document.mime_type,
        "filename": document.original_filename,
        "delivery": "signed",
    }
