from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.documents.client_id_service import assign_client_id
from app.application.documents.document_service import upload_user_document
from app.infrastructure.persistence.models import DocumentType, User, UserDocument, UserRole, UserStatus
from app.infrastructure.storage.documents.at_rest_encryption import (
    decrypt_document_blob,
    encrypt_document_blob,
)
from app.infrastructure.storage.documents.bucket_policy import bucket_for_doc_type, is_pii_doc_type
from app.infrastructure.storage.documents.factory import get_document_storage
from app.infrastructure.storage.documents.local_backend import LocalDocumentStorageBackend
from tests.document_image_fixtures import profile_image_png_bytes


def _png_bytes() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
        b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def test_bucket_policy_routes_profile_image_to_public_bucket() -> None:
    from app.core.config import get_settings

    settings = get_settings()
    assert bucket_for_doc_type(DocumentType.profile_image, settings) == settings.public_assets_bucket
    assert bucket_for_doc_type(DocumentType.signature, settings) == settings.pii_documents_bucket
    assert is_pii_doc_type(DocumentType.profile_image) is False
    assert is_pii_doc_type(DocumentType.aadhaar) is True


def test_local_pii_encryption_roundtrip() -> None:
    original = _png_bytes()
    encrypted = encrypt_document_blob(original)
    assert encrypted != original
    assert decrypt_document_blob(encrypted) == original


@pytest.mark.asyncio
async def test_upload_routes_signature_to_pii_bucket_encrypted(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    monkeypatch.setenv("DOCUMENT_STORAGE_PROVIDER", "local")
    from app.core.config import get_settings

    get_settings.cache_clear()
    settings = get_settings()

    user = User(
        email=f"pii-{uuid4()}@example.com",
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

    pii_bucket = settings.pii_documents_bucket
    storage = get_document_storage(settings)
    assert isinstance(storage, LocalDocumentStorageBackend)
    assert storage.exists(bucket=pii_bucket, storage_key=uploaded["storage_key"])

    raw_bytes = storage.absolute_path(bucket=pii_bucket, storage_key=uploaded["storage_key"]).read_bytes()
    assert not raw_bytes.startswith(b"\x89PNG")
    assert decrypt_document_blob(raw_bytes) == _png_bytes()

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_upload_routes_profile_image_to_public_bucket_plaintext(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    monkeypatch.setenv("DOCUMENT_STORAGE_PROVIDER", "local")
    from app.core.config import get_settings

    get_settings.cache_clear()
    settings = get_settings()

    user = User(
        email=f"public-{uuid4()}@example.com",
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
        doc_type=DocumentType.profile_image,
        filename="avatar.png",
        mime_type="image/png",
        content=profile_image_png_bytes(),
    )
    await db_session.flush()

    public_bucket = settings.public_assets_bucket
    storage = get_document_storage(settings)
    assert isinstance(storage, LocalDocumentStorageBackend)
    row = await db_session.get(UserDocument, uploaded["id"])
    assert row is not None
    assert storage.exists(bucket=public_bucket, storage_key=row.storage_key)

    raw_bytes = storage.absolute_path(bucket=public_bucket, storage_key=row.storage_key).read_bytes()
    assert raw_bytes.startswith(b"\xff\xd8\xff")

    get_settings.cache_clear()
