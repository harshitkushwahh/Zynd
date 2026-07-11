from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.documents.client_id_service import assign_client_id
from app.application.documents.document_service import (
    get_latest_document,
    list_user_documents,
    upload_user_document,
)
from app.core.config import get_settings
from app.infrastructure.persistence.models import DocumentType, User, UserRole, UserStatus
from app.infrastructure.storage.documents.factory import get_document_storage
from app.infrastructure.storage.documents.local_backend import LocalDocumentStorageBackend


def _png_bytes() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
        b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )


@pytest.mark.asyncio
async def test_upload_list_and_latest_document(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    get_settings.cache_clear()
    settings = get_settings()

    user = User(
        email=f"docs-{uuid4()}@example.com",
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
    await db_session.flush()

    assert uploaded["doc_type"] == "signature"
    assert uploaded["version"] == 1
    assert uploaded["client_id"] == user.client_id

    storage = get_document_storage(settings)
    assert isinstance(storage, LocalDocumentStorageBackend)
    assert storage.exists(
        bucket=settings.pii_documents_bucket,
        storage_key=uploaded["storage_key"],
    )
    assert storage.absolute_path(
        bucket=settings.pii_documents_bucket,
        storage_key=uploaded["storage_key"],
    ).is_file()

    documents = await list_user_documents(db_session, user=user)
    assert len(documents) == 1

    latest = await get_latest_document(db_session, user=user, doc_type=DocumentType.signature)
    assert latest is not None
    assert latest["id"] == uploaded["id"]

    second = await upload_user_document(
        db_session,
        user=user,
        doc_type=DocumentType.signature,
        filename="signature-v2.png",
        mime_type="image/png",
        content=_png_bytes(),
    )
    assert second["version"] == 2

    latest_after = await get_latest_document(db_session, user=user, doc_type=DocumentType.signature)
    assert latest_after is not None
    assert latest_after["version"] == 2

    get_settings.cache_clear()
