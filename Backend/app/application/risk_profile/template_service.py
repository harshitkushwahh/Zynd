from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.auth.audit_service import write_audit
from app.application.risk_profile.category_service import _get_category_or_raise
from app.application.risk_profile.errors import RiskProfileError
from app.application.risk_profile.question_service import serialize_question
from app.application.risk_profile.scoring_service import get_user_risk_profile
from app.infrastructure.persistence.models import AuditEventType, User
from app.infrastructure.persistence.risk_profile_models import (
    RiskProfileTemplate,
    RiskProfileTemplateRule,
    RiskQuestion,
    RiskQuestionCategory,
    RiskTemplateSelectionMode,
    RiskTier,
)

DEFAULT_TEMPLATE_SEED = [
    {
        "name": "Quick assessment",
        "description": "Short questionnaire for refreshes and quick onboarding.",
        "is_default": False,
        "selection_mode": RiskTemplateSelectionMode.auto,
        "sort_order": 2,
        "rules": [],
    },
    {
        "name": "Standard assessment",
        "description": "Balanced questionnaire covering all active categories.",
        "is_default": True,
        "selection_mode": RiskTemplateSelectionMode.manual,
        "sort_order": 1,
        "rules": [],
    },
]


def _template_snapshot(template: RiskProfileTemplate) -> dict[str, Any]:
    return {
        "id": str(template.id),
        "name": template.name,
        "description": template.description,
        "is_default": template.is_default,
        "is_active": template.is_active,
        "selection_mode": template.selection_mode.value,
        "sort_order": template.sort_order,
        "rules": [
            {
                "category_id": str(rule.category_id),
                "category_slug": rule.category.slug if rule.category else None,
                "category_name": rule.category.name if rule.category else None,
                "question_count": rule.question_count,
                "sort_order": rule.sort_order,
            }
            for rule in template.rules
        ],
    }


def serialize_template(template: RiskProfileTemplate) -> dict[str, Any]:
    total_questions = sum(rule.question_count for rule in template.rules)
    return {
        **_template_snapshot(template),
        "total_questions": total_questions,
        "created_at": template.created_at.isoformat() if template.created_at else None,
        "updated_at": template.updated_at.isoformat() if template.updated_at else None,
    }


