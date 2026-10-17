"""Store a customer ticket image under their Zynd id and the ticket id."""

from __future__ import annotations

import hashlib
import logging
import os
import re
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.documents.client_id_service import assign_client_id
from app.application.documents.document_audit_service import audit_document_uploaded
from app.application.documents.document_mime_validation import mime_matches_content
from app.application.documents.document_storage_service import extension_for_mime
from app.application.support.ticket_service import SupportActionError
from app.core.config import Settings, get_settings
from app.infrastructure.persistence.models import (
    DocumentStatus,
    DocumentStorageProvider,
    DocumentType,
    User,
    UserDocument,
)
from app.infrastructure.persistence.support_models import SupportMessage, SupportTicket
from app.infrastructure.security.clamav_service import scan_bytes_for_malware
from app.infrastructure.storage.documents.bucket_policy import bucket_for_doc_type, is_pii_doc_type
from app.infrastructure.storage.documents.factory import get_document_storage

logger = logging.getLogger(__name__)

MAX_TICKET_IMAGE_BYTES = 5 * 1024 * 1024
_SAFE_FILENAME_PATTERN = re.compile(r"[^A-Za-z0-9._-]+")


def sniff_image_mime(content: bytes) -> str | None:
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    return None


def _sanitize_filename(filename: str, extension: str) -> str:
    base = os.path.basename(filename or "").strip()
    cleaned = _SAFE_FILENAME_PATTERN.sub("_", base).strip("._")
    if not cleaned:
        cleaned = f"image{extension}"
    if not cleaned.lower().endswith(extension):
        stem = cleaned.rsplit(".", 1)[0]
        cleaned = f"{stem}{extension}"
    return cleaned[:120]


async def store_ticket_image(
    db: AsyncSession,
    user: User,
    ticket: SupportTicket,
    *,
    filename: str,
    content: bytes,
    settings: Settings | None = None,
) -> UserDocument:
    """Save the image in `{zynd client id}/{ticket id}/` and attach it to the customer."""
    settings = settings or get_settings()
    if not content:
        raise SupportActionError("empty_file", "Uploaded file is empty.")
    if len(content) > MAX_TICKET_IMAGE_BYTES:
        raise SupportActionError("file_too_large", "Image must be 5 MB or smaller.", 413)

    mime_type = sniff_image_mime(content)
    if mime_type is None or not mime_matches_content(mime_type, content):
        raise SupportActionError("invalid_image", "Upload a PNG, JPG, or WebP image.")

    scan = await scan_bytes_for_malware(content, settings)
    if scan.signature:
        raise SupportActionError("file_rejected", "This image could not be accepted.")
    if scan.error:
        logger.warning("Ticket image stored without a completed malware scan: %s", scan.error)

    extension = extension_for_mime(mime_type)
    safe_name = _sanitize_filename(filename, extension)
    client_id = await assign_client_id(db, user)
    version_result = await db.execute(
        select(func.max(UserDocument.version)).where(
            UserDocument.user_id == user.id,
            UserDocument.doc_type == DocumentType.support_attachment,
        )
    )
    version = (version_result.scalar_one_or_none() or 0) + 1
    stem = safe_name[: -len(extension)] if safe_name.lower().endswith(extension) else safe_name
    stored_name = f"{stem}_v{version}{extension}"
    storage_key = f"{client_id}/{ticket.public_id}/{stored_name}"
    bucket = bucket_for_doc_type(DocumentType.support_attachment, settings)
    storage = get_document_storage(settings)
    encrypt_at_rest = is_pii_doc_type(DocumentType.support_attachment) and settings.document_storage_provider == "local"
    storage.write_bytes(
        bucket=bucket,
        storage_key=storage_key,
        content=content,
        encrypt_at_rest=encrypt_at_rest,
    )
    document = UserDocument(
        user_id=user.id,
        client_id=client_id,
        doc_type=DocumentType.support_attachment,
        version=version,
        original_filename=stored_name,
        mime_type=mime_type,
        size_bytes=len(content),
        sha256=hashlib.sha256(content).hexdigest(),
        storage_provider=DocumentStorageProvider(settings.document_storage_provider),
        storage_bucket=bucket,
        storage_key=storage_key,
        status=DocumentStatus.active,
    )
    db.add(document)
    await db.flush()
    await audit_document_uploaded(db, document=document, user_id=user.id, ip=None)
    return document


async def read_message_attachment(
    db: AsyncSession,
    *,
    message_id: UUID,
    actor: User,
    as_agent: bool,
) -> tuple[bytes, str, str]:
    message = await db.get(SupportMessage, message_id)
    if message is None or message.attachment_document_id is None:
        raise SupportActionError("attachment_not_found", "Attachment not found.", 404)
    document = await db.get(UserDocument, message.attachment_document_id)
    if document is None or document.status == DocumentStatus.rejected:
        raise SupportActionError("attachment_not_found", "Attachment not found.", 404)
    if not as_agent and document.user_id != actor.id:
        raise SupportActionError("attachment_not_found", "Attachment not found.", 404)

    settings = get_settings()
    storage = get_document_storage(settings)
    decrypt = (
        is_pii_doc_type(document.doc_type)
        and document.storage_provider == DocumentStorageProvider.local
        and settings.documents_local_encrypt_pii
    )
    if not storage.exists(bucket=document.storage_bucket, storage_key=document.storage_key):
        raise SupportActionError("attachment_not_found", "Attachment not found.", 404)
    content = storage.read_bytes(
        bucket=document.storage_bucket,
        storage_key=document.storage_key,
        decrypt_at_rest=decrypt,
    )
    return content, document.mime_type, document.original_filename
