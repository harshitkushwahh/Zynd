"""Support chat read receipts (WebSocket-driven, not REST polling)."""

from __future__ import annotations

import logging
from typing import Literal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.support.realtime.events import support_event
from app.application.support.realtime.publisher import publish_support_realtime_event
from app.application.support.ticket_service import get_ticket_for_conversation, utcnow
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.support_models import SupportConversation, SupportMessage

logger = logging.getLogger(__name__)

SupportReader = Literal["bot", "agent"]


def _iso(value) -> str | None:
    if value is None:
        return None
    return value.isoformat()


async def mark_support_read(
    db: AsyncSession,
    message: SupportMessage,
    *,
    reader: SupportReader,
    ticket_public_id: str | None = None,
) -> bool:
    """Mark a customer message as read by bot or agent."""
    if message.role != "user" or message.visibility != "customer":
        return False
    if message.support_read_at is not None:
        return False
    now = utcnow()
    message.support_read_at = now
    message.support_read_by = reader
    await db.flush()
    await _publish_read(
        conversation_id=message.conversation_id,
        ticket_public_id=ticket_public_id,
        message_id=message.id,
        side="support",
        reader=reader,
        read_at=now,
    )
    return True


async def mark_customer_read(
    db: AsyncSession,
    message: SupportMessage,
    *,
    ticket_public_id: str | None = None,
) -> bool:
    """Mark an outbound (bot/agent/system) message as read by the customer."""
    if message.visibility != "customer":
        return False
    if message.role not in {"bot", "agent", "system"}:
        return False
    if message.customer_read_at is not None:
        return False
    now = utcnow()
    message.customer_read_at = now
    await db.flush()
    await _publish_read(
        conversation_id=message.conversation_id,
        ticket_public_id=ticket_public_id,
        message_id=message.id,
        side="customer",
        reader=None,
        read_at=now,
    )
    return True


async def mark_all_user_messages_read_by_support(
    db: AsyncSession,
    conversation_id: UUID,
    *,
    reader: SupportReader,
    ticket_public_id: str | None,
) -> int:
    result = await db.scalars(
        select(SupportMessage).where(
            SupportMessage.conversation_id == conversation_id,
            SupportMessage.role == "user",
            SupportMessage.visibility == "customer",
            SupportMessage.support_read_at.is_(None),
        )
    )
    count = 0
    for message in result:
        if await mark_support_read(db, message, reader=reader, ticket_public_id=ticket_public_id):
            count += 1
    return count


async def mark_messages_read_ws(
    db: AsyncSession,
    user: User,
    *,
    conversation_id: UUID,
    message_ids: list[UUID],
    as_support: bool,
    support_reader: SupportReader | None = None,
) -> list[dict]:
    """Apply read receipts from a WebSocket `messages:read` frame."""
    conversation = await db.get(SupportConversation, conversation_id)
    if conversation is None:
        return []

    ticket = await get_ticket_for_conversation(db, conversation_id)
    ticket_public_id = ticket.public_id if ticket else None

    if not as_support and conversation.user_id != user.id:
        return []

    if not message_ids:
        return []

    result = await db.scalars(
        select(SupportMessage).where(
            SupportMessage.conversation_id == conversation_id,
            SupportMessage.id.in_(message_ids),
        )
    )
    messages = list(result)
    updates: list[dict] = []

    for message in messages:
        if as_support:
            reader = support_reader or "agent"
            if await mark_support_read(db, message, reader=reader, ticket_public_id=ticket_public_id):
                updates.append(_read_payload(message, side="support"))
        else:
            if await mark_customer_read(db, message, ticket_public_id=ticket_public_id):
                updates.append(_read_payload(message, side="customer"))

    return updates


def _read_payload(message: SupportMessage, *, side: str) -> dict:
    return {
        "message_id": str(message.id),
        "conversation_id": str(message.conversation_id),
        "side": side,
        "customer_read_at": _iso(message.customer_read_at),
        "support_read_at": _iso(message.support_read_at),
        "support_read_by": message.support_read_by,
    }


async def _publish_read(
    *,
    conversation_id: UUID,
    ticket_public_id: str | None,
    message_id: UUID,
    side: str,
    reader: SupportReader | None,
    read_at,
) -> None:
    payload = {
        "conversation_id": str(conversation_id),
        "message_id": str(message_id),
        "side": side,
        "read_at": _iso(read_at),
    }
    if ticket_public_id:
        payload["ticket_id"] = ticket_public_id
    if reader:
        payload["support_read_by"] = reader
    event = support_event("message:read", payload)
    try:
        await publish_support_realtime_event(event)
    except Exception:
        logger.exception("support_read_receipt_publish_failed message=%s", message_id)
