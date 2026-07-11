from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.documents.client_id_service import assign_client_id
from app.application.documents.document_scan_service import process_document_scan
from app.application.documents.document_service import upload_user_document
from app.core.config import get_settings
from app.infrastructure.persistence.models import (
    DocumentStatus,
    DocumentStorageProvider,
    DocumentType,
    User,
    UserDocument,
    UserRole,
    UserStatus,
)
from app.infrastructure.queue.document_scan_queue import enqueue_document_scan, pop_document_scan_job
from app.infrastructure.storage.documents.factory import get_document_storage


def _png_bytes() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
        b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )


@pytest.mark.asyncio
async def test_upload_sets_pending_scan_then_sync_scan_activates(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    get_settings.cache_clear()

    user = User(
        email=f"scan-{uuid4()}@example.com",
        phone="9876543210",
        role=UserRole.user,
        status=UserStatus.active,
    )
    await assign_client_id(db_session, user)
    db_session.add(user)
    await db_session.flush()

    uploaded = await upload_user_document(
        db_session,
        user=user,
        doc_type=DocumentType.signature,
        filename="signature.png",
        mime_type="image/png",
        content=_png_bytes(),
    )
    assert uploaded["status"] == "active"

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_async_enqueue_and_process_document_scan(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    fake_redis: dict[str, str],
) -> None:
    _ = fake_redis
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    monkeypatch.setenv("DOCUMENT_SCAN_DISPATCH_MODE", "async")
    get_settings.cache_clear()
    settings = get_settings()

    user = User(
        email=f"queue-{uuid4()}@example.com",
        phone="9876543210",
        role=UserRole.user,
        status=UserStatus.active,
    )
    await assign_client_id(db_session, user)
    db_session.add(user)
    await db_session.flush()

    document = UserDocument(
        user_id=user.id,
        client_id=user.client_id,
        doc_type=DocumentType.signature,
        version=1,
        original_filename="signature.png",
        mime_type="image/png",
        size_bytes=len(_png_bytes()),
        sha256="invalid-for-test",
        storage_provider=DocumentStorageProvider.local,
        storage_bucket=settings.pii_documents_bucket,
        storage_key=f"{user.client_id}/signature/test.png",
        status=DocumentStatus.pending_scan,
    )
    db_session.add(document)
    await db_session.flush()

    storage = get_document_storage(settings)
    storage.write_bytes(
        bucket=document.storage_bucket,
        storage_key=document.storage_key,
        content=_png_bytes(),
        encrypt_at_rest=True,
    )

    import hashlib

    document.sha256 = hashlib.sha256(_png_bytes()).hexdigest()
    await db_session.flush()

    await enqueue_document_scan(document.id, settings=settings)
    job = await pop_document_scan_job(block_seconds=1, settings=settings)
    assert job is not None
    _, payload = job
    assert payload["document_id"] == str(document.id)

    status = await process_document_scan(db_session, document_id=document.id, settings=settings)
    assert status == DocumentStatus.active

    refreshed = await db_session.execute(
        select(UserDocument).where(UserDocument.id == document.id)
    )
    assert refreshed.scalar_one().status == DocumentStatus.active

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_process_document_scan_rejects_invalid_mime(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    get_settings.cache_clear()
    settings = get_settings()

    user = User(
        email=f"reject-{uuid4()}@example.com",
        phone="9876543210",
        role=UserRole.user,
        status=UserStatus.active,
    )
    await assign_client_id(db_session, user)
    db_session.add(user)
    await db_session.flush()

    document = UserDocument(
        user_id=user.id,
        client_id=user.client_id,
        doc_type=DocumentType.signature,
        version=1,
        original_filename="signature.pdf",
        mime_type="application/pdf",
        size_bytes=4,
        sha256="abc",
        storage_provider=DocumentStorageProvider.local,
        storage_bucket=settings.pii_documents_bucket,
        storage_key=f"{user.client_id}/signature/bad.pdf",
        status=DocumentStatus.pending_scan,
    )
    db_session.add(document)
    await db_session.flush()

    storage = get_document_storage(settings)
    storage.write_bytes(
        bucket=document.storage_bucket,
        storage_key=document.storage_key,
        content=_png_bytes(),
        encrypt_at_rest=True,
    )

    status = await process_document_scan(db_session, document_id=document.id, settings=settings)
    assert status == DocumentStatus.rejected

    get_settings.cache_clear()
