from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.auth.audit_service import write_audit
from app.application.risk_profile.display import active_question_options
from app.application.risk_profile.category_service import _get_category_or_raise
from app.application.risk_profile.errors import RiskProfileError
from app.infrastructure.persistence.models import AuditEventType, User
from app.infrastructure.persistence.risk_profile_models import RiskQuestion, RiskQuestionOption

MAX_OPTIONS_PER_QUESTION = 4


def _option_snapshot(option: RiskQuestionOption) -> dict[str, Any]:
    return {
        "id": str(option.id),
        "label": option.label,
        "score_value": option.score_value,
        "sort_order": option.sort_order,
        "is_active": option.is_active,
    }


def _question_snapshot(question: RiskQuestion) -> dict[str, Any]:
    return {
        "id": str(question.id),
        "category_id": str(question.category_id),
        "prompt": question.prompt,
        "help_text": question.help_text,
        "sort_order": question.sort_order,
        "is_active": question.is_active,
        "options": [_option_snapshot(option) for option in question.options],
    }


def serialize_question(question: RiskQuestion, *, active_options_only: bool = False) -> dict[str, Any]:
    options = active_question_options(question) if active_options_only else question.options
    return {
        "id": str(question.id),
        "category_id": str(question.category_id),
        "category_slug": question.category.slug if question.category else None,
        "category_name": question.category.name if question.category else None,
        "prompt": question.prompt,
        "help_text": question.help_text,
        "sort_order": question.sort_order,
        "is_active": question.is_active,
        "options": [_option_snapshot(option) for option in options],
        "created_at": question.created_at.isoformat() if question.created_at else None,
        "updated_at": question.updated_at.isoformat() if question.updated_at else None,
    }


