from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.family_groups.display import (
    get_active_membership,
    require_group_member,
    resolve_family_group_avatar_url,
)
from app.application.goals.errors import GoalError
from app.application.goals.family_goal_service import _refresh_goal_current_amount
from app.application.goals.permissions import can_contribute_to_family_goal
from app.application.family_groups.activity_service import record_family_group_activity
from app.infrastructure.persistence.family_group_models import (
    FamilyGroup,
    FamilyGroupActivityType,
    FamilyGroupMember,
    FamilyGroupMemberStatus,
    FamilyGroupStatus,
)
from app.infrastructure.persistence.goal_models import (
    Goal,
    GoalContribution,
    GoalContributionSourceType,
    GoalStatus,
)
from app.infrastructure.persistence.mf_transaction_models import MfOrder, MfSipPlan

logger = logging.getLogger(__name__)

from app.application.goals.constants import FAMILY_GOAL_METADATA_KEY


def _parse_goal_id(metadata: dict[str, Any] | None) -> UUID | None:
    if not metadata:
        return None
    raw = metadata.get(FAMILY_GOAL_METADATA_KEY)
    if not raw:
        return None
    try:
        return UUID(str(raw))
    except ValueError:
        return None


def apply_family_goal_metadata(metadata: dict[str, Any] | None, *, family_goal_id: UUID | None) -> dict[str, Any]:
    payload = dict(metadata or {})
    if family_goal_id is None:
        payload.pop(FAMILY_GOAL_METADATA_KEY, None)
        return payload
    payload[FAMILY_GOAL_METADATA_KEY] = str(family_goal_id)
    return payload


async def validate_family_goal_link(
    db: AsyncSession,
    *,
    user_id: UUID,
    family_goal_id: UUID | None,
) -> Goal | None:
    if family_goal_id is None:
        return None
    if not family_goal_id:
        raise GoalError(code="invalid_goal", message="Invalid family goal.", status_code=400)

    goal = await db.get(Goal, family_goal_id)
    if not goal or goal.family_group_id is None:
        raise GoalError(code="goal_not_found", message="Family goal not found.", status_code=404)
    if goal.status == GoalStatus.archived:
        raise GoalError(code="goal_archived", message="Cannot link payment to an archived goal.", status_code=409)

    _, membership = await require_group_member(db, group_id=goal.family_group_id, user_id=user_id)
    if not can_contribute_to_family_goal(membership.role):
        raise GoalError(
            code="forbidden",
            message="Only the group head and contributors can link payments to family goals.",
            status_code=403,
        )
    return goal


async def list_linkable_family_goals(db: AsyncSession, *, user_id: UUID) -> list[dict[str, Any]]:
    from app.infrastructure.persistence.family_group_models import FamilyGroupMemberRole

    result = await db.execute(
        select(Goal, FamilyGroup, FamilyGroupMember)
        .join(FamilyGroup, FamilyGroup.id == Goal.family_group_id)
        .join(
            FamilyGroupMember,
            (FamilyGroupMember.group_id == Goal.family_group_id)
            & (FamilyGroupMember.user_id == user_id)
            & (FamilyGroupMember.status == FamilyGroupMemberStatus.active),
        )
        .where(
            Goal.family_group_id.is_not(None),
            Goal.status.in_([GoalStatus.draft, GoalStatus.active, GoalStatus.paused]),
            FamilyGroup.status == FamilyGroupStatus.active,
            FamilyGroupMember.role.in_([FamilyGroupMemberRole.head, FamilyGroupMemberRole.contributor]),
        )
        .order_by(FamilyGroup.title.asc(), Goal.priority.asc(), Goal.title.asc())
    )

    items: list[dict[str, Any]] = []
    avatar_cache: dict[str, str | None] = {}
    for goal, group, membership in result.all():
        group_id = str(group.id)
        if group_id not in avatar_cache:
            avatar_cache[group_id] = await resolve_family_group_avatar_url(
                db,
                avatar_document_id=group.avatar_document_id,
            )
        items.append(
            {
                "goal_id": str(goal.id),
                "goal_title": goal.title,
                "target_amount_inr": float(goal.target_amount_inr),
                "progress_pct": float(
                    min((goal.current_amount_inr / goal.target_amount_inr * Decimal("100")), Decimal("100"))
                )
                if goal.target_amount_inr > 0
                else 0.0,
                "group_id": group_id,
                "group_title": group.title,
                "group_avatar_url": avatar_cache[group_id],
                "my_role": membership.role.value,
                "can_create_goals": membership.role == FamilyGroupMemberRole.head,
            }
        )
    return items


