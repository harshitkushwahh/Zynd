from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.goals.constants import (
    MAX_ACTIVE_PERSONAL_GOALS,
    MAX_GOAL_PRIORITY,
    MAX_GOAL_TAG_LENGTH,
    MAX_GOAL_TITLE_LENGTH,
    MAX_TARGET_AMOUNT_INR,
    MIN_GOAL_PRIORITY,
)
from app.application.goals.errors import GoalError
from app.application.goals.goal_calculator_service import calculate_goal_plan
from app.application.goals.goal_portfolio_service import enrich_goal_payload, validate_linked_product
from app.application.goals.goal_template_service import serialize_goal_template
from app.infrastructure.persistence.goal_models import Goal, GoalStatus, GoalTemplate


def _decimal(value: float | Decimal | str) -> Decimal:
    return Decimal(str(value))


def _compute_progress_pct(*, current: Decimal, target: Decimal) -> float:
    if target <= 0:
        return 0.0
    pct = (current / target * Decimal("100")).quantize(Decimal("0.01"))
    return float(min(pct, Decimal("100")))


def serialize_goal(goal: Goal) -> dict[str, Any]:
    template_payload = serialize_goal_template(goal.template) if goal.template else None
    progress_pct = _compute_progress_pct(current=goal.current_amount_inr, target=goal.target_amount_inr)
    return {
        "id": str(goal.id),
        "user_id": str(goal.user_id),
        "family_group_id": str(goal.family_group_id) if goal.family_group_id else None,
        "template_id": str(goal.template_id) if goal.template_id else None,
        "template": template_payload,
        "title": goal.title,
        "tag": goal.tag,
        "priority": goal.priority,
        "target_amount_inr": float(goal.target_amount_inr),
        "target_date": goal.target_date.isoformat(),
        "current_amount_inr": float(goal.current_amount_inr),
        "existing_savings_inr": float(goal.existing_savings_inr),
        "expected_return_pct": float(goal.expected_return_pct)
        if goal.expected_return_pct is not None
        else None,
        "status": goal.status.value,
        "progress_pct": progress_pct,
        "linked_product_id": str(goal.linked_product_id) if goal.linked_product_id else None,
        "created_at": goal.created_at.isoformat() if goal.created_at else None,
        "updated_at": goal.updated_at.isoformat() if goal.updated_at else None,
    }


async def _count_active_personal_goals(db: AsyncSession, *, user_id: UUID) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(Goal)
        .where(
            Goal.user_id == user_id,
            Goal.family_group_id.is_(None),
            Goal.status.in_([GoalStatus.draft, GoalStatus.active, GoalStatus.paused]),
        )
    )
    return int(result.scalar_one())


async def _get_user_goal(db: AsyncSession, *, goal_id: UUID, user_id: UUID) -> Goal:
    result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.template))
        .where(Goal.id == goal_id, Goal.user_id == user_id)
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise GoalError(code="goal_not_found", message="Goal not found.", status_code=404)
    return goal


def _validate_title(title: str) -> str:
    cleaned = title.strip()
    if not cleaned:
        raise GoalError(code="invalid_title", message="Goal title is required.")
    if len(cleaned) > MAX_GOAL_TITLE_LENGTH:
        raise GoalError(
            code="invalid_title",
            message=f"Goal title must be at most {MAX_GOAL_TITLE_LENGTH} characters.",
        )
    return cleaned


def _validate_tag(tag: str | None) -> str | None:
    if tag is None:
        return None
    cleaned = tag.strip()
    if not cleaned:
        return None
    if len(cleaned) > MAX_GOAL_TAG_LENGTH:
        raise GoalError(
            code="invalid_tag",
            message=f"Goal tag must be at most {MAX_GOAL_TAG_LENGTH} characters.",
        )
    return cleaned


def _validate_priority(priority: int) -> int:
    if priority < MIN_GOAL_PRIORITY or priority > MAX_GOAL_PRIORITY:
        raise GoalError(
            code="invalid_priority",
            message=f"Priority must be between {MIN_GOAL_PRIORITY} and {MAX_GOAL_PRIORITY}.",
        )
    return priority


