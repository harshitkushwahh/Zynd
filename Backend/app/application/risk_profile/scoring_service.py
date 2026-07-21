from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.auth.audit_service import write_audit
from app.application.risk_profile.attempt_service import ensure_can_take_assessment, get_attempt_state, record_completed_attempt
from app.application.risk_profile.draft_service import delete_draft
from app.application.risk_profile.risk_profile_notification_service import notify_risk_profile_completed
from app.application.risk_profile.display import (
    active_question_options,
    answer_item_from_snapshot,
    build_answer_snapshot,
    display_score,
)
from app.application.risk_profile.errors import RiskProfileError
from app.application.risk_profile.tier_service import resolve_tier_for_score, serialize_tier
from app.infrastructure.persistence.models import AuditEventType, User
from app.infrastructure.persistence.risk_profile_models import (
    RiskProfileAnswer,
    RiskProfileAssessment,
    RiskQuestion,
    RiskQuestionCategory,
    RiskQuestionOption,
    RiskTier,
    UserRiskProfile,
)


def normalize_category_score(selected_total: int, max_total: int) -> float:
    if max_total <= 0:
        return 0.0
    return (selected_total / max_total) * 1000.0


def compute_weighted_score(
    *,
    category_scores: dict[UUID, float],
    category_weights: dict[UUID, Decimal],
) -> int:
    if not category_scores:
        return 0

    active_weights = {
        category_id: float(weight)
        for category_id, weight in category_weights.items()
        if category_id in category_scores and float(weight) > 0
    }
    if not active_weights:
        average = sum(category_scores.values()) / len(category_scores)
        return max(0, min(1000, round(average)))

    total_weight = sum(active_weights.values())
    weighted = sum(category_scores[category_id] * (active_weights[category_id] / total_weight) for category_id in active_weights)
    return max(0, min(1000, round(weighted)))


def build_category_scores(
    *,
    answers: list[tuple[RiskQuestion, RiskQuestionOption]],
) -> dict[UUID, float]:
    grouped_selected: dict[UUID, int] = defaultdict(int)
    grouped_max: dict[UUID, int] = defaultdict(int)

    seen_questions: set[UUID] = set()
    for question, option in answers:
        if question.id in seen_questions:
            raise RiskProfileError("duplicate_question_answer", "Each question can only be answered once.")
        seen_questions.add(question.id)

        if not question.is_active:
            raise RiskProfileError("inactive_question", "One or more answered questions are inactive.")
        if not question.category.is_active:
            raise RiskProfileError("inactive_category", "One or more answered categories are inactive.")

        max_option_score = max(item.score_value for item in active_question_options(question)) if question.options else 0
        grouped_selected[question.category_id] += option.score_value
        grouped_max[question.category_id] += max_option_score

    return {
        category_id: normalize_category_score(grouped_selected[category_id], grouped_max[category_id])
        for category_id in grouped_max
    }


async def _load_answered_questions(
    db: AsyncSession,
    *,
    answers: list[dict[str, UUID]],
) -> list[tuple[RiskQuestion, RiskQuestionOption]]:
    if not answers:
        raise RiskProfileError("answers_required", "At least one answer is required.")

    question_ids = [item["question_id"] for item in answers]
    result = await db.execute(
        select(RiskQuestion)
        .options(
            selectinload(RiskQuestion.options),
            selectinload(RiskQuestion.category),
        )
        .where(RiskQuestion.id.in_(question_ids))
    )
    questions_by_id = {row.id: row for row in result.scalars().unique().all()}

    resolved: list[tuple[RiskQuestion, RiskQuestionOption]] = []
    for item in answers:
        question = questions_by_id.get(item["question_id"])
        if not question:
            raise RiskProfileError("question_not_found", "One or more answered questions were not found.")

        option = next((row for row in active_question_options(question) if row.id == item["option_id"]), None)
        if not option:
            raise RiskProfileError("option_not_found", "One or more selected options were not found for their question.")
        resolved.append((question, option))
    return resolved


async def _load_category_weights(db: AsyncSession, category_ids: set[UUID]) -> dict[UUID, Decimal]:
    if not category_ids:
        return {}
    result = await db.execute(
        select(RiskQuestionCategory).where(RiskQuestionCategory.id.in_(category_ids))
    )
    return {row.id: row.weight for row in result.scalars().all()}


