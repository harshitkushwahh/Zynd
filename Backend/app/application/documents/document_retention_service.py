from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.compliance.retention_service import can_delete_on_request, get_retention_policy
from app.application.documents.document_worm_policy import (
    _DEFAULT_KYC_RETENTION_DAYS,
    data_class_for_doc_type,
)
from app.core.config import Settings, get_settings
from app.infrastructure.persistence.models import DocumentStatus, User, UserDocument
from app.infrastructure.storage.documents.factory import get_document_storage

logger = logging.getLogger(__name__)

_PURGEABLE_STATUSES = frozenset({DocumentStatus.active, DocumentStatus.quarantined})


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


async def _retention_days_for_doc_type(db: AsyncSession, *, doc_type) -> int:
    data_class = data_class_for_doc_type(doc_type)
    policy = await get_retention_policy(db, data_class)
    if policy:
        return policy.min_retention_days
    if data_class == "kyc_documents":
        return _DEFAULT_KYC_RETENTION_DAYS
    return 30


def document_should_be_retained(document: UserDocument, *, now: datetime | None = None) -> bool:
    now = now or _now()
    if document.legal_hold:
        return True
    if document.deletion_scheduled_at is None:
        return True
    return _ensure_aware(document.deletion_scheduled_at) > now


async def schedule_documents_for_account_deletion(
    db: AsyncSession,
    *,
    user: User,
) -> int:
    if user.deletion_scheduled_at is None:
        raise ValueError("User deletion schedule is not set.")

    account_deletion_at = _ensure_aware(user.deletion_scheduled_at)
    result = await db.execute(select(UserDocument).where(UserDocument.user_id == user.id))
    documents = list(result.scalars())
    for document in documents:
        data_class = data_class_for_doc_type(document.doc_type)
        if await can_delete_on_request(db, data_class):
            document.deletion_scheduled_at = account_deletion_at
        else:
            retention_days = await _retention_days_for_doc_type(db, doc_type=document.doc_type)
            document.deletion_scheduled_at = _ensure_aware(document.created_at) + timedelta(
                days=retention_days
            )
    await db.flush()
    return len(documents)


async def clear_document_deletion_schedule(
    db: AsyncSession,
    *,
    user_id: UUID,
) -> int:
    result = await db.execute(select(UserDocument).where(UserDocument.user_id == user_id))
    documents = list(result.scalars())
    for document in documents:
        document.deletion_scheduled_at = None
    await db.flush()
    return len(documents)


async def _purge_document_object(
    db: AsyncSession,
    *,
    document: UserDocument,
    settings: Settings,
) -> None:
    storage = get_document_storage(settings)
    if document.status in _PURGEABLE_STATUSES and storage.exists(
        bucket=document.storage_bucket,
        storage_key=document.storage_key,
    ):
        try:
            storage.delete_object(
                bucket=document.storage_bucket,
                storage_key=document.storage_key,
                force=True,
            )
        except Exception:
            logger.exception(
                "Failed to purge document storage id=%s bucket=%s key=%s",
                document.id,
                document.storage_bucket,
                document.storage_key,
            )
            raise
    await db.delete(document)


async def purge_due_documents_for_user(
    db: AsyncSession,
    *,
    user_id: UUID,
    now: datetime | None = None,
    settings: Settings | None = None,
) -> dict[str, int]:
    settings = settings or get_settings()
    now = now or _now()
    result = await db.execute(select(UserDocument).where(UserDocument.user_id == user_id))
    documents = list(result.scalars())

    purged = 0
    retained = 0
    for document in documents:
        if document_should_be_retained(document, now=now):
            retained += 1
            continue
        await _purge_document_object(db, document=document, settings=settings)
        purged += 1

    await db.flush()
    return {
        "documents_purged_count": purged,
        "documents_retained_count": retained,
    }


async def purge_expired_documents(
    db: AsyncSession,
    *,
    limit: int | None = None,
    settings: Settings | None = None,
) -> dict[str, Any]:
    settings = settings or get_settings()
    batch_size = limit or settings.deletion_executor_batch_size
    now = _now()

    result = await db.execute(
        select(UserDocument)
        .where(
            UserDocument.deletion_scheduled_at.is_not(None),
            UserDocument.deletion_scheduled_at <= now,
            UserDocument.legal_hold.is_(False),
        )
        .order_by(UserDocument.deletion_scheduled_at.asc())
        .limit(batch_size)
    )
    documents = list(result.scalars())

    purged = 0
    failures: list[dict[str, str]] = []
    for document in documents:
        try:
            await _purge_document_object(db, document=document, settings=settings)
            purged += 1
        except Exception as exc:  # noqa: BLE001 - batch purge must continue
            failures.append({"document_id": str(document.id), "error": str(exc)})

    await db.flush()
    return {
        "processed": len(documents),
        "purged": purged,
        "failed": len(failures),
        "failures": failures,
    }
