from __future__ import annotations

from pathlib import Path
from uuid import UUID, uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.documents.client_id_service import assign_client_id
from app.application.documents.document_download_service import (
    issue_document_download,
    read_document_content_for_token,
)
from app.application.documents.document_service import upload_user_document
from app.application.documents.errors import DocumentError
from app.core.config import get_settings
from app.infrastructure.persistence.models import DocumentType, User, UserRole, UserStatus


def _png_bytes() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
        b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )


@pytest.mark.asyncio
async def test_issue_download_and_stream_content_for_owner(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    monkeypatch.setenv("API_PUBLIC_URL", "http://localhost:8000/api/v1")
    get_settings.cache_clear()
    settings = get_settings()

    user = User(
        email=f"download-{uuid4()}@example.com",
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

    download = await issue_document_download(
        db_session,
        user=user,
        document_id=UUID(str(uploaded["id"])),
    )
    assert download["expires_in"] == settings.documents_download_url_ttl_seconds
    assert str(download["download_url"]).startswith("http://localhost:8000/api/v1/documents/content/")
    assert download["mime_type"] == "image/png"

    token = str(download["download_url"]).rsplit("/", 1)[-1]
    content, mime_type, filename = await read_document_content_for_token(db_session, token=token)
    assert content == _png_bytes()
    assert mime_type == "image/png"
    assert filename == "signature.png"

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_issue_download_rejects_other_users_document(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    get_settings.cache_clear()

    owner = User(
        email=f"owner-{uuid4()}@example.com",
        phone="9876543210",
        role=UserRole.user,
        status=UserStatus.active,
    )
    other = User(
        email=f"other-{uuid4()}@example.com",
        phone="9123456780",
        role=UserRole.user,
        status=UserStatus.active,
    )
    await assign_client_id(db_session, owner)
    await assign_client_id(db_session, other)
    db_session.add_all([owner, other])
    await db_session.flush()

    uploaded = await upload_user_document(
        db_session,
        user=owner,
        doc_type=DocumentType.signature,
        filename="signature.png",
        mime_type="image/png",
        content=_png_bytes(),
    )
    await db_session.flush()

    with pytest.raises(DocumentError) as exc:
        await issue_document_download(
            db_session,
            user=other,
            document_id=UUID(str(uploaded["id"])),
        )
    assert exc.value.code == "document_not_found"

    get_settings.cache_clear()
