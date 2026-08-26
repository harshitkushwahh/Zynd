from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models import (
    SecurityReviewItem,
    SecurityReviewReason,
    SecurityReviewStatus,
    User,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def create_security_review_item(
    db: AsyncSession,
    *,
    user_id: UUID,
    reason: SecurityReviewReason,
    metadata: dict[str, Any] | None = None,
) -> SecurityReviewItem:
    item = SecurityReviewItem(
        user_id=user_id,
        reason=reason,
        status=SecurityReviewStatus.open,
        metadata_=metadata,
    )
    db.add(item)
    await db.flush()
    return item


async def list_security_review_items(
    db: AsyncSession,
    *,
    status: SecurityReviewStatus | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    query = (
        select(SecurityReviewItem, User.email, User.client_id)
        .join(User, SecurityReviewItem.user_id == User.id)
        .order_by(SecurityReviewItem.created_at.desc())
        .limit(limit)
    )
    if status:
        query = query.where(SecurityReviewItem.status == status)

    result = await db.execute(query)
    items: list[dict[str, Any]] = []
    for review, email, client_id in result.all():
        items.append(
            {
                "id": review.id,
                "user_id": review.user_id,
                "client_id": client_id or "",
                "user_email": email,
                "reason": review.reason.value,
                "status": review.status.value,
                "metadata": review.metadata_ or {},
                "review_notes": review.review_notes,
                "reviewed_at": review.reviewed_at,
                "created_at": review.created_at,
            }
        )
    return items


async def resolve_security_review_item(
    db: AsyncSession,
    *,
    item_id: UUID,
    reviewer: User,
    status: SecurityReviewStatus,
    notes: str | None = None,
) -> dict[str, Any]:
    result = await db.execute(select(SecurityReviewItem).where(SecurityReviewItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise ValueError("Review item not found.")
    if item.status != SecurityReviewStatus.open:
        raise ValueError("Review item is already resolved.")

    item.status = status
    item.reviewer_id = reviewer.id
    item.review_notes = notes
    item.reviewed_at = _now()
    await db.flush()
    return {
        "id": item.id,
        "status": item.status.value,
        "reviewed_at": item.reviewed_at,
    }
