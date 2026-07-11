from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.documents.client_id_service import assign_client_id
from app.application.documents.document_image_validation import validate_profile_image_content
from app.application.documents.document_service import upload_user_document
from app.application.documents.errors import DocumentError
from app.core.config import get_settings
from app.infrastructure.persistence.models import DocumentType, User, UserRole, UserStatus


def _png_bytes(width: int = 256, height: int = 256) -> bytes:
    try:
        from PIL import Image
        from io import BytesIO

        image = Image.new("RGB", (width, height), color=(120, 160, 200))
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        return buffer.getvalue()
    except ImportError:
        return (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
            b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
            b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
        )


@pytest.mark.asyncio
async def test_profile_image_upload_normalizes_to_jpeg(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    monkeypatch.setenv("DOCUMENT_SCAN_DISPATCH_MODE", "sync")
    get_settings.cache_clear()

    user = User(
        email=f"avatar-{uuid4()}@example.com",
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
        content=_png_bytes(),
    )

    assert uploaded["mime_type"] == "image/jpeg"
    assert uploaded["status"] == "active"
    assert uploaded["size_bytes"] <= get_settings().documents_profile_image_max_bytes

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_profile_image_rejects_tiny_image(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    get_settings.cache_clear()
    settings = get_settings()

    user = User(
        email=f"tiny-{uuid4()}@example.com",
        phone="9876543210",
        role=UserRole.user,
        status=UserStatus.active,
    )
    await assign_client_id(db_session, user)
    db_session.add(user)
    await db_session.flush()

    with pytest.raises(DocumentError) as exc:
        await upload_user_document(
            db_session,
            user=user,
            doc_type=DocumentType.profile_image,
            filename="tiny.png",
            mime_type="image/png",
            content=_png_bytes(width=32, height=32),
        )
    assert exc.value.code == "image_too_small"

    get_settings.cache_clear()


def test_validate_profile_image_content_returns_jpeg() -> None:
    normalized, mime_type = validate_profile_image_content(_png_bytes())
    assert mime_type == "image/jpeg"
    assert normalized.startswith(b"\xff\xd8\xff")
