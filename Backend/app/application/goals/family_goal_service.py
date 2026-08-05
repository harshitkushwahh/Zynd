from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.family_groups.activity_service import record_family_group_activity
from app.application.family_groups.display import require_group_head, require_group_member, resolve_member_display_name
from app.application.goals.constants import (
    MAX_ACTIVE_FAMILY_GOALS_PER_GROUP,
    MAX_GOAL_PRIORITY,
    MAX_GOAL_TAG_LENGTH,
    MAX_GOAL_TITLE_LENGTH,
    MAX_TARGET_AMOUNT_INR,
    MIN_GOAL_PRIORITY,
)
from app.application.goals.errors import GoalError
from app.application.goals.goal_calculator_service import calculate_goal_plan
from app.application.goals.goal_portfolio_service import enrich_goal_payload
from app.application.goals.goal_service import (
    _decimal,
    _validate_priority,
    _validate_tag,
    _validate_title,
    serialize_goal,
)
from app.application.goals.permissions import (
    can_contribute_to_family_goal,
    can_create_family_goal,
    can_manage_family_goal,
    can_view_family_goals,
)
from app.infrastructure.persistence.family_group_models import (
    FamilyGroupActivityType,
    FamilyGroupMember,
    FamilyGroupMemberStatus,
)
from app.infrastructure.persistence.goal_models import (
    Goal,
    GoalContribution,
    GoalContributionSourceType,
    GoalStatus,
    GoalTemplate,
)
from app.infrastructure.persistence.models import User


async def count_active_family_goals(db: AsyncSession, *, group_id: UUID) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(Goal)
        .where(
            Goal.family_group_id == group_id,
            Goal.status.in_([GoalStatus.draft, GoalStatus.active, GoalStatus.paused]),
        )
    )
    return int(result.scalar_one())


async def _get_family_goal(
    db: AsyncSession,
    *,
    group_id: UUID,
    goal_id: UUID,
) -> Goal:
    result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.template))
        .where(Goal.id == goal_id, Goal.family_group_id == group_id)
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise GoalError(code="goal_not_found", message="Family goal not found.", status_code=404)
    return goal


async def _contribution_total(db: AsyncSession, *, goal_id: UUID) -> Decimal:
    result = await db.execute(
        select(func.coalesce(func.sum(GoalContribution.amount_inr), 0)).where(
            GoalContribution.goal_id == goal_id
        )
    )
    return Decimal(str(result.scalar_one()))


async def _refresh_goal_current_amount(db: AsyncSession, goal: Goal) -> None:
    contributed = await _contribution_total(db, goal_id=goal.id)
    goal.current_amount_inr = _decimal(goal.existing_savings_inr) + contributed
    await db.flush()


def _serialize_family_goal(goal: Goal, *, contribution_total: Decimal | None = None) -> dict[str, Any]:
    payload = serialize_goal(goal)
    payload["created_by_user_id"] = str(goal.created_by_user_id) if goal.created_by_user_id else None
    if contribution_total is not None:
        payload["contribution_total_inr"] = float(contribution_total)
    return payload


async def _serialize_family_goal_enriched(
    db: AsyncSession,
    goal: Goal,
    *,
    contribution_total: Decimal | None = None,
) -> dict[str, Any]:
    payload = _serialize_family_goal(goal, contribution_total=contribution_total)
    return await enrich_goal_payload(db, goal, payload)


async def list_family_goals(
    db: AsyncSession,
    *,
    group_id: UUID,
    user_id: UUID,
    include_archived: bool = False,
) -> list[dict[str, Any]]:
    _, membership = await require_group_member(db, group_id=group_id, user_id=user_id)
    if not can_view_family_goals(membership.role):
        raise GoalError(code="forbidden", message="You cannot view family goals.", status_code=403)

    query = (
        select(Goal)
        .options(selectinload(Goal.template))
        .where(Goal.family_group_id == group_id)
        .order_by(Goal.priority.asc(), Goal.target_date.asc(), Goal.created_at.desc())
    )
    if not include_archived:
        query = query.where(Goal.status != GoalStatus.archived)

    goals = list((await db.execute(query)).scalars().all())
    if not goals:
        return []

    goal_ids = [goal.id for goal in goals]
    totals_result = await db.execute(
        select(GoalContribution.goal_id, func.coalesce(func.sum(GoalContribution.amount_inr), 0))
        .where(GoalContribution.goal_id.in_(goal_ids))
        .group_by(GoalContribution.goal_id)
    )
    totals = {row[0]: Decimal(str(row[1])) for row in totals_result.all()}

    items: list[dict[str, Any]] = []
    for goal in goals:
        items.append(
            await _serialize_family_goal_enriched(
                db,
                goal,
                contribution_total=totals.get(goal.id, Decimal("0")),
            )
        )
    return items


