"""Cached risk profile PDF report retrieval and generation."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.risk_profile.display import display_score
from app.application.risk_profile.errors import RiskProfileError
from app.application.risk_profile.pdf_generator import RiskProfileReportContext, generate_risk_profile_report_pdf
from app.application.risk_profile.scoring_service import get_assessment_answers
from app.application.risk_profile.tier_service import resolve_tier_for_score
from app.core.config import Settings, get_settings
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.risk_profile_models import (
    RiskProfileAssessment,
    RiskProfileReportCache,
    RiskQuestionCategory,
    UserRiskProfile,
)
from app.infrastructure.storage.documents.factory import get_document_storage


def _format_user_name(user: User) -> str:
    parts = [user.first_name, user.middle_name, user.last_name]
    name = " ".join(part.strip() for part in parts if part and part.strip())
    return name or user.email.split("@", 1)[0]


REPORT_TEMPLATE_VERSION = 4


def _report_storage_key(*, user_id: UUID, assessment_id: UUID) -> str:
    return f"risk-profile-reports/v{REPORT_TEMPLATE_VERSION}/{user_id}/{assessment_id}.pdf"


def _report_filename(*, tier: str, completed_at: datetime | None) -> str:
    date_part = (completed_at or datetime.now(timezone.utc)).strftime("%Y-%m-%d")
    return f"zynd-risk-profile-{tier}-{date_part}.pdf"


async def _resolve_assessment_id(
    db: AsyncSession,
    *,
    user_id: UUID,
    assessment_id: UUID | None,
) -> UUID:
    if assessment_id is not None:
        result = await db.execute(
            select(RiskProfileAssessment.id).where(
                RiskProfileAssessment.id == assessment_id,
                RiskProfileAssessment.user_id == user_id,
            )
        )
        resolved = result.scalar_one_or_none()
        if not resolved:
            raise RiskProfileError("assessment_not_found", "Assessment not found.", status_code=404)
        return resolved

    profile_result = await db.execute(select(UserRiskProfile.assessment_id).where(UserRiskProfile.user_id == user_id))
    current_assessment_id = profile_result.scalar_one_or_none()
    if not current_assessment_id:
        raise RiskProfileError("risk_profile_not_found", "Risk profile not completed yet.", status_code=404)
    return current_assessment_id


async def _load_assessment(
    db: AsyncSession,
    *,
    user_id: UUID,
    assessment_id: UUID,
) -> RiskProfileAssessment:
    result = await db.execute(
        select(RiskProfileAssessment).where(
            RiskProfileAssessment.id == assessment_id,
            RiskProfileAssessment.user_id == user_id,
        )
    )
    assessment = result.scalar_one_or_none()
    if not assessment:
        raise RiskProfileError("assessment_not_found", "Assessment not found.", status_code=404)
    return assessment


async def _build_category_score_rows(
    db: AsyncSession,
    assessment: RiskProfileAssessment,
) -> list[tuple[str, float]]:
    metadata = assessment.metadata_ or {}
    raw_scores = metadata.get("category_scores") or {}
    if not raw_scores:
        return []

    category_ids = [UUID(category_id) for category_id in raw_scores.keys()]
    result = await db.execute(select(RiskQuestionCategory).where(RiskQuestionCategory.id.in_(category_ids)))
    names_by_id = {row.id: row.name for row in result.scalars().all()}

    rows: list[tuple[str, float]] = []
    for category_id, value in raw_scores.items():
        try:
            parsed_id = UUID(str(category_id))
        except ValueError:
            continue
        rows.append((names_by_id.get(parsed_id, "Category"), float(value)))
    rows.sort(key=lambda item: item[0].lower())
    return rows


async def _build_report_context(
    db: AsyncSession,
    *,
    user: User,
    assessment: RiskProfileAssessment,
) -> RiskProfileReportContext:
    tier_row = await resolve_tier_for_score(db, assessment.score)
    answers_payload = await get_assessment_answers(
        db,
        user_id=user.id,
        assessment_id=assessment.id,
    )
    completed_at = assessment.completed_at
    if completed_at and completed_at.tzinfo is None:
        completed_at = completed_at.replace(tzinfo=timezone.utc)

    return RiskProfileReportContext(
        investor_name=_format_user_name(user),
        investor_email=user.email,
        assessment_id=str(assessment.id),
        score=assessment.score,
        display_score=display_score(assessment.score),
        tier=assessment.tier.value,
        tier_title=tier_row.title,
        tier_message=tier_row.message_body,
        completed_at=completed_at,
        questions_answered=len(answers_payload["answers"]),
        total_questions=len(answers_payload["answers"]),
        category_scores=await _build_category_score_rows(db, assessment),
        answers=answers_payload["answers"],
    )


async def get_report_metadata(
    db: AsyncSession,
    *,
    user_id: UUID,
    assessment_id: UUID | None = None,
) -> dict[str, Any]:
    resolved_assessment_id = await _resolve_assessment_id(db, user_id=user_id, assessment_id=assessment_id)
    assessment = await _load_assessment(db, user_id=user_id, assessment_id=resolved_assessment_id)

    cache_result = await db.execute(
        select(RiskProfileReportCache).where(RiskProfileReportCache.assessment_id == resolved_assessment_id)
    )
    cache_row = cache_result.scalar_one_or_none()

    settings = get_settings()
    storage = get_document_storage(settings)
    cached = bool(
        cache_row
        and storage.exists(bucket=cache_row.storage_bucket, storage_key=cache_row.storage_key)
    )

    return {
        "assessment_id": str(resolved_assessment_id),
        "tier": assessment.tier.value,
        "score": assessment.score,
        "cached": cached,
        "generated_at": cache_row.generated_at.isoformat() if cache_row and cache_row.generated_at else None,
        "filename": _report_filename(tier=assessment.tier.value, completed_at=assessment.completed_at),
    }


async def get_or_create_report_pdf(
    db: AsyncSession,
    *,
    user: User,
    assessment_id: UUID | None = None,
    settings: Settings | None = None,
) -> tuple[bytes, str, bool]:
    settings = settings or get_settings()
    resolved_assessment_id = await _resolve_assessment_id(db, user_id=user.id, assessment_id=assessment_id)
    assessment = await _load_assessment(db, user_id=user.id, assessment_id=resolved_assessment_id)
    filename = _report_filename(tier=assessment.tier.value, completed_at=assessment.completed_at)

    cache_result = await db.execute(
        select(RiskProfileReportCache).where(RiskProfileReportCache.assessment_id == resolved_assessment_id)
    )
    cache_row = cache_result.scalar_one_or_none()
    storage = get_document_storage(settings)
    bucket = settings.pii_documents_bucket
    storage_key = _report_storage_key(user_id=user.id, assessment_id=resolved_assessment_id)

    if cache_row and storage.exists(bucket=cache_row.storage_bucket, storage_key=cache_row.storage_key):
        pdf_bytes = storage.read_bytes(
            bucket=cache_row.storage_bucket,
            storage_key=cache_row.storage_key,
            decrypt_at_rest=settings.documents_local_encrypt_pii,
        )
        return pdf_bytes, filename, True

    context = await _build_report_context(db, user=user, assessment=assessment)
    pdf_bytes = generate_risk_profile_report_pdf(context)

    storage.write_bytes(
        bucket=bucket,
        storage_key=storage_key,
        content=pdf_bytes,
        encrypt_at_rest=settings.documents_local_encrypt_pii,
    )

    if cache_row:
        cache_row.storage_bucket = bucket
        cache_row.storage_key = storage_key
        cache_row.file_size = len(pdf_bytes)
        cache_row.generated_at = datetime.now(timezone.utc)
    else:
        db.add(
            RiskProfileReportCache(
                user_id=user.id,
                assessment_id=resolved_assessment_id,
                storage_bucket=bucket,
                storage_key=storage_key,
                file_size=len(pdf_bytes),
            )
        )

    await db.flush()
    return pdf_bytes, filename, False
