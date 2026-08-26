from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.document_admin_service import get_document_admin, list_documents_for_user_admin
from app.application.admin.rbac_service import (
    assign_role_to_admin_user,
    ensure_rbac_seed,
    get_user_permission_keys,
    revoke_role_from_admin_user,
    user_has_permission,
)
from app.application.documents.client_id_service import assign_client_id
from app.application.documents.document_download_service import issue_admin_document_download
from app.application.documents.document_service import upload_user_document
from app.core.config import get_settings
from app.infrastructure.persistence.models import DocumentType, User, UserRole, UserStatus


def _png_bytes() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
        b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )


@pytest.mark.asyncio
async def test_mitra_lacks_document_permissions(db_session: AsyncSession) -> None:
    admin = User(
        email=f"mitra-docs-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(admin)
    await db_session.flush()
    await ensure_rbac_seed(db_session)

    await assign_role_to_admin_user(db_session, user_id=admin.id, role_key="mitra")
    await revoke_role_from_admin_user(db_session, user_id=admin.id, role_key="super_admin")

    permissions = await get_user_permission_keys(db_session, admin.id)
    assert "documents.read" not in permissions
    assert "documents.download" not in permissions
    assert not await user_has_permission(db_session, admin.id, "documents.read")
    assert not await user_has_permission(db_session, admin.id, "documents.download")


@pytest.mark.asyncio
async def test_super_admin_can_download_documents(db_session: AsyncSession) -> None:
    admin = User(
        email=f"sa-docs-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(admin)
    await db_session.flush()
    await ensure_rbac_seed(db_session)

    assert await user_has_permission(db_session, admin.id, "documents.read")
    assert await user_has_permission(db_session, admin.id, "documents.download")


@pytest.mark.asyncio
async def test_admin_document_metadata_and_download(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    get_settings.cache_clear()

    user = User(
        email=f"admin-docs-{uuid4()}@example.com",
        phone="9876543210",
        role=UserRole.user,
        status=UserStatus.active,
    )
    await assign_client_id(db_session, user)
    db_session.add(user)
    await db_session.flush()

    compliance = User(
        email=f"reviewer-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(compliance)
    await db_session.flush()
    await ensure_rbac_seed(db_session)

    uploaded = await upload_user_document(
        db_session,
        user=user,
        doc_type=DocumentType.signature,
        filename="signature.png",
        mime_type="image/png",
        content=_png_bytes(),
    )
    assert uploaded["status"] == "active"

    listed = await list_documents_for_user_admin(db_session, user_id=user.id)
    assert len(listed) == 1
    assert listed[0]["id"] == uploaded["id"]
    assert "storage_key" not in listed[0]

    metadata = await get_document_admin(db_session, document_id=uploaded["id"])
    assert metadata is not None
    assert metadata["user_id"] == user.id
    assert "storage_key" not in metadata

    payload = await issue_admin_document_download(
        db_session,
        admin=compliance,
        document_id=uploaded["id"],
        ip="127.0.0.1",
    )
    assert payload["download_url"]
    assert payload["mime_type"] == "image/png"

    get_settings.cache_clear()