async def list_personal_goals(
    db: AsyncSession,
    *,
    user_id: UUID,
    include_archived: bool = False,
) -> list[dict[str, Any]]:
    query = (
        select(Goal)
        .options(selectinload(Goal.template))
        .where(Goal.user_id == user_id, Goal.family_group_id.is_(None))
        .order_by(Goal.priority.asc(), Goal.target_date.asc(), Goal.created_at.desc())
    )
    if not include_archived:
        query = query.where(Goal.status != GoalStatus.archived)
    result = await db.execute(query)
    goals = list(result.scalars().all())
    payloads: list[dict[str, Any]] = []
    for goal in goals:
        payload = serialize_goal(goal)
        payloads.append(await enrich_goal_payload(db, goal, payload))
    return payloads


async def get_personal_goal(db: AsyncSession, *, goal_id: UUID, user_id: UUID) -> dict[str, Any]:
    goal = await _get_user_goal(db, goal_id=goal_id, user_id=user_id)
    payload = serialize_goal(goal)
    return await enrich_goal_payload(db, goal, payload)


async def create_personal_goal(
    db: AsyncSession,
    *,
    user_id: UUID,
    title: str,
    target_amount_inr: float,
    target_date: date,
    template_id: UUID | None = None,
    tag: str | None = None,
    priority: int = 3,
    existing_savings_inr: float = 0,
    expected_return_pct: float | None = None,
    status: GoalStatus = GoalStatus.active,
    linked_product_id: UUID | None = None,
) -> dict[str, Any]:
    active_count = await _count_active_personal_goals(db, user_id=user_id)
    if active_count >= MAX_ACTIVE_PERSONAL_GOALS:
        raise GoalError(
            code="goal_limit_reached",
            message=f"You can have at most {MAX_ACTIVE_PERSONAL_GOALS} active personal goals.",
            status_code=409,
        )

    cleaned_title = _validate_title(title)
    cleaned_tag = _validate_tag(tag)
    validated_priority = _validate_priority(priority)
    target = _decimal(target_amount_inr)
    savings = _decimal(existing_savings_inr)

    if target <= 0 or target > MAX_TARGET_AMOUNT_INR:
        raise GoalError(code="invalid_target", message="Target amount is out of allowed range.")

    template: GoalTemplate | None = None
    if template_id is not None:
        template = await db.get(GoalTemplate, template_id)
        if not template or not template.is_active:
            raise GoalError(code="template_not_found", message="Goal template not found.", status_code=404)

    if linked_product_id is not None:
        await validate_linked_product(db, product_id=linked_product_id)

    calculate_goal_plan(
        target_amount_inr=target,
        target_date=target_date,
        existing_savings_inr=savings,
        expected_return_pct=_decimal(expected_return_pct) if expected_return_pct is not None else None,
    )

    goal = Goal(
        user_id=user_id,
        template_id=template.id if template else None,
        title=cleaned_title if not template else cleaned_title or template.name,
        tag=cleaned_tag,
        priority=validated_priority,
        target_amount_inr=target,
        target_date=target_date,
        current_amount_inr=savings,
        existing_savings_inr=savings,
        expected_return_pct=_decimal(expected_return_pct)
        if expected_return_pct is not None
        else (template.suggested_return_pct if template else None),
        status=status,
        linked_product_id=linked_product_id,
    )
    db.add(goal)
    await db.flush()
    result = await db.execute(
        select(Goal).options(selectinload(Goal.template)).where(Goal.id == goal.id)
    )
    created = result.scalar_one()
    payload = serialize_goal(created)
    return await enrich_goal_payload(db, created, payload)


