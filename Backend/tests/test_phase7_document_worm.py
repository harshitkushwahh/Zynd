from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.audit_admin_service import list_audit_logs
from app.application.admin.rbac_service import (
    assign_role_to_admin_user,
    ensure_rbac_seed,
    revoke_role_from_admin_user,
    user_has_permission,
)
from app.application.compliance.retention_service import ensure_retention_seed
from app.application.documents.client_id_service import assign_client_id
from app.application.documents.document_worm_policy import user_may_delete_document
from app.application.documents.document_worm_service import (
    delete_document_admin,
    set_document_legal_hold,
    verify_document,
    verify_user_kyc_documents,
)
from app.application.documents.document_service import get_latest_document, upload_user_document
from app.application.documents.errors import DocumentError
from app.core.config import get_settings
from app.infrastructure.persistence.models import (
    AuditEventType,
    DocumentType,
    User,
    UserDocument,
    UserRole,
    UserStatus,
)
from app.infrastructure.storage.documents.factory import get_document_storage
from app.infrastructure.storage.documents.local_backend import LocalDocumentStorageBackend


def _png_bytes() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
        b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )


@pytest.mark.asyncio
async def test_verify_makes_document_immutable_and_applies_local_worm_marker(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    get_settings.cache_clear()
    settings = get_settings()

    user = User(
        email=f"worm-{uuid4()}@example.com",
        phone="9876543210",
        role=UserRole.user,
        status=UserStatus.active,
    )
    await assign_client_id(db_session, user)
    db_session.add(user)
    await db_session.flush()
    await ensure_retention_seed(db_session)

    admin = User(
        email=f"worm-admin-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(admin)
    await db_session.flush()

    uploaded = await upload_user_document(
        db_session,
        user=user,
        doc_type=DocumentType.pan,
        filename="pan.png",
        mime_type="image/png",
        content=_png_bytes(),
    )
    assert uploaded["status"] == "active"

    result = await verify_document(
        db_session,
        document_id=uploaded["id"],
        admin=admin,
        ip="127.0.0.1",
    )
    assert result["immutable_at"] is not None
    assert result["legal_hold"] is False

    row = await db_session.execute(select(UserDocument).where(UserDocument.id == uploaded["id"]))
    document = row.scalar_one()
    storage = get_document_storage(settings)
    assert isinstance(storage, LocalDocumentStorageBackend)
    assert storage._is_worm_locked(bucket=document.storage_bucket, storage_key=document.storage_key)

    logs = await list_audit_logs(
        db_session,
        user_id=user.id,
        event_type=AuditEventType.document_verified,
    )
    assert len(logs) >= 1

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_new_upload_after_verify_creates_new_version_without_removing_v1(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    get_settings.cache_clear()
    settings = get_settings()

    user = User(
        email=f"worm-v2-{uuid4()}@example.com",
        phone="9876543210",
        role=UserRole.user,
        status=UserStatus.active,
    )
    await assign_client_id(db_session, user)
    db_session.add(user)
    await db_session.flush()

    admin = User(
        email=f"worm-v2-admin-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(admin)
    await db_session.flush()

    first = await upload_user_document(
        db_session,
        user=user,
        doc_type=DocumentType.pan,
        filename="pan-v1.png",
        mime_type="image/png",
        content=_png_bytes(),
    )
    await verify_document(db_session, document_id=first["id"], admin=admin, ip="127.0.0.1")

    second = await upload_user_document(
        db_session,
        user=user,
        doc_type=DocumentType.pan,
        filename="pan-v2.png",
        mime_type="image/png",
        content=_png_bytes(),
    )
    assert second["version"] == 2
    assert second["immutable_at"] is None

    v1 = await db_session.execute(select(UserDocument).where(UserDocument.id == first["id"]))
    v1_row = v1.scalar_one()
    assert v1_row.immutable_at is not None
    assert not user_may_delete_document(v1_row)

    storage = get_document_storage(settings)
    assert storage.exists(bucket=v1_row.storage_bucket, storage_key=v1_row.storage_key)

    latest = await get_latest_document(db_session, user=user, doc_type=DocumentType.pan)
    assert latest is not None
    assert latest["version"] == 2

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_local_worm_blocks_delete_until_break_glass(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    get_settings.cache_clear()
    settings = get_settings()

    user = User(
        email=f"worm-del-{uuid4()}@example.com",
        phone="9876543210",
        role=UserRole.user,
        status=UserStatus.active,
    )
    await assign_client_id(db_session, user)
    db_session.add(user)
    await db_session.flush()

    admin = User(
        email=f"worm-del-admin-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(admin)
    await db_session.flush()

    uploaded = await upload_user_document(
        db_session,
        user=user,
        doc_type=DocumentType.pan,
        filename="pan.png",
        mime_type="image/png",
        content=_png_bytes(),
    )
    await verify_document(db_session, document_id=uploaded["id"], admin=admin, ip="127.0.0.1")

    row = await db_session.execute(select(UserDocument).where(UserDocument.id == uploaded["id"]))
    document = row.scalar_one()
    storage = get_document_storage(settings)
    assert isinstance(storage, LocalDocumentStorageBackend)

    with pytest.raises(PermissionError):
        storage.delete_object(
            bucket=document.storage_bucket,
            storage_key=document.storage_key,
        )

    await delete_document_admin(
        db_session,
        document_id=document.id,
        admin=admin,
        ip="127.0.0.1",
        reason="break-glass test",
    )

    remaining = await db_session.execute(select(UserDocument).where(UserDocument.id == document.id))
    assert remaining.scalar_one_or_none() is None
    assert not storage.exists(bucket=document.storage_bucket, storage_key=document.storage_key)

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_legal_hold_blocks_admin_delete(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    get_settings.cache_clear()

    user = User(
        email=f"hold-{uuid4()}@example.com",
        phone="9876543210",
        role=UserRole.user,
        status=UserStatus.active,
    )
    await assign_client_id(db_session, user)
    db_session.add(user)
    await db_session.flush()

    admin = User(
        email=f"hold-admin-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(admin)
    await db_session.flush()

    uploaded = await upload_user_document(
        db_session,
        user=user,
        doc_type=DocumentType.pan,
        filename="pan.png",
        mime_type="image/png",
        content=_png_bytes(),
    )

    await set_document_legal_hold(
        db_session,
        document_id=uploaded["id"],
        enabled=True,
        admin=admin,
        ip="127.0.0.1",
    )

    with pytest.raises(DocumentError) as exc:
        await delete_document_admin(
            db_session,
            document_id=uploaded["id"],
            admin=admin,
            ip="127.0.0.1",
            reason="should fail",
        )
    assert exc.value.code == "document_legal_hold"

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_verify_user_kyc_documents_batch(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    get_settings.cache_clear()

    user = User(
        email=f"kyc-batch-{uuid4()}@example.com",
        phone="9876543210",
        role=UserRole.user,
        status=UserStatus.active,
    )
    await assign_client_id(db_session, user)
    db_session.add(user)
    await db_session.flush()

    admin = User(
        email=f"kyc-batch-admin-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(admin)
    await db_session.flush()

    pan = await upload_user_document(
        db_session,
        user=user,
        doc_type=DocumentType.pan,
        filename="pan.png",
        mime_type="image/png",
        content=_png_bytes(),
    )
    sig = await upload_user_document(
        db_session,
        user=user,
        doc_type=DocumentType.signature,
        filename="sig.png",
        mime_type="image/png",
        content=_png_bytes(),
    )

    result = await verify_user_kyc_documents(
        db_session,
        user_id=user.id,
        admin=admin,
        ip="127.0.0.1",
    )
    assert result["verified_count"] == 2
    assert result["skipped_count"] == 0
    assert {item["id"] for item in result["documents"]} == {pan["id"], sig["id"]}

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_compliance_officer_has_verify_and_legal_hold_not_delete(
    db_session: AsyncSession,
) -> None:
    admin = User(
        email=f"co-worm-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(admin)
    await db_session.flush()
    await ensure_rbac_seed(db_session)

    await assign_role_to_admin_user(db_session, user_id=admin.id, role_key="compliance_officer")
    await revoke_role_from_admin_user(db_session, user_id=admin.id, role_key="super_admin")

    assert await user_has_permission(db_session, admin.id, "documents.verify")
    assert await user_has_permission(db_session, admin.id, "documents.legal_hold")
    assert not await user_has_permission(db_session, admin.id, "documents.delete")