async def preview_score(
    db: AsyncSession,
    *,
    answers: list[dict[str, UUID]],
) -> dict[str, Any]:
    resolved = await _load_answered_questions(db, answers=answers)
    category_scores = build_category_scores(answers=resolved)
    category_weights = await _load_category_weights(db, set(category_scores.keys()))
    score = compute_weighted_score(category_scores=category_scores, category_weights=category_weights)
    tier_row = await resolve_tier_for_score(db, score)
    return {
        "score": score,
        "tier": tier_row.tier.value,
        "tier_title": tier_row.title,
        "tier_message": tier_row.message_body,
        "category_scores": {
            str(category_id): round(value, 2) for category_id, value in category_scores.items()
        },
    }


async def submit_assessment(
    db: AsyncSession,
    *,
    user: User,
    answers: list[dict[str, UUID]],
    ip: str | None,
    template_id: UUID | None = None,
) -> dict[str, Any]:
    await ensure_can_take_assessment(db, user.id)
    preview = await preview_score(db, answers=answers)
    resolved = await _load_answered_questions(db, answers=answers)

    assessment = RiskProfileAssessment(
        user_id=user.id,
        score=preview["score"],
        tier=RiskTier(preview["tier"]),
        template_id=template_id,
        metadata_={"category_scores": preview["category_scores"]},
    )
    db.add(assessment)
    await db.flush()

    for question, option in resolved:
        db.add(
            RiskProfileAnswer(
                assessment_id=assessment.id,
                question_id=question.id,
                option_id=option.id,
                answer_snapshot=build_answer_snapshot(question, option),
            )
        )

    existing = await db.execute(select(UserRiskProfile).where(UserRiskProfile.user_id == user.id))
    profile = existing.scalar_one_or_none()
    if profile:
        profile.score = preview["score"]
        profile.tier = RiskTier(preview["tier"])
        profile.assessment_id = assessment.id
    else:
        db.add(
            UserRiskProfile(
                user_id=user.id,
                score=preview["score"],
                tier=RiskTier(preview["tier"]),
                assessment_id=assessment.id,
            )
        )

    await db.flush()
    tier_row = await resolve_tier_for_score(db, preview["score"])

    await write_audit(
        db,
        event_type=AuditEventType.risk_profile_completed,
        user_id=user.id,
        ip=ip,
        metadata={
            "assessment_id": str(assessment.id),
            "score": preview["score"],
            "tier": preview["tier"],
        },
    )

    notify_risk_profile_completed(
        user=user,
        assessment_id=assessment.id,
        score=preview["score"],
        tier=preview["tier"],
        title=tier_row.title,
        message_body=tier_row.message_body,
    )

    attempt_state = await record_completed_attempt(db, user.id)
    await delete_draft(db, user.id)

    if attempt_state["is_locked"]:
        await write_audit(
            db,
            event_type=AuditEventType.risk_profile_locked,
            user_id=user.id,
            ip=ip,
            metadata={
                "completed_count": attempt_state["completed_count"],
                "granted_attempts": attempt_state["granted_attempts"],
            },
        )

    await write_audit(
        db,
        event_type=AuditEventType.risk_profile_message_sent,
        user_id=user.id,
        ip=ip,
        metadata={
            "assessment_id": str(assessment.id),
            "tier": preview["tier"],
            "notification_type": "invest.risk_profile.completed",
        },
    )

    return {
        "assessment_id": str(assessment.id),
        "score": preview["score"],
        "display_score": display_score(preview["score"]),
        "tier": tier_row.tier.value,
        "tier_config": serialize_tier(tier_row),
        "category_scores": preview["category_scores"],
        "attempt_state": attempt_state,
    }


async def get_user_risk_profile(db: AsyncSession, user_id: UUID) -> dict[str, Any] | None:
    result = await db.execute(select(UserRiskProfile).where(UserRiskProfile.user_id == user_id))
    row = result.scalar_one_or_none()
    if not row:
        return None
    tier_row = await resolve_tier_for_score(db, row.score)
    attempt_state = await get_attempt_state(db, user_id)
    counts_result = await db.execute(
        select(func.count())
        .select_from(RiskProfileAnswer)
        .where(RiskProfileAnswer.assessment_id == row.assessment_id)
    )
    question_count = int(counts_result.scalar_one())
    return {
        "user_id": str(row.user_id),
        "score": row.score,
        "display_score": display_score(row.score),
        "tier": row.tier.value,
        "tier_config": serialize_tier(tier_row),
        "assessment_id": str(row.assessment_id),
        "questions_answered": question_count,
        "total_questions": question_count,
        "computed_at": row.computed_at.isoformat() if row.computed_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        "attempt_state": attempt_state,
    }