async def ensure_risk_template_seed(db: AsyncSession) -> None:
    result = await db.execute(select(RiskProfileTemplate))
    if result.scalars().first():
        return

    categories = await db.execute(
        select(RiskQuestionCategory).where(RiskQuestionCategory.is_active.is_(True)).order_by(RiskQuestionCategory.sort_order)
    )
    active_categories = list(categories.scalars().all())
    if not active_categories:
        return

    per_category = max(1, min(2, 12 // max(len(active_categories), 1)))

    for item in DEFAULT_TEMPLATE_SEED:
        template = RiskProfileTemplate(
            name=item["name"],
            description=item["description"],
            is_default=item["is_default"],
            is_active=True,
            selection_mode=item["selection_mode"],
            sort_order=item["sort_order"],
        )
        db.add(template)
        await db.flush()

        question_count = 1 if item["name"] == "Quick assessment" else per_category
        for index, category in enumerate(active_categories):
            db.add(
                RiskProfileTemplateRule(
                    template_id=template.id,
                    category_id=category.id,
                    question_count=question_count,
                    sort_order=index,
                )
            )
    await db.flush()


async def _get_template_or_raise(db: AsyncSession, template_id: UUID) -> RiskProfileTemplate:
    result = await db.execute(
        select(RiskProfileTemplate)
        .options(
            selectinload(RiskProfileTemplate.rules).selectinload(RiskProfileTemplateRule.category),
        )
        .where(RiskProfileTemplate.id == template_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise RiskProfileError("template_not_found", "Risk profile template not found.", status_code=404)
    return row


async def _clear_default_template(db: AsyncSession, *, except_id: UUID | None = None) -> None:
    query = update(RiskProfileTemplate).values(is_default=False)
    if except_id is not None:
        query = query.where(RiskProfileTemplate.id != except_id)
    await db.execute(query)


async def _category_question_counts(db: AsyncSession) -> dict[UUID, int]:
    result = await db.execute(
        select(RiskQuestion.category_id, RiskQuestion.id).where(RiskQuestion.is_active.is_(True))
    )
    counts: dict[UUID, int] = {}
    for category_id, _ in result.all():
        counts[category_id] = counts.get(category_id, 0) + 1
    return counts


def _template_is_feasible(template: RiskProfileTemplate, category_counts: dict[UUID, int]) -> bool:
    if not template.rules:
        return False
    for rule in template.rules:
        available = category_counts.get(rule.category_id, 0)
        if available < rule.question_count:
            return False
    return True


def _template_total_questions(template: RiskProfileTemplate) -> int:
    return sum(rule.question_count for rule in template.rules)


async def list_templates(db: AsyncSession, *, include_inactive: bool = False) -> list[dict[str, Any]]:
    query = (
        select(RiskProfileTemplate)
        .options(selectinload(RiskProfileTemplate.rules).selectinload(RiskProfileTemplateRule.category))
        .order_by(RiskProfileTemplate.sort_order, RiskProfileTemplate.name)
    )
    if not include_inactive:
        query = query.where(RiskProfileTemplate.is_active.is_(True))
    result = await db.execute(query)
    return [serialize_template(row) for row in result.scalars().unique().all()]


async def get_template(db: AsyncSession, template_id: UUID) -> dict[str, Any]:
    row = await _get_template_or_raise(db, template_id)
    return serialize_template(row)


async def create_template(
    db: AsyncSession,
    *,
    name: str,
    description: str | None,
    is_default: bool,
    selection_mode: RiskTemplateSelectionMode,
    sort_order: int,
    rules: list[dict[str, Any]],
    admin: User,
    ip: str | None,
) -> dict[str, Any]:
    trimmed_name = name.strip()
    if not trimmed_name:
        raise RiskProfileError("invalid_template_name", "Template name is required.")
    if not rules:
        raise RiskProfileError("template_rules_required", "At least one category rule is required.")

    if is_default:
        await _clear_default_template(db)

    template = RiskProfileTemplate(
        name=trimmed_name,
        description=description.strip() if description else None,
        is_default=is_default,
        is_active=True,
        selection_mode=selection_mode,
        sort_order=sort_order,
    )
    db.add(template)
    await db.flush()

    for index, rule in enumerate(rules):
        await _get_category_or_raise(db, rule["category_id"])
        if int(rule["question_count"]) < 1:
            raise RiskProfileError("invalid_rule_count", "Each rule needs at least one question.")
        db.add(
            RiskProfileTemplateRule(
                template_id=template.id,
                category_id=rule["category_id"],
                question_count=int(rule["question_count"]),
                sort_order=int(rule.get("sort_order", index)),
            )
        )
    await db.flush()

    created = await _get_template_or_raise(db, template.id)
    await write_audit(
        db,
        event_type=AuditEventType.risk_template_created,
        user_id=admin.id,
        ip=ip,
        metadata={"template": _template_snapshot(created), "admin_id": str(admin.id)},
    )
    return serialize_template(created)


async def update_template(
    db: AsyncSession,
    *,
    template_id: UUID,
    name: str | None,
    description: str | None,
    is_default: bool | None,
    is_active: bool | None,
    selection_mode: RiskTemplateSelectionMode | None,
    sort_order: int | None,
    rules: list[dict[str, Any]] | None,
    admin: User,
    ip: str | None,
) -> dict[str, Any]:
    row = await _get_template_or_raise(db, template_id)
    before = _template_snapshot(row)

    if name is not None:
        trimmed_name = name.strip()
        if not trimmed_name:
            raise RiskProfileError("invalid_template_name", "Template name cannot be empty.")
        row.name = trimmed_name

    if description is not None:
        row.description = description.strip() or None

    if is_default is True:
        await _clear_default_template(db, except_id=template_id)
        row.is_default = True
    elif is_default is False:
        row.is_default = False

    if is_active is not None:
        row.is_active = is_active

    if selection_mode is not None:
        row.selection_mode = selection_mode

    if sort_order is not None:
        row.sort_order = sort_order

    if rules is not None:
        if not rules:
            raise RiskProfileError("template_rules_required", "At least one category rule is required.")
        row.rules.clear()
        await db.flush()
        for index, rule in enumerate(rules):
            await _get_category_or_raise(db, rule["category_id"])
            db.add(
                RiskProfileTemplateRule(
                    template_id=row.id,
                    category_id=rule["category_id"],
                    question_count=int(rule["question_count"]),
                    sort_order=int(rule.get("sort_order", index)),
                )
            )

    await db.flush()
    updated = await _get_template_or_raise(db, template_id)

    await write_audit(
        db,
        event_type=AuditEventType.risk_template_updated,
        user_id=admin.id,
        ip=ip,
        metadata={
            "template_id": str(template_id),
            "before": before,
            "after": _template_snapshot(updated),
            "admin_id": str(admin.id),
        },
    )
    return serialize_template(updated)


async def resolve_template_questions(db: AsyncSession, *, template_id: UUID) -> dict[str, Any]:
    template = await _get_template_or_raise(db, template_id)
    category_counts = await _category_question_counts(db)
    if not _template_is_feasible(template, category_counts):
        raise RiskProfileError(
            "template_not_feasible",
            "Template requires more active questions than are available in one or more categories.",
        )

    questions: list[dict[str, Any]] = []
    for rule in sorted(template.rules, key=lambda item: item.sort_order):
        result = await db.execute(
            select(RiskQuestion)
            .options(selectinload(RiskQuestion.options), selectinload(RiskQuestion.category))
            .where(
                RiskQuestion.category_id == rule.category_id,
                RiskQuestion.is_active.is_(True),
            )
            .order_by(RiskQuestion.sort_order, RiskQuestion.created_at)
            .limit(rule.question_count)
        )
        selected = list(result.scalars().unique().all())
        if len(selected) < rule.question_count:
            raise RiskProfileError(
                "template_not_feasible",
                f"Category '{rule.category.slug}' does not have enough active questions.",
            )
        questions.extend(
            serialize_question(question, active_options_only=True) for question in selected
        )

    return {
        "template": serialize_template(template),
        "questions": questions,
        "total_questions": len(questions),
    }


def _tier_preferred_question_count(tier: RiskTier | None) -> int:
    if tier in {RiskTier.secure, RiskTier.conservative}:
        return 6
    if tier in {RiskTier.moderate, RiskTier.growth}:
        return 10
    if tier == RiskTier.aggressive:
        return 12
    return 10


async def auto_select_template(
    db: AsyncSession,
    *,
    user_id: UUID | None = None,
    target_question_count: int | None = None,
) -> dict[str, Any]:
    templates_result = await db.execute(
        select(RiskProfileTemplate)
        .options(selectinload(RiskProfileTemplate.rules).selectinload(RiskProfileTemplateRule.category))
        .where(RiskProfileTemplate.is_active.is_(True))
        .order_by(RiskProfileTemplate.sort_order, RiskProfileTemplate.name)
    )
    templates = list(templates_result.scalars().unique().all())
    if not templates:
        raise RiskProfileError("template_not_found", "No active risk profile templates are configured.")

    category_counts = await _category_question_counts(db)
    feasible = [template for template in templates if _template_is_feasible(template, category_counts)]
    if not feasible:
        raise RiskProfileError(
            "template_not_feasible",
            "No active template can be satisfied with the current question bank.",
        )

    preferred_count = target_question_count
    if preferred_count is None and user_id is not None:
        profile = await get_user_risk_profile(db, user_id)
        if profile:
            preferred_count = _tier_preferred_question_count(RiskTier(profile["tier"]))
        else:
            preferred_count = 10

    if preferred_count is None:
        preferred_count = 10

    def score_template(template: RiskProfileTemplate) -> tuple[int, int, int]:
        total = _template_total_questions(template)
        distance = abs(total - preferred_count)
        default_bonus = 0 if template.is_default else 1
        auto_bonus = 0 if template.selection_mode == RiskTemplateSelectionMode.auto else 1
        return (distance, default_bonus, auto_bonus)

    best = min(feasible, key=score_template)
    resolved = await resolve_template_questions(db, template_id=best.id)
    return {
        "selection_reason": "closest_question_count",
        "preferred_question_count": preferred_count,
        **resolved,
    }
