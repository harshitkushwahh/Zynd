from __future__ import annotations

import hashlib
import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.documents.document_audit_service import (
    audit_document_quarantined,
    audit_document_scan_failed,
    audit_document_scan_passed,
)
from app.application.documents.document_mime_validation import mime_matches_content
from app.core.config import Settings, get_settings
from app.core.database import AsyncSessionLocal
from app.infrastructure.persistence.models import DocumentStatus, DocumentStorageProvider, UserDocument
from app.infrastructure.queue.document_scan_queue import (
    enqueue_document_scan,
    move_document_scan_to_dead_letter,
    requeue_document_scan,
)
from app.infrastructure.security.clamav_service import scan_bytes_for_malware
from app.infrastructure.storage.documents.bucket_policy import is_pii_doc_type
from app.infrastructure.storage.documents.factory import get_document_storage

logger = logging.getLogger(__name__)


def _decrypt_at_rest_for_document(document: UserDocument, settings: Settings) -> bool:
    return (
        is_pii_doc_type(document.doc_type)
        and document.storage_provider == DocumentStorageProvider.local
        and settings.documents_local_encrypt_pii
    )


def _quarantine_storage_key(storage_key: str) -> str:
    return f"quarantine/{storage_key}"


async def dispatch_document_scan(
    document_id: UUID,
    settings: Settings | None = None,
    db: AsyncSession | None = None,
) -> None:
    settings = settings or get_settings()
    if settings.document_scan_dispatch_mode == "sync":
        if db is not None:
            await process_document_scan(db, document_id=document_id, settings=settings)
            return
        async with AsyncSessionLocal() as session:
            await process_document_scan(session, document_id=document_id, settings=settings)
            await session.commit()
        return
    await enqueue_document_scan(document_id, settings=settings)


async def process_document_scan(
    db: AsyncSession,
    *,
    document_id: UUID,
    settings: Settings | None = None,
) -> DocumentStatus:
    settings = settings or get_settings()
    result = await db.execute(select(UserDocument).where(UserDocument.id == document_id))
    document = result.scalar_one_or_none()
    if not document:
        logger.warning("Document scan skipped; document missing id=%s", document_id)
        return DocumentStatus.rejected

    if document.status != DocumentStatus.pending_scan:
        return document.status

    storage = get_document_storage(settings)
    if not storage.exists(bucket=document.storage_bucket, storage_key=document.storage_key):
        document.status = DocumentStatus.rejected
        await db.flush()
        await audit_document_scan_failed(db, document=document, reason="missing_storage_object")
        return document.status

    try:
        content = storage.read_bytes(
            bucket=document.storage_bucket,
            storage_key=document.storage_key,
            decrypt_at_rest=_decrypt_at_rest_for_document(document, settings),
        )
    except Exception:
        logger.exception("Document scan failed while reading content id=%s", document_id)
        raise

    if not mime_matches_content(document.mime_type, content):
        await _reject_document(db, document=document, settings=settings, reason="mime_mismatch")
        return document.status

    if hashlib.sha256(content).hexdigest() != document.sha256:
        await _reject_document(db, document=document, settings=settings, reason="checksum_mismatch")
        return document.status

    malware_result = await scan_bytes_for_malware(content, settings)
    if malware_result.error and not malware_result.signature:
        logger.warning(
            "Document scan unavailable id=%s error=%s",
            document_id,
            malware_result.error,
        )
        await _reject_document(db, document=document, settings=settings, reason="scan_unavailable")
        return document.status

    if not malware_result.clean:
        await _quarantine_document(
            db,
            document=document,
            settings=settings,
            signature=malware_result.signature,
        )
        return document.status

    document.status = DocumentStatus.active
    await db.flush()
    await audit_document_scan_passed(db, document=document)
    return document.status


async def _reject_document(
    db: AsyncSession,
    *,
    document: UserDocument,
    settings: Settings,
    reason: str,
) -> None:
    storage = get_document_storage(settings)
    storage.delete_object(bucket=document.storage_bucket, storage_key=document.storage_key)
    document.status = DocumentStatus.rejected
    await db.flush()
    await audit_document_scan_failed(db, document=document, reason=reason)


async def _quarantine_document(
    db: AsyncSession,
    *,
    document: UserDocument,
    settings: Settings,
    signature: str | None,
) -> None:
    storage = get_document_storage(settings)
    quarantine_key = _quarantine_storage_key(document.storage_key)
    if storage.exists(bucket=document.storage_bucket, storage_key=document.storage_key):
        storage.move_object(
            bucket=document.storage_bucket,
            storage_key=document.storage_key,
            dest_key=quarantine_key,
        )
    document.storage_key = quarantine_key
    document.status = DocumentStatus.quarantined
    await db.flush()
    await audit_document_quarantined(db, document=document, signature=signature)
    logger.warning(
        "Document quarantined id=%s signature=%s bucket=%s key=%s",
        document.id,
        signature or "unknown",
        document.storage_bucket,
        quarantine_key,
    )


async def handle_failed_document_scan_job(
    *,
    raw_payload: str,
    document_id: UUID,
    attempt: int,
    reason: str,
    settings: Settings | None = None,
) -> None:
    settings = settings or get_settings()
    next_attempt = attempt + 1
    if next_attempt <= settings.documents_scan_max_attempts:
        await requeue_document_scan(document_id, attempt=next_attempt, settings=settings)
        logger.warning(
            "Document scan requeued id=%s attempt=%s reason=%s",
            document_id,
            next_attempt,
            reason,
        )
        return

    await move_document_scan_to_dead_letter(raw_payload, reason=reason, settings=settings)
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(UserDocument).where(UserDocument.id == document_id))
        document = result.scalar_one_or_none()
        if document and document.status == DocumentStatus.pending_scan:
            document.status = DocumentStatus.quarantined
            await session.commit()
    logger.error("Document scan moved to dead letter id=%s reason=%s", document_id, reason)