async def get_assessment_answers(
    db: AsyncSession,
    *,
    user_id: UUID,
    assessment_id: UUID,
) -> dict[str, Any]:
    result = await db.execute(
        select(RiskProfileAssessment).where(
            RiskProfileAssessment.id == assessment_id,
            RiskProfileAssessment.user_id == user_id,
        )
    )
    assessment = result.scalar_one_or_none()
    if not assessment:
        raise RiskProfileError("assessment_not_found", "Assessment not found.", status_code=404)

    answers_result = await db.execute(
        select(RiskProfileAnswer).where(RiskProfileAnswer.assessment_id == assessment_id)
    )
    answer_rows = answers_result.scalars().all()
    if not answer_rows:
        raise RiskProfileError(
            "assessment_answers_not_found",
            "No answers found for this assessment.",
            status_code=404,
        )

    question_ids = [row.question_id for row in answer_rows]
    option_ids = [row.option_id for row in answer_rows]

    questions_result = await db.execute(
        select(RiskQuestion)
        .options(
            selectinload(RiskQuestion.category),
            selectinload(RiskQuestion.options),
        )
        .where(RiskQuestion.id.in_(question_ids))
    )
    questions_by_id = {row.id: row for row in questions_result.scalars().unique().all()}

    options_result = await db.execute(select(RiskQuestionOption).where(RiskQuestionOption.id.in_(option_ids)))
    options_by_id = {row.id: row for row in options_result.scalars().all()}

    items: list[dict[str, Any]] = []
    for answer in answer_rows:
        if answer.answer_snapshot:
            items.append(
                answer_item_from_snapshot(
                    question_id=str(answer.question_id),
                    snapshot=answer.answer_snapshot,
                )
            )
            continue

        question = questions_by_id.get(answer.question_id)
        option = options_by_id.get(answer.option_id)
        live_options = sorted(question.options, key=lambda row: row.sort_order) if question else []
        items.append(
            {
                "question_id": str(answer.question_id),
                "category_name": question.category.name if question and question.category else None,
                "prompt": question.prompt if question else "Question unavailable",
                "help_text": question.help_text if question else None,
                "sort_order": question.sort_order if question else 0,
                "selected_option_id": str(option.id) if option else str(answer.option_id),
                "selected_option_label": option.label if option else "Selected option unavailable",
                "options": [
                    {
                        "id": str(question_option.id),
                        "label": question_option.label,
                        "score_value": question_option.score_value,
                        "sort_order": question_option.sort_order,
                        "selected": option is not None and question_option.id == option.id,
                    }
                    for question_option in live_options
                ],
            }
        )

    items.sort(key=lambda item: (item["sort_order"], item["question_id"]))

    return {
        "assessment_id": str(assessment.id),
        "completed_at": assessment.completed_at.isoformat() if assessment.completed_at else None,
        "answers": items,
    }


