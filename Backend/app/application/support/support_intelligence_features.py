"""Structured features for Support AI routing (no LLM)."""

from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.rbac_service import SUPPORT_AGENT_ROLE_KEY, SUPPORT_LEAD_ROLE_KEY
from app.application.distributor.distributor_client_link_service import get_client_link_for_user
from app.application.support.context_pack import build_context_pack
from app.application.support.realtime.presence import read_agent_presence
from app.application.support.scope_gate import _HUMAN_REQUEST
from app.application.support.ticket_service import list_messages, mask_email, person_name
from app.infrastructure.persistence.models import AdminRole, AdminUserRoleAssignment, User, UserStatus
from app.infrastructure.persistence.support_models import SupportTicket

_MAX_JSON_BYTES = 12_000
_TRANSCRIPT_LIMIT = 12


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _minutes_since(value: datetime | None, *, now: datetime | None = None) -> float | None:
    if value is None:
        return None
    moment = now or _utcnow()
    return max(0.0, (moment - _aware(value)).total_seconds() / 60.0)


def _caps_ratio(text: str) -> float:
    letters = [char for char in text if char.isalpha()]
    if not letters:
        return 0.0
    upper = sum(1 for char in letters if char.isupper())
    return round(upper / len(letters), 2)


def _behavior_signals(text: str, *, message_count: int) -> list[str]:
    signals: list[str] = []
    if _HUMAN_REQUEST.search(text):
        signals.append("requested_human_agent")
    if text.count("?") >= 2:
        signals.append("multiple_questions")
    if re.search(r"\b(still waiting|any update|follow up|follow-up)\b", text, re.I):
        signals.append("follow_up_pressure")
    if _caps_ratio(text) >= 0.35 and len(text) >= 20:
        signals.append("elevated_caps_tone")
    if message_count >= 4:
        signals.append("high_message_volume")
    return signals


async def _ticket_counts(db: AsyncSession, user_id: UUID, *, days: int) -> int:
    since = _utcnow() - timedelta(days=days)
    result = await db.scalar(
        select(func.count(SupportTicket.id)).where(
            SupportTicket.user_id == user_id,
            SupportTicket.created_at >= since,
        )
    )
    return int(result or 0)


async def _agent_productivity(
    db: AsyncSession,
    agent_id: UUID,
    *,
    since: datetime,
) -> dict[str, Any]:
    resolved = await db.scalar(
        select(func.count(SupportTicket.id)).where(
            SupportTicket.assignee_id == agent_id,
            SupportTicket.status == "resolved",
            SupportTicket.resolved_at >= since,
        )
    )
    open_load = await db.scalar(
        select(func.count(SupportTicket.id)).where(
            SupportTicket.assignee_id == agent_id,
            SupportTicket.status.in_(("open", "pending")),
        )
    )
    return {
        "resolved_last_7d": int(resolved or 0),
        "open_backlog": int(open_load or 0),
    }


async def build_support_routing_features(
    db: AsyncSession,
    *,
    ticket: SupportTicket,
    customer: User,
    trigger: str,
) -> dict[str, Any]:
    now = _utcnow()
    messages = await list_messages(db, ticket.conversation_id)
    customer_visible = [
        message
        for message in messages
        if message.visibility == "customer" and (message.kind or "text") != "resolution_prompt"
    ]
    transcript = [
        {
            "role": message.role,
            "body": message.body[:400],
            "at": message.created_at.isoformat() if message.created_at else None,
        }
        for message in customer_visible[-_TRANSCRIPT_LIMIT:]
    ]
    combined_text = " ".join(message.body for message in customer_visible if message.role == "user")
    last_user_at = next(
        (message.created_at for message in reversed(customer_visible) if message.role == "user"),
        None,
    )
    has_attachment = any(message.attachment_document_id for message in customer_visible)

    topics = ticket.topics if isinstance(ticket.topics, list) else [ticket.topic]
    context_pack = await build_context_pack(db, customer, topics)

    link = await get_client_link_for_user(db, client_user_id=customer.id)
    pm_context: dict[str, Any] | None = None
    service_model = "diy"
    if link is not None:
        service_model = "pm"
        mitra = await db.get(User, link.mitra_user_id)
        pm_context = {
            "mitra_user_id": str(link.mitra_user_id),
            "mitra_display_name": person_name(mitra, fallback="Mitra") if mitra else "Mitra",
            "mitra_client_id": link.mitra_client_id,
            "service_model": service_model,
        }

    role_keys = (SUPPORT_AGENT_ROLE_KEY, SUPPORT_LEAD_ROLE_KEY)
    agents_result = await db.execute(
        select(User)
        .join(AdminUserRoleAssignment, AdminUserRoleAssignment.user_id == User.id)
        .join(AdminRole, AdminRole.id == AdminUserRoleAssignment.role_id)
        .where(User.status == UserStatus.active, AdminRole.key.in_(role_keys))
        .distinct()
    )
    agents = list(agents_result.scalars())
    since_7d = now - timedelta(days=7)
    agent_candidates: list[dict[str, Any]] = []
    for agent in agents:
        presence = await read_agent_presence(agent.id)
        productivity = await _agent_productivity(db, agent.id, since=since_7d)
        topic_rows = await db.execute(
            select(SupportTicket.topic, func.count(SupportTicket.id))
            .where(
                SupportTicket.assignee_id == agent.id,
                SupportTicket.status.in_(("open", "pending")),
            )
            .group_by(SupportTicket.topic)
        )
        topic_load = {row[0]: int(row[1]) for row in topic_rows.all()}
        agent_candidates.append(
            {
                "id": str(agent.id),
                "display_name": person_name(agent, fallback="Support"),
                "presence": presence or "offline",
                "open_backlog": productivity["open_backlog"],
                "resolved_last_7d": productivity["resolved_last_7d"],
                "open_by_topic": topic_load,
            }
        )

    payload: dict[str, Any] = {
        "trigger": trigger,
        "ticket": {
            "public_id": ticket.public_id,
            "status": ticket.status,
            "priority": ticket.priority,
            "topic": ticket.topic,
            "topics": topics,
            "handled_by": ticket.handled_by,
            "assignee_id": str(ticket.assignee_id) if ticket.assignee_id else None,
            "escalation_reason": (ticket.escalation_reason or "")[:500] or None,
            "subject": ticket.subject[:200],
            "description": ticket.description[:500],
            "created_minutes_ago": _minutes_since(ticket.created_at, now=now),
            "minutes_since_last_customer_message": _minutes_since(last_user_at, now=now),
            "customer_message_count": sum(1 for message in customer_visible if message.role == "user"),
            "total_message_count": len(customer_visible),
            "has_attachment": has_attachment,
            "transcript": transcript,
            "behavior_signals": _behavior_signals(combined_text, message_count=len(customer_visible)),
        },
        "customer": {
            "user_id": str(customer.id),
            "client_code": customer.client_id,
            "display_name": person_name(customer),
            "email_masked": mask_email(customer.email),
            "tickets_last_7d": await _ticket_counts(db, customer.id, days=7),
            "tickets_last_30d": await _ticket_counts(db, customer.id, days=30),
            "context_pack": context_pack,
            "in_distributor_book": link is not None,
            "service_model": service_model,
            "pm_context": pm_context,
        },
        "agent_candidates": agent_candidates,
    }

    encoded = json.dumps(payload, default=str)
    if len(encoded) > _MAX_JSON_BYTES:
        payload["ticket"]["transcript"] = transcript[-8:]
        payload["_truncated"] = True
    return payload
