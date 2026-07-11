from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.documents.client_id_service import assign_client_id
from app.application.documents.document_scan_service import process_document_scan
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
from app.infrastructure.security.clamav_service import ClamavScanResult
from app.infrastructure.storage.documents.factory import get_document_storage


def _png_bytes() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
        b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )


@pytest.mark.asyncio
async def test_process_document_scan_quarantines_infected_file(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    monkeypatch.setenv("CLAMAV_ENABLED", "true")
    get_settings.cache_clear()
    settings = get_settings()

    user = User(
        email=f"malware-{uuid4()}@example.com",
        phone="9876543210",
        role=UserRole.user,
        status=UserStatus.active,
    )
    await assign_client_id(db_session, user)
    db_session.add(user)
    await db_session.flush()

    import hashlib

    content = _png_bytes()
    storage_key = f"{user.client_id}/signature/signature_{user.client_id}_v1.png"
    document = UserDocument(
        user_id=user.id,
        client_id=user.client_id,
        doc_type=DocumentType.signature,
        version=1,
        original_filename="signature.png",
        mime_type="image/png",
        size_bytes=len(content),
        sha256=hashlib.sha256(content).hexdigest(),
        storage_provider=DocumentStorageProvider.local,
        storage_bucket=settings.pii_documents_bucket,
        storage_key=storage_key,
        status=DocumentStatus.pending_scan,
    )
    db_session.add(document)
    await db_session.flush()

    storage = get_document_storage(settings)
    storage.write_bytes(
        bucket=document.storage_bucket,
        storage_key=document.storage_key,
        content=content,
        encrypt_at_rest=True,
    )

    with patch(
        "app.application.documents.document_scan_service.scan_bytes_for_malware",
        new=AsyncMock(
            return_value=ClamavScanResult(clean=False, signature="Eicar-Test-Signature"),
        ),
    ):
        status = await process_document_scan(db_session, document_id=document.id, settings=settings)

    assert status == DocumentStatus.quarantined

    refreshed = await db_session.execute(select(UserDocument).where(UserDocument.id == document.id))
    row = refreshed.scalar_one()
    assert row.status == DocumentStatus.quarantined
    assert row.storage_key.startswith("quarantine/")
    assert not storage.exists(bucket=row.storage_bucket, storage_key=storage_key)
    assert storage.exists(bucket=row.storage_bucket, storage_key=row.storage_key)

    get_settings.cache_clear()
