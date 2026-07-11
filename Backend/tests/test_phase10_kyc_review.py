from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.audit_admin_service import list_audit_logs
from app.application.admin.document_kyc_service import get_user_kyc_review, reject_kyc_document
from app.application.documents.client_id_service import assign_client_id
from app.application.documents.document_cdn_service import is_cdn_eligible_document
from app.application.documents.document_download_service import issue_document_download
from app.application.documents.document_service import upload_user_document
from app.application.documents.document_worm_service import verify_document, verify_user_kyc_documents
from app.application.documents.errors import DocumentError
from app.core.config import get_settings
from tests.document_image_fixtures import profile_image_png_bytes
from app.infrastructure.persistence.models import (
    AuditEventType,
    DocumentType,
    KycReviewStatus,
    User,
    UserDocument,
    UserRole,
    UserStatus,
)


def _png_bytes() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
        b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )


@pytest.mark.asyncio
async def test_kyc_upload_sets_pending_review_status(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    get_settings.cache_clear()

    user = User(
        email=f"kyc-pending-{uuid4()}@example.com",
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
    assert uploaded["kyc_review_status"] == "pending"

    row = await db_session.get(UserDocument, uploaded["id"])
    assert row is not None
    assert row.kyc_review_status == KycReviewStatus.pending

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_non_kyc_upload_has_no_review_status(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    get_settings.cache_clear()

    user = User(
        email=f"profile-{uuid4()}@example.com",
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
    assert uploaded["kyc_review_status"] is None

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_verify_sets_approved_and_immutable(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    get_settings.cache_clear()

    user = User(
        email=f"kyc-verify-{uuid4()}@example.com",
        phone="9876543210",
        role=UserRole.user,
        status=UserStatus.active,
    )
    await assign_client_id(db_session, user)
    db_session.add(user)
    await db_session.flush()

    admin = User(
        email=f"kyc-verify-admin-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(admin)
    await db_session.flush()

    uploaded = await upload_user_document(
        db_session,
        user=user,
        doc_type=DocumentType.nominee_id,
        filename="nominee.png",
        mime_type="image/png",
        content=_png_bytes(),
    )

    result = await verify_document(
        db_session,
        document_id=uploaded["id"],
        admin=admin,
        ip="127.0.0.1",
    )
    assert result["kyc_review_status"] == "approved"
    assert result["immutable_at"] is not None

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_reject_kyc_document_writes_audit(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    get_settings.cache_clear()

    user = User(
        email=f"kyc-reject-{uuid4()}@example.com",
        phone="9876543210",
        role=UserRole.user,
        status=UserStatus.active,
    )
    await assign_client_id(db_session, user)
    db_session.add(user)
    await db_session.flush()

    admin = User(
        email=f"kyc-reject-admin-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(admin)
    await db_session.flush()

    uploaded = await upload_user_document(
        db_session,
        user=user,
        doc_type=DocumentType.address_proof,
        filename="address.png",
        mime_type="image/png",
        content=_png_bytes(),
    )

    result = await reject_kyc_document(
        db_session,
        document_id=uploaded["id"],
        admin=admin,
        ip="127.0.0.1",
        reason="Blurry image",
    )
    assert result["kyc_review_status"] == "rejected"
    await db_session.flush()

    logs = await list_audit_logs(
        db_session,
        user_id=user.id,
        event_type=AuditEventType.document_kyc_rejected,
    )
    assert len(logs) >= 1
    assert logs[0]["metadata"]["reason"] == "Blurry image"

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_get_user_kyc_review_returns_latest_by_type(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    get_settings.cache_clear()

    user = User(
        email=f"kyc-review-{uuid4()}@example.com",
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
        doc_type=DocumentType.pan,
        filename="pan-v1.png",
        mime_type="image/png",
        content=_png_bytes(),
    )
    pan_v2 = await upload_user_document(
        db_session,
        user=user,
        doc_type=DocumentType.pan,
        filename="pan-v2.png",
        mime_type="image/png",
        content=_png_bytes(),
    )
    await upload_user_document(
        db_session,
        user=user,
        doc_type=DocumentType.profile_image,
        filename="avatar.png",
        mime_type="image/png",
        content=profile_image_png_bytes(),
    )

    review = await get_user_kyc_review(db_session, user_id=user.id)
    assert review["client_id"] == user.client_id
    assert review["email"] == user.email
    assert len(review["documents"]) == 1
    assert review["documents"][0]["doc_type"] == "pan"
    assert review["documents"][0]["version"] == pan_v2["version"]

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_reject_fails_for_approved_document(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    get_settings.cache_clear()

    user = User(
        email=f"kyc-approved-{uuid4()}@example.com",
        phone="9876543210",
        role=UserRole.user,
        status=UserStatus.active,
    )
    await assign_client_id(db_session, user)
    db_session.add(user)
    await db_session.flush()

    admin = User(
        email=f"kyc-approved-admin-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(admin)
    await db_session.flush()

    uploaded = await upload_user_document(
        db_session,
        user=user,
        doc_type=DocumentType.signature,
        filename="sig.png",
        mime_type="image/png",
        content=_png_bytes(),
    )
    await verify_document(
        db_session,
        document_id=uploaded["id"],
        admin=admin,
        ip="127.0.0.1",
    )

    with pytest.raises(DocumentError) as exc:
        await reject_kyc_document(
            db_session,
            document_id=uploaded["id"],
            admin=admin,
            ip="127.0.0.1",
            reason="Too late",
        )
    assert exc.value.code == "document_already_approved"

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_verify_all_kyc_sets_approved_status(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    get_settings.cache_clear()

    user = User(
        email=f"kyc-batch2-{uuid4()}@example.com",
        phone="9876543210",
        role=UserRole.user,
        status=UserStatus.active,
    )
    await assign_client_id(db_session, user)
    db_session.add(user)
    await db_session.flush()

    admin = User(
        email=f"kyc-batch2-admin-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(admin)
    await db_session.flush()

    await upload_user_document(
        db_session,
        user=user,
        doc_type=DocumentType.pan,
        filename="pan.png",
        mime_type="image/png",
        content=_png_bytes(),
    )
    await upload_user_document(
        db_session,
        user=user,
        doc_type=DocumentType.bank_statement,
        filename="bank.png",
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
    for item in result["documents"]:
        assert item["kyc_review_status"] == "approved"

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_kyc_documents_never_use_cdn_delivery(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    monkeypatch.setenv("DOCUMENTS_CDN_BASE_URL", "https://cdn.example.com")
    monkeypatch.setenv("API_PUBLIC_URL", "http://localhost:8000/api/v1")
    get_settings.cache_clear()

    user = User(
        email=f"kyc-cdn-{uuid4()}@example.com",
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
        doc_type=DocumentType.aadhaar,
        filename="aadhaar.png",
        mime_type="image/png",
        content=_png_bytes(),
    )

    row = await db_session.get(UserDocument, uploaded["id"])
    assert row is not None
    assert not is_cdn_eligible_document(row)

    download = await issue_document_download(
        db_session,
        user=user,
        document_id=uploaded["id"],
    )
    assert download["delivery"] == "signed"
    assert "cdn.example.com" not in str(download["download_url"])

    get_settings.cache_clear()
