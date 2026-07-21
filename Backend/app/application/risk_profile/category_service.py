from __future__ import annotations

import re
import unicodedata
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.auth.audit_service import write_audit
from app.application.risk_profile.errors import RiskProfileError
from app.infrastructure.persistence.models import AuditEventType, User
from app.infrastructure.persistence.risk_profile_models import RiskQuestion, RiskQuestionCategory

_SLUG_PATTERN = re.compile(r"^[a-z][a-z0-9_]{1,62}$")


def _category_snapshot(row: RiskQuestionCategory) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "slug": row.slug,
        "name": row.name,
        "description": row.description,
        "weight": str(row.weight),
        "sort_order": row.sort_order,
        "is_active": row.is_active,
    }


def serialize_category(row: RiskQuestionCategory, *, question_count: int | None = None) -> dict[str, Any]:
    payload = {
        "id": str(row.id),
        "slug": row.slug,
        "name": row.name,
        "description": row.description,
        "weight": float(row.weight),
        "sort_order": row.sort_order,
        "is_active": row.is_active,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }
    if question_count is not None:
        payload["question_count"] = question_count
    return payload


def _validate_slug(slug: str) -> str:
    normalized = slug.strip().lower()
    if not _SLUG_PATTERN.match(normalized):
        raise RiskProfileError(
            "invalid_category_slug",
            "Category slug must be 2–63 lowercase letters, digits, or underscores and start with a letter.",
        )
    return normalized


def slugify_category_name(name: str) -> str:
    normalized = unicodedata.normalize("NFKD", name.strip())
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "_", ascii_text).strip("_")
    if not slug:
        slug = "category"
    if not slug[0].isalpha():
        slug = f"c_{slug}"
    if len(slug) < 2:
        slug = f"{slug}_x"
    return slug[:63]


async def _generate_unique_category_slug(db: AsyncSession, name: str) -> str:
    base_slug = _validate_slug(slugify_category_name(name))
    candidate = base_slug
    suffix = 2

    while True:
        existing = await db.execute(
            select(RiskQuestionCategory).where(RiskQuestionCategory.slug == candidate)
        )
        if existing.scalar_one_or_none() is None:
            return candidate

        suffix_part = f"_{suffix}"
        trimmed_base = base_slug[: 63 - len(suffix_part)]
        candidate = _validate_slug(f"{trimmed_base}{suffix_part}")
        suffix += 1


def _validate_weight(weight: Decimal | float) -> Decimal:
    decimal_weight = Decimal(str(weight))
    if decimal_weight < 0 or decimal_weight > 1:
        raise RiskProfileError("invalid_category_weight", "Category weight must be between 0 and 1.")
    return decimal_weight.quantize(Decimal("0.0001"))


async def _get_category_or_raise(db: AsyncSession, category_id: UUID) -> RiskQuestionCategory:
    result = await db.execute(select(RiskQuestionCategory).where(RiskQuestionCategory.id == category_id))
    row = result.scalar_one_or_none()
    if not row:
        raise RiskProfileError("category_not_found", "Risk question category not found.", status_code=404)
    return row


async def _get_category_with_questions(db: AsyncSession, category_id: UUID) -> RiskQuestionCategory:
    result = await db.execute(
        select(RiskQuestionCategory)
        .options(selectinload(RiskQuestionCategory.questions))
        .where(RiskQuestionCategory.id == category_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise RiskProfileError("category_not_found", "Risk question category not found.", status_code=404)
    return row


async def _count_active_questions(db: AsyncSession, category_id: UUID) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(RiskQuestion)
        .where(RiskQuestion.category_id == category_id, RiskQuestion.is_active.is_(True))
    )
    return int(result.scalar_one())


async def list_categories(db: AsyncSession, *, include_inactive: bool = False) -> list[dict[str, Any]]:
    query = select(RiskQuestionCategory).options(selectinload(RiskQuestionCategory.questions))
    if not include_inactive:
        query = query.where(RiskQuestionCategory.is_active.is_(True))
    query = query.order_by(RiskQuestionCategory.sort_order, RiskQuestionCategory.name)
    result = await db.execute(query)
    rows = result.scalars().unique().all()
    return [
        serialize_category(
            row,
            question_count=len([question for question in row.questions if question.is_active]),
        )
        for row in rows
    ]


async def get_category(db: AsyncSession, category_id: UUID) -> dict[str, Any]:
    row = await _get_category_with_questions(db, category_id)
    return serialize_category(
        row,
        question_count=len([question for question in row.questions if question.is_active]),
    )


async def create_category(
    db: AsyncSession,
    *,
    name: str,
    description: str | None,
    weight: Decimal | float,
    sort_order: int,
    admin: User,
    ip: str | None,
) -> dict[str, Any]:
    trimmed_name = name.strip()
    if not trimmed_name:
        raise RiskProfileError("invalid_category_name", "Category name is required.")

    normalized_slug = await _generate_unique_category_slug(db, trimmed_name)
    normalized_weight = _validate_weight(weight)

    row = RiskQuestionCategory(
        slug=normalized_slug,
        name=trimmed_name,
        description=description.strip() if description else None,
        weight=normalized_weight,
        sort_order=sort_order,
        is_active=True,
    )
    db.add(row)
    await db.flush()

    await write_audit(
        db,
        event_type=AuditEventType.risk_category_created,
        user_id=admin.id,
        ip=ip,
        metadata={"category": _category_snapshot(row), "admin_id": str(admin.id)},
    )
    return serialize_category(row, question_count=0)


async def update_category(
    db: AsyncSession,
    *,
    category_id: UUID,
    name: str | None,
    description: str | None,
    weight: Decimal | float | None,
    sort_order: int | None,
    is_active: bool | None,
    admin: User,
    ip: str | None,
) -> dict[str, Any]:
    row = await _get_category_or_raise(db, category_id)
    before = _category_snapshot(row)

    if name is not None:
        trimmed_name = name.strip()
        if not trimmed_name:
            raise RiskProfileError("invalid_category_name", "Category name cannot be empty.")
        row.name = trimmed_name

    if description is not None:
        row.description = description.strip() or None

    if weight is not None:
        row.weight = _validate_weight(weight)

    if sort_order is not None:
        row.sort_order = sort_order

    if is_active is not None:
        row.is_active = is_active

    await db.flush()
    question_count = await _count_active_questions(db, category_id)
    await db.refresh(row)

    await write_audit(
        db,
        event_type=AuditEventType.risk_category_updated,
        user_id=admin.id,
        ip=ip,
        metadata={
            "category_id": str(category_id),
            "before": before,
            "after": _category_snapshot(row),
            "admin_id": str(admin.id),
        },
    )
    return serialize_category(row, question_count=question_count)
