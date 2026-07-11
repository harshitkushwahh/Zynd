from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.audit_admin_service import list_audit_logs
from app.application.documents.client_id_service import assign_client_id
from app.application.documents.document_download_service import issue_document_download
from app.application.documents.document_scan_service import process_document_scan
from app.application.documents.document_service import upload_user_document
from app.core.config import get_settings
from app.infrastructure.persistence.models import (
    AuditEventType,
    DocumentStatus,
    DocumentStorageProvider,
    DocumentType,
    User,
    UserDocument,
    UserRole,
    UserStatus,
)
from app.infrastructure.storage.documents.factory import get_document_storage


def _png_bytes() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
        b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )


@pytest.mark.asyncio
async def test_upload_writes_document_uploaded_audit(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    get_settings.cache_clear()

    user = User(
        email=f"audit-upload-{uuid4()}@example.com",
        phone="9876543210",
        role=UserRole.user,
        status=UserStatus.active,
    )
    await assign_client_id(db_session, user)
    db_session.add(user)
    await db_session.flush()

    await upload_user_document(
        db_session,
        user=user,
        doc_type=DocumentType.signature,
        filename="signature.png",
        mime_type="image/png",
        content=_png_bytes(),
        ip="203.0.113.10",
    )
    await db_session.flush()

    logs = await list_audit_logs(
        db_session,
        user_id=user.id,
        event_type=AuditEventType.document_uploaded,
    )
    assert len(logs) >= 1
    assert logs[0]["metadata"]["doc_type"] == "signature"
    assert logs[0]["ip_address"] == "203.0.113.10"

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_scan_pass_and_fail_write_audit_events(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    get_settings.cache_clear()
    settings = get_settings()

    user = User(
        email=f"audit-scan-{uuid4()}@example.com",
        phone="9876543210",
        role=UserRole.user,
        status=UserStatus.active,
    )
    await assign_client_id(db_session, user)
    db_session.add(user)
    await db_session.flush()

    passed = UserDocument(
        user_id=user.id,
        client_id=user.client_id,
        doc_type=DocumentType.signature,
        version=1,
        original_filename="signature.png",
        mime_type="image/png",
        size_bytes=len(_png_bytes()),
        sha256="pending",
        storage_provider=DocumentStorageProvider.local,
        storage_bucket=settings.pii_documents_bucket,
        storage_key=f"{user.client_id}/signature/v1.png",
        status=DocumentStatus.pending_scan,
    )
    db_session.add(passed)
    await db_session.flush()

    storage = get_document_storage(settings)
    content = _png_bytes()
    storage.write_bytes(
        bucket=passed.storage_bucket,
        storage_key=passed.storage_key,
        content=content,
        encrypt_at_rest=True,
    )

    import hashlib

    passed.sha256 = hashlib.sha256(content).hexdigest()
    await db_session.flush()

    status = await process_document_scan(db_session, document_id=passed.id, settings=settings)
    assert status == DocumentStatus.active

    passed_logs = await list_audit_logs(
        db_session,
        user_id=user.id,
        event_type=AuditEventType.document_scan_passed,
    )
    assert len(passed_logs) >= 1

    failed = UserDocument(
        user_id=user.id,
        client_id=user.client_id,
        doc_type=DocumentType.signature,
        version=2,
        original_filename="bad.pdf",
        mime_type="application/pdf",
        size_bytes=4,
        sha256="abc",
        storage_provider=DocumentStorageProvider.local,
        storage_bucket=settings.pii_documents_bucket,
        storage_key=f"{user.client_id}/signature/v2.pdf",
        status=DocumentStatus.pending_scan,
    )
    db_session.add(failed)
    await db_session.flush()

    storage.write_bytes(
        bucket=failed.storage_bucket,
        storage_key=failed.storage_key,
        content=_png_bytes(),
        encrypt_at_rest=True,
    )

    status = await process_document_scan(db_session, document_id=failed.id, settings=settings)
    assert status == DocumentStatus.rejected

    failed_logs = await list_audit_logs(
        db_session,
        user_id=user.id,
        event_type=AuditEventType.document_scan_failed,
    )
    assert len(failed_logs) >= 1
    assert failed_logs[0]["metadata"]["reason"] == "mime_mismatch"

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_download_writes_document_download_requested_audit(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    get_settings.cache_clear()

    user = User(
        email=f"audit-dl-{uuid4()}@example.com",
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

    await issue_document_download(
        db_session,
        user=user,
        document_id=uploaded["id"],
        ip="203.0.113.20",
    )
    await db_session.flush()

    logs = await list_audit_logs(
        db_session,
        user_id=user.id,
        event_type=AuditEventType.document_download_requested,
    )
    assert len(logs) >= 1
    assert logs[0]["metadata"]["actor_type"] == "user"
    assert logs[0]["ip_address"] == "203.0.113.20"

    get_settings.cache_clear()