async def get_family_goal(
    db: AsyncSession,
    *,
    group_id: UUID,
    goal_id: UUID,
    user_id: UUID,
) -> dict[str, Any]:
    _, membership = await require_group_member(db, group_id=group_id, user_id=user_id)
    if not can_view_family_goals(membership.role):
        raise GoalError(code="forbidden", message="You cannot view family goals.", status_code=403)

    goal = await _get_family_goal(db, group_id=group_id, goal_id=goal_id)
    contribution_total = await _contribution_total(db, goal_id=goal.id)
    return await _serialize_family_goal_enriched(db, goal, contribution_total=contribution_total)


async def create_family_goal(
    db: AsyncSession,
    *,
    group_id: UUID,
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
) -> dict[str, Any]:
    _, membership = await require_group_head(db, group_id=group_id, user_id=user_id)
    if not can_create_family_goal(membership.role):
        raise GoalError(code="forbidden", message="Only the group head can create family goals.", status_code=403)

    active_count = await count_active_family_goals(db, group_id=group_id)
    if active_count >= MAX_ACTIVE_FAMILY_GOALS_PER_GROUP:
        raise GoalError(
            code="goal_limit_reached",
            message=f"This group can have at most {MAX_ACTIVE_FAMILY_GOALS_PER_GROUP} active family goals.",
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

    calculate_goal_plan(
        target_amount_inr=target,
        target_date=target_date,
        existing_savings_inr=savings,
        expected_return_pct=_decimal(expected_return_pct) if expected_return_pct is not None else None,
    )

    goal = Goal(
        user_id=user_id,
        family_group_id=group_id,
        created_by_user_id=user_id,
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
    )
    db.add(goal)
    await db.flush()

    await record_family_group_activity(
        db,
        group_id=group_id,
        event_type=FamilyGroupActivityType.goal_created,
        actor_user_id=user_id,
        metadata={"goal_id": str(goal.id), "goal_title": goal.title, "target_amount_inr": float(target)},
    )

    result = await db.execute(
        select(Goal).options(selectinload(Goal.template)).where(Goal.id == goal.id)
    )
    return await _serialize_family_goal_enriched(db, result.scalar_one(), contribution_total=Decimal("0"))


async def update_family_goal(
    db: AsyncSession,
    *,
    group_id: UUID,
    goal_id: UUID,
    user_id: UUID,
    title: str | None = None,
    tag: str | None = None,
    priority: int | None = None,
    target_amount_inr: float | None = None,
    target_date: date | None = None,
    existing_savings_inr: float | None = None,
    expected_return_pct: float | None = None,
    status: GoalStatus | None = None,
) -> dict[str, Any]:
    _, membership = await require_group_head(db, group_id=group_id, user_id=user_id)
    if not can_manage_family_goal(membership.role):
        raise GoalError(code="forbidden", message="Only the group head can update family goals.", status_code=403)

    goal = await _get_family_goal(db, group_id=group_id, goal_id=goal_id)

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
    if expected_return_pct is not None:
        rate = _decimal(expected_return_pct)
        if rate < 0 or rate > 100:
            raise GoalError(code="invalid_return", message="Expected return must be between 0 and 100.")
        goal.expected_return_pct = rate
    if status is not None:
        goal.status = status

    calculate_goal_plan(
        target_amount_inr=goal.target_amount_inr,
        target_date=goal.target_date,
        existing_savings_inr=goal.existing_savings_inr,
        expected_return_pct=goal.expected_return_pct,
    )

    await _refresh_goal_current_amount(db, goal)

    await record_family_group_activity(
        db,
        group_id=group_id,
        event_type=FamilyGroupActivityType.goal_updated,
        actor_user_id=user_id,
        metadata={"goal_id": str(goal.id), "goal_title": goal.title},
    )

    result = await db.execute(
        select(Goal).options(selectinload(Goal.template)).where(Goal.id == goal.id)
    )
    contribution_total = await _contribution_total(db, goal_id=goal.id)
    return await _serialize_family_goal_enriched(db, result.scalar_one(), contribution_total=contribution_total)


async def archive_family_goal(
    db: AsyncSession,
    *,
    group_id: UUID,
    goal_id: UUID,
    user_id: UUID,
) -> dict[str, Any]:
    _, membership = await require_group_head(db, group_id=group_id, user_id=user_id)
    if not can_manage_family_goal(membership.role):
        raise GoalError(code="forbidden", message="Only the group head can archive family goals.", status_code=403)

    goal = await _get_family_goal(db, group_id=group_id, goal_id=goal_id)
    goal.status = GoalStatus.archived
    await db.flush()

    await record_family_group_activity(
        db,
        group_id=group_id,
        event_type=FamilyGroupActivityType.goal_archived,
        actor_user_id=user_id,
        metadata={"goal_id": str(goal.id), "goal_title": goal.title},
    )

    result = await db.execute(
        select(Goal).options(selectinload(Goal.template)).where(Goal.id == goal.id)
    )
    contribution_total = await _contribution_total(db, goal_id=goal.id)
    return await _serialize_family_goal_enriched(db, result.scalar_one(), contribution_total=contribution_total)


async def add_family_goal_contribution(
    db: AsyncSession,
    *,
    group_id: UUID,
    goal_id: UUID,
    user_id: UUID,
    amount_inr: float,
    note: str | None = None,
) -> dict[str, Any]:
    _, membership = await require_group_member(db, group_id=group_id, user_id=user_id)
    if not can_contribute_to_family_goal(membership.role):
        raise GoalError(
            code="forbidden",
            message="Only the group head and contributors can add contributions.",
            status_code=403,
        )

    goal = await _get_family_goal(db, group_id=group_id, goal_id=goal_id)
    if goal.status == GoalStatus.archived:
        raise GoalError(code="goal_archived", message="Cannot contribute to an archived goal.", status_code=409)

    amount = _decimal(amount_inr)
    if amount <= 0 or amount > MAX_TARGET_AMOUNT_INR:
        raise GoalError(code="invalid_amount", message="Contribution amount is out of allowed range.")

    cleaned_note = note.strip() if note else None
    if cleaned_note and len(cleaned_note) > 120:
        raise GoalError(code="invalid_note", message="Note must be at most 120 characters.")

    contribution = GoalContribution(
        goal_id=goal.id,
        user_id=user_id,
        amount_inr=amount,
        source_type=GoalContributionSourceType.manual,
        note=cleaned_note,
    )
    db.add(contribution)
    await db.flush()
    await _refresh_goal_current_amount(db, goal)

    await record_family_group_activity(
        db,
        group_id=group_id,
        event_type=FamilyGroupActivityType.goal_contribution_added,
        actor_user_id=user_id,
        metadata={
            "goal_id": str(goal.id),
            "goal_title": goal.title,
            "amount_inr": float(amount),
            "contribution_id": str(contribution.id),
        },
    )

    return await get_family_goal_contributions(db, group_id=group_id, goal_id=goal_id, user_id=user_id)


async def get_family_goal_contributions(
    db: AsyncSession,
    *,
    group_id: UUID,
    goal_id: UUID,
    user_id: UUID,
) -> dict[str, Any]:
    _, membership = await require_group_member(db, group_id=group_id, user_id=user_id)
    if not can_view_family_goals(membership.role):
        raise GoalError(code="forbidden", message="You cannot view family goal contributions.", status_code=403)

    goal = await _get_family_goal(db, group_id=group_id, goal_id=goal_id)

    contributions = list(
        (
            await db.execute(
                select(GoalContribution)
                .where(GoalContribution.goal_id == goal.id)
                .order_by(GoalContribution.contributed_at.desc(), GoalContribution.id.desc())
            )
        ).scalars().all()
    )

    user_ids = {row.user_id for row in contributions}
    display_names: dict[UUID, str] = {}
    if user_ids:
        member_rows = list(
            (
                await db.execute(
                    select(FamilyGroupMember, User)
                    .join(User, User.id == FamilyGroupMember.user_id)
                    .where(
                        FamilyGroupMember.group_id == group_id,
                        FamilyGroupMember.user_id.in_(user_ids),
                        FamilyGroupMember.status == FamilyGroupMemberStatus.active,
                    )
                )
            ).all()
        )
        for member, user_row in member_rows:
            display_names[user_row.id] = resolve_member_display_name(member, user_row)

    member_totals: dict[UUID, dict[str, Any]] = {}
    for row in contributions:
        bucket = member_totals.setdefault(
            row.user_id,
            {
                "user_id": str(row.user_id),
                "display_name": display_names.get(row.user_id, "Member"),
                "total_inr": Decimal("0"),
                "contribution_count": 0,
            },
        )
        bucket["total_inr"] = Decimal(str(bucket["total_inr"])) + row.amount_inr
        bucket["contribution_count"] += 1

    total_contributed = sum((row.amount_inr for row in contributions), Decimal("0"))

    return {
        "goal_id": str(goal.id),
        "total_contributed_inr": float(total_contributed),
        "member_totals": [
            {
                "user_id": item["user_id"],
                "display_name": item["display_name"],
                "total_inr": float(item["total_inr"]),
                "contribution_count": item["contribution_count"],
            }
            for item in sorted(member_totals.values(), key=lambda entry: entry["total_inr"], reverse=True)
        ],
        "items": [
            {
                "id": str(row.id),
                "user_id": str(row.user_id),
                "display_name": display_names.get(row.user_id, "Member"),
                "amount_inr": float(row.amount_inr),
                "source_type": row.source_type.value,
                "note": row.note,
                "contributed_at": row.contributed_at.isoformat() if row.contributed_at else None,
            }
            for row in contributions
        ],
    }
