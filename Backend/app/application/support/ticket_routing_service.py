"""Priority, SLA deadlines, and auto-assignment for support tickets."""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.rbac_service import SUPPORT_AGENT_ROLE_KEY, SUPPORT_LEAD_ROLE_KEY
from app.infrastructure.persistence.models import AdminRole, AdminUserRoleAssignment, User, UserStatus
from app.infrastructure.persistence.support_models import SupportTicket

OPEN_STATUSES = ("open", "pending")

SLA_HOURS: dict[str, tuple[int, int]] = {
    "high": (1, 8),
    "medium": (2, 24),
    "low": (4, 48),
}

PRIORITY_RANK = {"low": 0, "medium": 1, "high": 2}


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def compute_ticket_priority(body: str, topics: tuple[str, ...] | list[str]) -> str:
    text = body or ""
    topic_list = list(topics) or ["other"]
    if any(topic in topic_list for topic in ("payment", "portfolio")) and re.search(
        r"debit|fail|missing|not showing|not show|didn't receive|did not receive",
        text,
        re.I,
    ):
        return "high"
    if re.search(r"urgent|immediately|asap|not working|blocked|cannot invest", text, re.I):
        return "high"
    if re.search(r"risk profile|risk assessment|risk score", text, re.I):
        return "medium"
    if any(topic in topic_list for topic in ("payment", "kyc", "portfolio", "account")):
        return "medium"
    return "low"


def _merge_priority(current: str, incoming: str) -> str:
    current_rank = PRIORITY_RANK.get(current, 0)
    incoming_rank = PRIORITY_RANK.get(incoming, 0)
    return incoming if incoming_rank >= current_rank else current


def apply_sla_deadlines(ticket: SupportTicket, *, anchor: datetime | None = None) -> None:
    first_hours, resolution_hours = SLA_HOURS.get(ticket.priority, SLA_HOURS["medium"])
    moment = _aware(anchor or ticket.created_at or datetime.now(timezone.utc))
    ticket.first_response_due_at = moment + timedelta(hours=first_hours)
    ticket.resolution_due_at = moment + timedelta(hours=resolution_hours)


async def pick_least_loaded_support_agent(db: AsyncSession) -> UUID | None:
    role_keys = (SUPPORT_AGENT_ROLE_KEY, SUPPORT_LEAD_ROLE_KEY)
    agents_result = await db.execute(
        select(User.id)
        .join(AdminUserRoleAssignment, AdminUserRoleAssignment.user_id == User.id)
        .join(AdminRole, AdminRole.id == AdminUserRoleAssignment.role_id)
        .where(
            User.status == UserStatus.active,
            AdminRole.key.in_(role_keys),
        )
        .distinct()
    )
    agent_ids = list(agents_result.scalars())
    if not agent_ids:
        return None

    load_result = await db.execute(
        select(SupportTicket.assignee_id, func.count(SupportTicket.id))
        .where(
            SupportTicket.assignee_id.in_(agent_ids),
            SupportTicket.status.in_(OPEN_STATUSES),
        )
        .group_by(SupportTicket.assignee_id)
    )
    loads = {row[0]: int(row[1]) for row in load_result.all()}
    return min(agent_ids, key=lambda agent_id: (loads.get(agent_id, 0), str(agent_id)))


async def route_support_ticket(
    db: AsyncSession,
    ticket: SupportTicket,
    *,
    body: str,
    topics: tuple[str, ...] | list[str],
) -> None:
    """Apply priority, SLA targets, and auto-assignment for human-handled tickets."""
    incoming = compute_ticket_priority(body, topics)
    ticket.priority = _merge_priority(ticket.priority, incoming)
    apply_sla_deadlines(ticket, anchor=ticket.created_at)

    needs_agent = ticket.status in OPEN_STATUSES and (
        ticket.handled_by == "human" or ticket.escalation_reason
    )
    if not needs_agent or ticket.assignee_id is not None:
        return

    agent_id = await pick_least_loaded_support_agent(db)
    if agent_id is None:
        return
    ticket.assignee_id = agent_id
    ticket.handled_by = "human"


def sla_snapshot(ticket: SupportTicket, *, now: datetime | None = None) -> dict[str, Any]:
    moment = _aware(now or datetime.now(timezone.utc))
    first_due = ticket.first_response_due_at
    resolution_due = ticket.resolution_due_at
    first_responded = ticket.first_responded_at
    resolved = ticket.resolved_at

    def _remaining_hours(due: datetime | None) -> float | None:
        if due is None:
            return None
        return max(0.0, (_aware(due) - moment).total_seconds() / 3600.0)

    first_hours, resolution_hours = SLA_HOURS.get(ticket.priority, SLA_HOURS["medium"])
    first_met = first_responded is not None or ticket.status == "resolved"
    resolution_met = ticket.status == "resolved"

    first_remaining = _remaining_hours(first_due)
    resolution_remaining = _remaining_hours(resolution_due)

    return {
        "priority": ticket.priority,
        "first_response_target_hours": first_hours,
        "resolution_target_hours": resolution_hours,
        "first_response_due_at": first_due.isoformat() if first_due else None,
        "resolution_due_at": resolution_due.isoformat() if resolution_due else None,
        "first_responded_at": first_responded.isoformat() if first_responded else None,
        "resolved_at": resolved.isoformat() if resolved else None,
        "first_response_met": first_met,
        "resolution_met": resolution_met,
        "first_response_remaining_hours": first_remaining,
        "resolution_remaining_hours": resolution_remaining,
    }
