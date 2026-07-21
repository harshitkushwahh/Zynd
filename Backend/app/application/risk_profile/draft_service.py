from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.risk_profile.errors import RiskProfileError
from app.infrastructure.persistence.risk_profile_models import RiskProfileAssessmentDraft


def serialize_draft(row: RiskProfileAssessmentDraft) -> dict[str, Any]:
    return {
        "template_id": str(row.template_id) if row.template_id else None,
        "question_ids": [str(item) for item in (row.question_ids or [])],
        "answers": {str(key): str(value) for key, value in (row.answers or {}).items()},
        "step_index": row.step_index,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


async def get_draft(db: AsyncSession, user_id: UUID) -> dict[str, Any] | None:
    result = await db.execute(
        select(RiskProfileAssessmentDraft).where(RiskProfileAssessmentDraft.user_id == user_id)
    )
    row = result.scalar_one_or_none()
    return serialize_draft(row) if row else None


async def upsert_draft(
    db: AsyncSession,
    *,
    user_id: UUID,
    template_id: UUID | None,
    question_ids: list[str],
    answers: dict[str, str],
    step_index: int,
) -> dict[str, Any]:
    if step_index < 0:
        raise RiskProfileError("invalid_draft_step", "Draft step index cannot be negative.")
    if not question_ids:
        raise RiskProfileError("invalid_draft_questions", "Draft must include question identifiers.")

    result = await db.execute(
        select(RiskProfileAssessmentDraft).where(RiskProfileAssessmentDraft.user_id == user_id)
    )
    row = result.scalar_one_or_none()
    if row:
        row.template_id = template_id
        row.question_ids = question_ids
        row.answers = answers
        row.step_index = step_index
    else:
        row = RiskProfileAssessmentDraft(
            user_id=user_id,
            template_id=template_id,
            question_ids=question_ids,
            answers=answers,
            step_index=step_index,
        )
        db.add(row)

    await db.flush()
    await db.refresh(row)
    return serialize_draft(row)


async def delete_draft(db: AsyncSession, user_id: UUID) -> None:
    await db.execute(delete(RiskProfileAssessmentDraft).where(RiskProfileAssessmentDraft.user_id == user_id))
    await db.flush()
