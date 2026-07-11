from __future__ import annotations

from pathlib import Path
from uuid import UUID, uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.documents.client_id_service import assign_client_id
from app.application.documents.document_cdn_service import (
    build_cdn_asset_url,
    is_cdn_eligible_document,
)
from app.application.documents.document_download_service import (
    issue_document_download,
    read_public_document_content,
)
from app.application.documents.document_storage_service import build_storage_key
from app.application.documents.document_service import upload_user_document
from app.application.documents.errors import DocumentError
from app.core.config import get_settings
from app.infrastructure.persistence.models import DocumentType, User, UserDocument, UserRole, UserStatus
from tests.document_image_fixtures import profile_image_png_bytes


def _png_bytes() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
        b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )


@pytest.mark.asyncio
async def test_profile_image_uses_opaque_avatar_storage_key() -> None:
    user_id = uuid4()
    key = build_storage_key(
        client_id="ignored@zynd",
        user_id=user_id,
        doc_type=DocumentType.profile_image,
        version=2,
        extension=".png",
    )
    assert key == f"public/avatars/{user_id}/v2.png"


@pytest.mark.asyncio
async def test_profile_image_gets_cdn_url_when_configured(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    monkeypatch.setenv("DOCUMENT_SCAN_DISPATCH_MODE", "sync")
    monkeypatch.setenv(
        "DOCUMENTS_CDN_BASE_URL",
        "http://localhost:8000/api/v1/documents/public",
    )
    get_settings.cache_clear()

    user = User(
        email=f"cdn-{uuid4()}@example.com",
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
    assert uploaded["mime_type"] == "image/jpeg"
    assert uploaded["status"] == "active"

    row = await db_session.get(UserDocument, uploaded["id"])
    assert row is not None
    assert is_cdn_eligible_document(row)

    download = await issue_document_download(
        db_session,
        user=user,
        document_id=UUID(str(uploaded["id"])),
    )
    assert download["delivery"] == "cdn"
    assert str(download["download_url"]).startswith("http://localhost:8000/api/v1/documents/public/")
    assert "v=1" in str(download["download_url"])
    assert download["cache_max_age"] == get_settings().documents_public_cache_max_age_seconds

    content, mime_type, _, cache_max_age = await read_public_document_content(
        db_session,
        document_id=UUID(str(uploaded["id"])),
    )
    assert content.startswith(b"\xff\xd8\xff")
    assert mime_type == "image/jpeg"
    assert cache_max_age > 0

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_pii_document_never_gets_cdn_url(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    monkeypatch.setenv(
        "DOCUMENTS_CDN_BASE_URL",
        "https://cdn.example.com",
    )
    monkeypatch.setenv("API_PUBLIC_URL", "http://localhost:8000/api/v1")
    get_settings.cache_clear()

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
        doc_type=DocumentType.pan,
        filename="pan.png",
        mime_type="image/png",
        content=_png_bytes(),
    )

    download = await issue_document_download(
        db_session,
        user=user,
        document_id=UUID(str(uploaded["id"])),
    )
    assert download["delivery"] == "signed"
    assert "cdn.example.com" not in str(download["download_url"])
    assert "/documents/content/" in str(download["download_url"])

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_public_route_rejects_pii_document(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    get_settings.cache_clear()

    user = User(
        email=f"reject-{uuid4()}@example.com",
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

    with pytest.raises(DocumentError) as exc:
        await read_public_document_content(
            db_session,
            document_id=UUID(str(uploaded["id"])),
        )
    assert exc.value.code == "document_cdn_forbidden"

    get_settings.cache_clear()


def test_external_cdn_url_uses_storage_key_path(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DOCUMENTS_CDN_BASE_URL", "https://cdn.zynd.app")
    get_settings.cache_clear()
    settings = get_settings()

    from app.infrastructure.persistence.models import (
        DocumentStatus,
        DocumentStorageProvider,
        UserDocument,
    )

    document = UserDocument(
        user_id=uuid4(),
        client_id="client@zynd",
        doc_type=DocumentType.profile_image,
        version=3,
        original_filename="avatar.png",
        mime_type="image/png",
        size_bytes=10,
        sha256="abc",
        storage_provider=DocumentStorageProvider.local,
        storage_bucket=settings.public_assets_bucket,
        storage_key="public/avatars/some-user/v3.png",
        status=DocumentStatus.active,
    )

    url = build_cdn_asset_url(document, settings)
    assert url == "https://cdn.zynd.app/public/avatars/some-user/v3.png?v=3"

    get_settings.cache_clear()