async def _contribution_exists(
    db: AsyncSession,
    *,
    source_type: GoalContributionSourceType,
    source_id: UUID,
) -> bool:
    existing = await db.scalar(
        select(GoalContribution.id).where(
            GoalContribution.source_type == source_type,
            GoalContribution.source_id == source_id,
        )
    )
    return existing is not None


async def record_contribution_from_order(db: AsyncSession, order: MfOrder) -> GoalContribution | None:
    goal_id = _parse_goal_id(order.metadata_ if isinstance(order.metadata_, dict) else None)
    if not goal_id:
        return None

    if await _contribution_exists(db, source_type=GoalContributionSourceType.lumpsum_order, source_id=order.id):
        return None

    goal = await db.get(Goal, goal_id)
    if not goal or not goal.family_group_id:
        logger.warning("Skipping goal contribution — goal %s not found for order %s", goal_id, order.id)
        return None

    membership = await get_active_membership(db, group_id=goal.family_group_id, user_id=order.user_id)
    if not membership or not can_contribute_to_family_goal(membership.role):
        logger.warning("Skipping goal contribution — user %s cannot contribute to goal %s", order.user_id, goal_id)
        return None

    contribution = GoalContribution(
        goal_id=goal.id,
        user_id=order.user_id,
        amount_inr=order.amount_inr,
        source_type=GoalContributionSourceType.lumpsum_order,
        source_id=order.id,
        note="Lumpsum investment",
    )
    db.add(contribution)
    await db.flush()
    await _refresh_goal_current_amount(db, goal)

    await record_family_group_activity(
        db,
        group_id=goal.family_group_id,
        event_type=FamilyGroupActivityType.goal_contribution_added,
        actor_user_id=order.user_id,
        metadata={
            "goal_id": str(goal.id),
            "goal_title": goal.title,
            "amount_inr": float(order.amount_inr),
            "contribution_id": str(contribution.id),
            "source": "lumpsum_order",
        },
    )
    return contribution


async def record_contribution_from_sip_plan(db: AsyncSession, plan: MfSipPlan) -> GoalContribution | None:
    goal_id = _parse_goal_id(plan.metadata_ if isinstance(plan.metadata_, dict) else None)
    if not goal_id:
        return None

    if await _contribution_exists(db, source_type=GoalContributionSourceType.sip_plan, source_id=plan.id):
        return None

    goal = await db.get(Goal, goal_id)
    if not goal or not goal.family_group_id:
        logger.warning("Skipping goal contribution — goal %s not found for SIP plan %s", goal_id, plan.id)
        return None

    membership = await get_active_membership(db, group_id=goal.family_group_id, user_id=plan.user_id)
    if not membership or not can_contribute_to_family_goal(membership.role):
        logger.warning("Skipping goal contribution — user %s cannot contribute to goal %s", plan.user_id, goal_id)
        return None

    contribution = GoalContribution(
        goal_id=goal.id,
        user_id=plan.user_id,
        amount_inr=plan.amount_inr,
        source_type=GoalContributionSourceType.sip_plan,
        source_id=plan.id,
        note="SIP plan linked",
    )
    db.add(contribution)
    await db.flush()
    await _refresh_goal_current_amount(db, goal)

    await record_family_group_activity(
        db,
        group_id=goal.family_group_id,
        event_type=FamilyGroupActivityType.goal_contribution_added,
        actor_user_id=plan.user_id,
        metadata={
            "goal_id": str(goal.id),
            "goal_title": goal.title,
            "amount_inr": float(plan.amount_inr),
            "contribution_id": str(contribution.id),
            "source": "sip_plan",
        },
    )
    return contribution