async def list_user_assessments(
    db: AsyncSession,
    *,
    user_id: UUID,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    result = await db.execute(
        select(RiskProfileAssessment)
        .where(RiskProfileAssessment.user_id == user_id)
        .order_by(
            RiskProfileAssessment.completed_at.desc(),
            RiskProfileAssessment.id.desc(),
        )
        .limit(limit)
        .offset(offset)
    )
    assessments = result.scalars().all()
    if not assessments:
        return {"items": [], "limit": limit, "offset": offset}

    assessment_ids = [row.id for row in assessments]
    counts_result = await db.execute(
        select(RiskProfileAnswer.assessment_id, func.count())
        .where(RiskProfileAnswer.assessment_id.in_(assessment_ids))
        .group_by(RiskProfileAnswer.assessment_id)
    )
    answer_counts = {assessment_id: count for assessment_id, count in counts_result.all()}

    items: list[dict[str, Any]] = []
    for assessment in assessments:
        tier_row = await resolve_tier_for_score(db, assessment.score)
        question_count = answer_counts.get(assessment.id, 0)
        items.append(
            {
                "assessment_id": str(assessment.id),
                "score": assessment.score,
                "display_score": display_score(assessment.score),
                "tier": assessment.tier.value,
                "tier_config": serialize_tier(tier_row),
                "completed_at": assessment.completed_at.isoformat() if assessment.completed_at else None,
                "questions_answered": question_count,
                "total_questions": question_count,
            }
        )

    return {"items": items, "limit": limit, "offset": offset}


async def list_user_risk_profiles(
    db: AsyncSession,
    *,
    tier: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    from app.application.admin.user_admin_service import _display_name
    from app.application.documents.profile_image_url_service import resolve_profile_image_urls_by_user_id

    stats_subq = (
        select(
            RiskProfileAssessment.user_id.label("user_id"),
            func.count(RiskProfileAssessment.id).label("assessment_count"),
            func.max(RiskProfileAssessment.completed_at).label("latest_completed_at"),
        )
        .group_by(RiskProfileAssessment.user_id)
        .subquery()
    )

    query = (
        select(User, UserRiskProfile, stats_subq.c.assessment_count, stats_subq.c.latest_completed_at)
        .join(stats_subq, stats_subq.c.user_id == User.id)
        .outerjoin(UserRiskProfile, UserRiskProfile.user_id == User.id)
        .order_by(stats_subq.c.latest_completed_at.desc())
    )
    if tier:
        query = query.where(UserRiskProfile.tier == RiskTier(tier))
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    rows = result.all()

    user_ids = [user.id for user, _, _, _ in rows]
    profile_image_urls = await resolve_profile_image_urls_by_user_id(db, user_ids)

    items: list[dict[str, Any]] = []
    for user, profile, assessment_count, latest_completed_at in rows:
        items.append(
            {
                "user_id": str(user.id),
                "client_id": user.client_id,
                "email": user.email,
                "display_name": _display_name(user),
                "profile_image_url": profile_image_urls.get(user.id),
                "assessment_count": int(assessment_count or 0),
                "score": profile.score if profile else 0,
                "tier": profile.tier.value if profile else "moderate",
                "assessment_id": str(profile.assessment_id) if profile else "",
                "computed_at": profile.computed_at.isoformat() if profile and profile.computed_at else None,
                "updated_at": (
                    latest_completed_at.isoformat()
                    if latest_completed_at
                    else (profile.updated_at.isoformat() if profile and profile.updated_at else None)
                ),
            }
        )

    return {
        "items": items,
        "limit": limit,
        "offset": offset,
    }


async def _load_resolved_answers_from_assessment(
    db: AsyncSession,
    *,
    assessment_id: UUID,
) -> list[tuple[RiskQuestion, RiskQuestionOption]]:
    answers_result = await db.execute(
        select(RiskProfileAnswer).where(RiskProfileAnswer.assessment_id == assessment_id)
    )
    answer_rows = answers_result.scalars().all()
    if not answer_rows:
        return []

    question_ids = [row.question_id for row in answer_rows]
    option_ids = [row.option_id for row in answer_rows]
    questions_result = await db.execute(
        select(RiskQuestion)
        .options(
            selectinload(RiskQuestion.options),
            selectinload(RiskQuestion.category),
        )
        .where(RiskQuestion.id.in_(question_ids))
    )
    questions_by_id = {row.id: row for row in questions_result.scalars().unique().all()}
    options_result = await db.execute(select(RiskQuestionOption).where(RiskQuestionOption.id.in_(option_ids)))
    options_by_id = {row.id: row for row in options_result.scalars().all()}

    resolved: list[tuple[RiskQuestion, RiskQuestionOption]] = []
    for answer in answer_rows:
        question = questions_by_id.get(answer.question_id)
        option = options_by_id.get(answer.option_id)
        if question and option:
            resolved.append((question, option))
    return resolved


def _build_scoring_breakdown(
    *,
    category_scores: dict[UUID, float],
    category_weights: dict[UUID, Decimal],
) -> dict[str, Any]:
    categories: list[dict[str, Any]] = []
    active_weights = {
        category_id: float(weight)
        for category_id, weight in category_weights.items()
        if category_id in category_scores and float(weight) > 0
    }
    total_weight = sum(active_weights.values())

    for category_id, normalized_score in sorted(
        category_scores.items(),
        key=lambda item: category_weights.get(item[0], Decimal("0")),
        reverse=True,
    ):
        weight = float(category_weights.get(category_id, Decimal("0")))
        weight_share = (weight / total_weight) if total_weight > 0 and weight > 0 else 0.0
        weighted_contribution = normalized_score * weight_share if weight_share > 0 else 0.0
        categories.append(
            {
                "category_id": str(category_id),
                "weight": weight,
                "normalized_score": round(normalized_score, 2),
                "weight_share": round(weight_share, 4),
                "weighted_contribution": round(weighted_contribution, 2),
            }
        )

    final_score = compute_weighted_score(
        category_scores=category_scores,
        category_weights=category_weights,
    )
    return {
        "final_score": final_score,
        "formula_summary": (
            "Each category score is normalized to 0–1000 from selected option points versus "
            "the maximum possible in that category. The final score is the weight-weighted average "
            "across answered categories."
        ),
        "categories": categories,
    }


async def _enrich_answer_options_with_scores(
    db: AsyncSession,
    answers: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    option_ids: set[UUID] = set()
    for item in answers:
        for opt in item.get("options") or []:
            try:
                option_ids.add(UUID(str(opt["id"])))
            except ValueError:
                continue

    if not option_ids:
        return answers

    result = await db.execute(select(RiskQuestionOption).where(RiskQuestionOption.id.in_(option_ids)))
    options_by_id = {row.id: row for row in result.scalars()}

    enriched: list[dict[str, Any]] = []
    for item in answers:
        next_item = dict(item)
        next_options: list[dict[str, Any]] = []
        for opt in item.get("options") or []:
            try:
                option_row = options_by_id.get(UUID(str(opt["id"])))
            except ValueError:
                option_row = None
            next_options.append(
                {
                    **opt,
                    "score_value": opt.get("score_value", option_row.score_value if option_row else None),
                    "sort_order": opt.get("sort_order", option_row.sort_order if option_row else 0),
                }
            )
        next_options.sort(key=lambda row: (row.get("sort_order") or 0, row.get("label") or ""))
        next_item["options"] = next_options
        enriched.append(next_item)
    return enriched


async def get_assessment_admin_detail(
    db: AsyncSession,
    *,
    user_id: UUID,
    assessment_id: UUID,
) -> dict[str, Any]:
    result = await db.execute(
        select(RiskProfileAssessment).where(
            RiskProfileAssessment.id == assessment_id,
            RiskProfileAssessment.user_id == user_id,
        )
    )
    assessment = result.scalar_one_or_none()
    if not assessment:
        raise RiskProfileError("assessment_not_found", "Assessment not found.", status_code=404)

    answers_payload = await get_assessment_answers(
        db,
        user_id=user_id,
        assessment_id=assessment_id,
    )
    resolved = await _load_resolved_answers_from_assessment(db, assessment_id=assessment_id)
    category_scores = build_category_scores(answers=resolved) if resolved else {}
    if not category_scores:
        metadata_scores = (assessment.metadata_ or {}).get("category_scores") or {}
        category_scores = {UUID(str(key)): float(value) for key, value in metadata_scores.items()}

    category_ids = set(category_scores.keys())
    weights_result = await db.execute(
        select(RiskQuestionCategory).where(RiskQuestionCategory.id.in_(category_ids))
    )
    categories_by_id = {row.id: row for row in weights_result.scalars().all()}
    category_weights = {category_id: categories_by_id[category_id].weight for category_id in category_ids if category_id in categories_by_id}

    scoring = _build_scoring_breakdown(
        category_scores=category_scores,
        category_weights=category_weights,
    )
    for row in scoring["categories"]:
        category = categories_by_id.get(UUID(row["category_id"]))
        row["category_name"] = category.name if category else "Category"
        row["questions_answered"] = sum(
            1 for question, _ in resolved if str(question.category_id) == row["category_id"]
        )

    tier_row = await resolve_tier_for_score(db, assessment.score)
    enriched_answers = await _enrich_answer_options_with_scores(db, answers_payload["answers"])
    return {
        "user_id": str(user_id),
        "assessment_id": str(assessment.id),
        "score": assessment.score,
        "display_score": display_score(assessment.score),
        "tier": assessment.tier.value,
        "tier_config": serialize_tier(tier_row),
        "completed_at": assessment.completed_at.isoformat() if assessment.completed_at else None,
        "questions_answered": len(enriched_answers),
        "total_questions": len(enriched_answers),
        "answers": enriched_answers,
        "scoring": scoring,
    }