def _validate_options(options: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not options:
        raise RiskProfileError("options_required", "At least one option is required.")
    if len(options) > MAX_OPTIONS_PER_QUESTION:
        raise RiskProfileError(
            "too_many_options",
            f"A question can have at most {MAX_OPTIONS_PER_QUESTION} options.",
        )

    normalized: list[dict[str, Any]] = []
    for index, option in enumerate(options):
        label = str(option.get("label", "")).strip()
        if not label:
            raise RiskProfileError("invalid_option_label", f"Option {index + 1} label is required.")
        try:
            score_value = int(option["score_value"])
        except (KeyError, TypeError, ValueError) as exc:
            raise RiskProfileError("invalid_option_score", f"Option {index + 1} score must be an integer.") from exc
        if score_value < 0 or score_value > 100:
            raise RiskProfileError("invalid_option_score", "Option scores must be between 0 and 100.")
        sort_order = option.get("sort_order", index)
        normalized.append({"label": label, "score_value": score_value, "sort_order": int(sort_order)})
    return normalized


async def _get_question_or_raise(db: AsyncSession, question_id: UUID) -> RiskQuestion:
    result = await db.execute(
        select(RiskQuestion)
        .options(selectinload(RiskQuestion.options), selectinload(RiskQuestion.category))
        .where(RiskQuestion.id == question_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise RiskProfileError("question_not_found", "Risk question not found.", status_code=404)
    return row


async def _next_question_sort_order(db: AsyncSession, category_id: UUID) -> int:
    result = await db.execute(
        select(func.coalesce(func.max(RiskQuestion.sort_order), -1)).where(
            RiskQuestion.category_id == category_id
        )
    )
    return int(result.scalar_one()) + 1


async def list_questions(
    db: AsyncSession,
    *,
    category_id: UUID | None = None,
    include_inactive: bool = False,
) -> list[dict[str, Any]]:
    query = (
        select(RiskQuestion)
        .options(selectinload(RiskQuestion.options), selectinload(RiskQuestion.category))
        .order_by(RiskQuestion.sort_order, RiskQuestion.created_at)
    )
    if category_id is not None:
        query = query.where(RiskQuestion.category_id == category_id)
    if not include_inactive:
        query = query.where(RiskQuestion.is_active.is_(True))

    result = await db.execute(query)
    return [serialize_question(row) for row in result.scalars().unique().all()]


async def get_question(db: AsyncSession, question_id: UUID) -> dict[str, Any]:
    row = await _get_question_or_raise(db, question_id)
    return serialize_question(row)


async def create_question(
    db: AsyncSession,
    *,
    category_id: UUID,
    prompt: str,
    help_text: str | None,
    sort_order: int | None,
    options: list[dict[str, Any]],
    admin: User,
    ip: str | None,
) -> dict[str, Any]:
    await _get_category_or_raise(db, category_id)
    trimmed_prompt = prompt.strip()
    if not trimmed_prompt:
        raise RiskProfileError("invalid_question_prompt", "Question prompt is required.")

    normalized_options = _validate_options(options)
    resolved_sort_order = (
        sort_order if sort_order is not None else await _next_question_sort_order(db, category_id)
    )
    row = RiskQuestion(
        category_id=category_id,
        prompt=trimmed_prompt,
        help_text=help_text.strip() if help_text else None,
        sort_order=resolved_sort_order,
        is_active=True,
    )
    db.add(row)
    await db.flush()

    for option in normalized_options:
        db.add(
            RiskQuestionOption(
                question_id=row.id,
                label=option["label"],
                score_value=option["score_value"],
                sort_order=option["sort_order"],
                is_active=True,
            )
        )
    await db.flush()
    created = await _get_question_or_raise(db, row.id)

    await write_audit(
        db,
        event_type=AuditEventType.risk_question_created,
        user_id=admin.id,
        ip=ip,
        metadata={"question": _question_snapshot(created), "admin_id": str(admin.id)},
    )
    return serialize_question(created)


async def update_question(
    db: AsyncSession,
    *,
    question_id: UUID,
    category_id: UUID | None,
    prompt: str | None,
    help_text: str | None,
    sort_order: int | None,
    is_active: bool | None,
    options: list[dict[str, Any]] | None,
    admin: User,
    ip: str | None,
) -> dict[str, Any]:
    row = await _get_question_or_raise(db, question_id)
    before = _question_snapshot(row)

    if category_id is not None and category_id != row.category_id:
        await _get_category_or_raise(db, category_id)
        row.category_id = category_id
        row.sort_order = await _next_question_sort_order(db, category_id)

    if prompt is not None:
        trimmed_prompt = prompt.strip()
        if not trimmed_prompt:
            raise RiskProfileError("invalid_question_prompt", "Question prompt cannot be empty.")
        row.prompt = trimmed_prompt

    if help_text is not None:
        row.help_text = help_text.strip() or None

    if sort_order is not None:
        row.sort_order = sort_order

    if is_active is not None:
        row.is_active = is_active

    if options is not None:
        normalized_options = _validate_options(options)
        existing_by_sort = {option.sort_order: option for option in row.options}
        seen_sort_orders: set[int] = set()

        for option in normalized_options:
            sort_order = option["sort_order"]
            seen_sort_orders.add(sort_order)
            existing = existing_by_sort.get(sort_order)
            if existing:
                existing.label = option["label"]
                existing.score_value = option["score_value"]
                existing.is_active = True
            else:
                db.add(
                    RiskQuestionOption(
                        question_id=row.id,
                        label=option["label"],
                        score_value=option["score_value"],
                        sort_order=sort_order,
                        is_active=True,
                    )
                )

        for option in row.options:
            if option.sort_order not in seen_sort_orders:
                option.is_active = False

    await db.flush()
    updated = await _get_question_or_raise(db, question_id)

    await write_audit(
        db,
        event_type=AuditEventType.risk_question_updated,
        user_id=admin.id,
        ip=ip,
        metadata={
            "question_id": str(question_id),
            "before": before,
            "after": _question_snapshot(updated),
            "admin_id": str(admin.id),
        },
    )
    return serialize_question(updated)


async def delete_question(
    db: AsyncSession,
    *,
    question_id: UUID,
    admin: User,
    ip: str | None,
) -> dict[str, Any]:
    row = await _get_question_or_raise(db, question_id)
    before = _question_snapshot(row)
    row.is_active = False
    await db.flush()

    await write_audit(
        db,
        event_type=AuditEventType.risk_question_deleted,
        user_id=admin.id,
        ip=ip,
        metadata={"question_id": str(question_id), "before": before, "admin_id": str(admin.id)},
    )
    return serialize_question(row)
