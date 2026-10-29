"""Shared bot help-feedback helpers (no ticket_service imports)."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.support_models import (
    SupportBotMessageFeedback,
    SupportConversation,
    SupportMessage,
    SupportTicket,
)


def latest_bot_text_message_id(messages: list[SupportMessage]) -> UUID | None:
    for message in reversed(messages):
        if message.visibility != "customer":
            continue
        if message.role != "bot":
            continue
        if (message.kind or "text") != "text":
            continue
        return message.id
    return None


def help_feedback_fields(
    *,
    message: SupportMessage,
    conversation: SupportConversation,
    ticket: SupportTicket | None,
    latest_bot_id: UUID | None,
    recorded_choice: str | None,
) -> tuple[str | None, bool]:
    if recorded_choice in {"yes", "no"}:
        return recorded_choice, False
    active = bool(
        conversation.handler == "bot"
        and conversation.status != "closed"
        and ticket is not None
        and ticket.status != "resolved"
        and message.role == "bot"
        and (message.kind or "text") == "text"
        and message.visibility == "customer"
        and latest_bot_id is not None
        and message.id == latest_bot_id
    )
    if active:
        return "pending", True
    return None, False


async def load_feedback_choices(
    db: AsyncSession,
    message_ids: list[UUID],
) -> dict[UUID, str]:
    if not message_ids:
        return {}
    result = await db.execute(
        select(SupportBotMessageFeedback.message_id, SupportBotMessageFeedback.choice).where(
            SupportBotMessageFeedback.message_id.in_(message_ids)
        )
    )
    return {row[0]: row[1] for row in result.all()}
