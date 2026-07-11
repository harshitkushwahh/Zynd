from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.account_service import cancel_account_deletion, request_account_deletion
from app.application.compliance.deletion_executor_service import execute_account_deletion
from app.application.compliance.retention_service import ensure_retention_seed
from app.application.documents.client_id_service import assign_client_id
from app.application.documents.document_retention_service import (
    clear_document_deletion_schedule,
    document_should_be_retained,
    purge_expired_documents,
    schedule_documents_for_account_deletion,
)
from app.application.documents.document_service import upload_user_document
from app.core.config import get_settings
from tests.document_image_fixtures import profile_image_png_bytes
from app.infrastructure.persistence.models import (
    DeletionEventType,
    DeletionLedger,
    DocumentType,
    User,
    UserDocument,
    UserRole,
    UserStatus,
)
from app.infrastructure.security.passwords import hash_password
from app.infrastructure.storage.documents.factory import get_document_storage


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _png_bytes() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
        b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )


@pytest.mark.asyncio
async def test_schedule_documents_marks_profile_and_kyc_differently(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    get_settings.cache_clear()
    await ensure_retention_seed(db_session)

    user = User(
        email=f"sched-{uuid4()}@example.com",
        phone="9876543210",
        role=UserRole.user,
        status=UserStatus.deletion_pending,
        deletion_scheduled_at=_now() + timedelta(days=30),
    )
    await assign_client_id(db_session, user)
    db_session.add(user)
    await db_session.flush()

    pan = await upload_user_document(
        db_session,
        user=user,
        doc_type=DocumentType.pan,
        filename="pan.png",
        mime_type="image/png",
        content=profile_image_png_bytes(),
    )
    avatar = await upload_user_document(
        db_session,
        user=user,
        doc_type=DocumentType.profile_image,
        filename="avatar.png",
        mime_type="image/png",
        content=profile_image_png_bytes(),
    )

    count = await schedule_documents_for_account_deletion(db_session, user=user)
    assert count == 2

    pan_row = (
        await db_session.execute(select(UserDocument).where(UserDocument.id == pan["id"]))
    ).scalar_one()
    avatar_row = (
        await db_session.execute(select(UserDocument).where(UserDocument.id == avatar["id"]))
    ).scalar_one()

    assert pan_row.created_at + timedelta(days=1825) == pan_row.deletion_scheduled_at
    assert avatar_row.deletion_scheduled_at == user.deletion_scheduled_at
    assert document_should_be_retained(pan_row)
    assert not document_should_be_retained(avatar_row, now=user.deletion_scheduled_at + timedelta(seconds=1))

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_execute_account_deletion_purges_profile_and_retains_kyc(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    get_settings.cache_clear()
    settings = get_settings()
    await ensure_retention_seed(db_session)

    user = User(
        email=f"exec-{uuid4()}@example.com",
        phone="9876543210",
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.deletion_pending,
        deletion_requested_at=_now() - timedelta(days=31),
        deletion_scheduled_at=_now() - timedelta(minutes=5),
    )
    await assign_client_id(db_session, user)
    db_session.add(user)
    await db_session.flush()

    pan = await upload_user_document(
        db_session,
        user=user,
        doc_type=DocumentType.pan,
        filename="pan.png",
        mime_type="image/png",
        content=profile_image_png_bytes(),
    )
    avatar = await upload_user_document(
        db_session,
        user=user,
        doc_type=DocumentType.profile_image,
        filename="avatar.png",
        mime_type="image/png",
        content=profile_image_png_bytes(),
    )
    await schedule_documents_for_account_deletion(db_session, user=user)

    pan_row = (
        await db_session.execute(select(UserDocument).where(UserDocument.id == pan["id"]))
    ).scalar_one()
    avatar_row = (
        await db_session.execute(select(UserDocument).where(UserDocument.id == avatar["id"]))
    ).scalar_one()

    await execute_account_deletion(db_session, user=user, notify_email=None)
    await db_session.flush()

    remaining = list(
        (await db_session.execute(select(UserDocument).where(UserDocument.user_id == user.id))).scalars()
    )
    assert len(remaining) == 1
    assert remaining[0].id == pan_row.id

    storage = get_document_storage(settings)
    assert storage.exists(bucket=pan_row.storage_bucket, storage_key=pan_row.storage_key)
    assert not storage.exists(bucket=avatar_row.storage_bucket, storage_key=avatar_row.storage_key)

    ledger = (
        await db_session.execute(
            select(DeletionLedger).where(
                DeletionLedger.user_id == user.id,
                DeletionLedger.event_type == DeletionEventType.deletion_executed,
            )
        )
    ).scalar_one()
    assert ledger.metadata_["documents_purged_count"] == 1
    assert ledger.metadata_["documents_retained_count"] == 1

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_purge_expired_documents_job(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    get_settings.cache_clear()
    settings = get_settings()

    user = User(
        email=f"purge-{uuid4()}@example.com",
        phone="9876543210",
        role=UserRole.user,
        status=UserStatus.active,
    )
    await assign_client_id(db_session, user)
    db_session.add(user)
    await db_session.flush()

    avatar = await upload_user_document(
        db_session,
        user=user,
        doc_type=DocumentType.profile_image,
        filename="avatar.png",
        mime_type="image/png",
        content=profile_image_png_bytes(),
    )
    row = (
        await db_session.execute(select(UserDocument).where(UserDocument.id == avatar["id"]))
    ).scalar_one()
    row.deletion_scheduled_at = _now() - timedelta(minutes=1)
    await db_session.flush()

    result = await purge_expired_documents(db_session)
    assert result["purged"] == 1
    assert result["failed"] == 0

    remaining = (
        await db_session.execute(select(UserDocument).where(UserDocument.id == avatar["id"]))
    ).scalar_one_or_none()
    assert remaining is None

    storage = get_document_storage(settings)
    assert not storage.exists(bucket=row.storage_bucket, storage_key=row.storage_key)

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_clear_document_deletion_schedule(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    get_settings.cache_clear()

    user = User(
        email=f"clear-{uuid4()}@example.com",
        phone="9876543210",
        role=UserRole.user,
        status=UserStatus.deletion_pending,
        deletion_scheduled_at=_now() + timedelta(days=30),
    )
    await assign_client_id(db_session, user)
    db_session.add(user)
    await db_session.flush()

    await upload_user_document(
        db_session,
        user=user,
        doc_type=DocumentType.pan,
        filename="pan.png",
        mime_type="image/png",
        content=profile_image_png_bytes(),
    )
    await schedule_documents_for_account_deletion(db_session, user=user)

    cleared = await clear_document_deletion_schedule(db_session, user_id=user.id)
    assert cleared == 1

    row = (
        await db_session.execute(select(UserDocument).where(UserDocument.user_id == user.id))
    ).scalar_one()
    assert row.deletion_scheduled_at is None

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_legal_hold_prevents_purge_even_when_due(
    db_session: AsyncSession,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCUMENTS_ROOT", str(tmp_path))
    get_settings.cache_clear()

    user = User(
        email=f"hold-purge-{uuid4()}@example.com",
        phone="9876543210",
        role=UserRole.user,
        status=UserStatus.active,
    )
    await assign_client_id(db_session, user)
    db_session.add(user)
    await db_session.flush()

    avatar = await upload_user_document(
        db_session,
        user=user,
        doc_type=DocumentType.profile_image,
        filename="avatar.png",
        mime_type="image/png",
        content=profile_image_png_bytes(),
    )
    row = (
        await db_session.execute(select(UserDocument).where(UserDocument.id == avatar["id"]))
    ).scalar_one()
    row.deletion_scheduled_at = _now() - timedelta(minutes=1)
    row.legal_hold = True
    await db_session.flush()

    result = await purge_expired_documents(db_session)
    assert result["purged"] == 0

    still_there = (
        await db_session.execute(select(UserDocument).where(UserDocument.id == avatar["id"]))
    ).scalar_one_or_none()
    assert still_there is not None

    get_settings.cache_clear()