async def update_personal_goal(
    db: AsyncSession,
    *,
    goal_id: UUID,
    user_id: UUID,
    title: str | None = None,
    tag: str | None = None,
    priority: int | None = None,
    target_amount_inr: float | None = None,
    target_date: date | None = None,
    existing_savings_inr: float | None = None,
    expected_return_pct: float | None = None,
    current_amount_inr: float | None = None,
    status: GoalStatus | None = None,
    linked_product_id: UUID | None = None,
    clear_linked_product: bool = False,
) -> dict[str, Any]:
    goal = await _get_user_goal(db, goal_id=goal_id, user_id=user_id)
    if goal.family_group_id is not None:
        raise GoalError(
            code="family_goal_not_supported",
            message="Family goals must be updated through family group goal endpoints.",
            status_code=400,
        )

    if title is not None:
        goal.title = _validate_title(title)
    if tag is not None:
        goal.tag = _validate_tag(tag)
    if priority is not None:
        goal.priority = _validate_priority(priority)
    if target_amount_inr is not None:
        target = _decimal(target_amount_inr)
        if target <= 0 or target > MAX_TARGET_AMOUNT_INR:
            raise GoalError(code="invalid_target", message="Target amount is out of allowed range.")
        goal.target_amount_inr = target
    if target_date is not None:
        goal.target_date = target_date
    if existing_savings_inr is not None:
        savings = _decimal(existing_savings_inr)
        if savings < 0:
            raise GoalError(code="invalid_savings", message="Existing savings cannot be negative.")
        goal.existing_savings_inr = savings
    if current_amount_inr is not None:
        current = _decimal(current_amount_inr)
        if current < 0:
            raise GoalError(code="invalid_current", message="Current amount cannot be negative.")
        goal.current_amount_inr = current
    if expected_return_pct is not None:
        rate = _decimal(expected_return_pct)
        if rate < 0 or rate > 100:
            raise GoalError(code="invalid_return", message="Expected return must be between 0 and 100.")
        goal.expected_return_pct = rate
    if status is not None:
        goal.status = status
    if clear_linked_product:
        goal.linked_product_id = None
    elif linked_product_id is not None:
        await validate_linked_product(db, product_id=linked_product_id)
        goal.linked_product_id = linked_product_id

    calculate_goal_plan(
        target_amount_inr=goal.target_amount_inr,
        target_date=goal.target_date,
        existing_savings_inr=goal.existing_savings_inr,
        expected_return_pct=goal.expected_return_pct,
    )

    await db.flush()
    result = await db.execute(
        select(Goal).options(selectinload(Goal.template)).where(Goal.id == goal.id)
    )
    updated = result.scalar_one()
    payload = serialize_goal(updated)
    return await enrich_goal_payload(db, updated, payload)


async def archive_personal_goal(db: AsyncSession, *, goal_id: UUID, user_id: UUID) -> dict[str, Any]:
    goal = await _get_user_goal(db, goal_id=goal_id, user_id=user_id)
    goal.status = GoalStatus.archived
    await db.flush()
    result = await db.execute(
        select(Goal).options(selectinload(Goal.template)).where(Goal.id == goal.id)
    )
    return serialize_goal(result.scalar_one())


async def restore_personal_goal(db: AsyncSession, *, goal_id: UUID, user_id: UUID) -> dict[str, Any]:
    goal = await _get_user_goal(db, goal_id=goal_id, user_id=user_id)
    if goal.status != GoalStatus.archived:
        raise GoalError(
            code="not_archived",
            message="Only archived goals can be restored.",
            status_code=409,
        )

    active_count = await _count_active_personal_goals(db, user_id=user_id)
    if active_count >= MAX_ACTIVE_PERSONAL_GOALS:
        raise GoalError(
            code="goal_limit_reached",
            message=f"You can have at most {MAX_ACTIVE_PERSONAL_GOALS} active personal goals.",
            status_code=409,
        )

    goal.status = GoalStatus.active
    await db.flush()
    result = await db.execute(
        select(Goal).options(selectinload(Goal.template)).where(Goal.id == goal.id)
    )
    updated = result.scalar_one()
    payload = serialize_goal(updated)
    return await enrich_goal_payload(db, updated, payload)


async def delete_personal_goal(db: AsyncSession, *, goal_id: UUID, user_id: UUID) -> None:
    goal = await _get_user_goal(db, goal_id=goal_id, user_id=user_id)
    if goal.status != GoalStatus.archived:
        raise GoalError(
            code="not_archived",
            message="Only archived goals can be permanently deleted.",
            status_code=409,
        )
    await db.delete(goal)
    await db.flush()
