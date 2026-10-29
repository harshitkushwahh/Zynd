"""Per–bot-answer “Did it help?” feedback and escalation after repeated No."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.support.bot_help_feedback_helpers import latest_bot_text_message_id
from app.application.support.scope_gate import BOT_NAME
from app.application.support.ticket_service import (
    SupportActionError,
    add_message,
    get_ticket_for_conversation,
    schedule_conversation_realtime_snapshot,
    serialize_customer_conversation,
)
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.support_models import (
    SupportBotMessageFeedback,
    SupportConversation,
    SupportMessage,
)

BOT_HELP_APOLOGY_BODY = "I'm sorry that didn't help. How could I help you more?"
BOT_HELP_ESCALATION_REASON = "Repeated unhelpful bot answers"
BOT_UNHELPFUL_ESCALATE_THRESHOLD = 3


async def submit_bot_help_feedback(
    db: AsyncSession,
    user: User,
    message_id: UUID,
    choice: str,
) -> dict:
    if choice not in {"yes", "no"}:
        raise SupportActionError("invalid_choice", "Choose yes or no.")

    message = await db.get(SupportMessage, message_id)
    if message is None or message.visibility != "customer" or message.role != "bot":
        raise SupportActionError("feedback_not_allowed", "Feedback is not available for this message.", 404)

    conversation = await db.get(SupportConversation, message.conversation_id)
    if conversation is None or conversation.user_id != user.id:
        raise SupportActionError("feedback_not_allowed", "Feedback is not available for this message.", 404)

    if conversation.handler != "bot" or conversation.status == "closed":
        raise SupportActionError("feedback_not_allowed", "Feedback is not available right now.", 409)

    existing = await db.get(SupportBotMessageFeedback, message_id)
    if existing is not None:
        raise SupportActionError("feedback_already_recorded", "Feedback was already submitted.", 409)

    stored = [
        row
        for row in (
            await db.scalars(
                select(SupportMessage)
                .where(SupportMessage.conversation_id == conversation.id)
                .order_by(SupportMessage.created_at.asc())
            )
        ).all()
        if row.visibility == "customer"
    ]
    latest_bot_id = latest_bot_text_message_id(stored)
    if latest_bot_id != message_id:
        raise SupportActionError("feedback_not_allowed", "Feedback is only available on the latest bot reply.", 409)

    ticket = await get_ticket_for_conversation(db, conversation.id)
    if ticket is None:
        raise SupportActionError("ticket_not_found", "Ticket not found.", 404)

    db.add(
        SupportBotMessageFeedback(
            message_id=message_id,
            user_id=user.id,
            choice=choice,
        )
    )

    if choice == "yes":
        ticket.bot_unhelpful_count = 0
        await db.flush()
    else:
        ticket.bot_unhelpful_count = int(ticket.bot_unhelpful_count or 0) + 1
        await db.flush()
        if ticket.bot_unhelpful_count >= BOT_UNHELPFUL_ESCALATE_THRESHOLD:
            from app.application.support.help_bot_service import escalate_conversation_to_human

            topics = tuple(str(t) for t in (ticket.topics or []) if t) or ("account",)
            await escalate_conversation_to_human(
                db,
                user,
                conversation,
                body=ticket.description or "Help bot feedback escalation",
                topics=topics,
                reason=BOT_HELP_ESCALATION_REASON,
            )
        else:
            await add_message(
                db,
                conversation,
                role="bot",
                body=BOT_HELP_APOLOGY_BODY,
                sender_name=BOT_NAME,
            )
            await db.flush()

    from app.application.support.ticket_list_cache import bump_customer_ticket_list_cache_version

    await bump_customer_ticket_list_cache_version(user.id)
    snapshot = await serialize_customer_conversation(db, user, conversation)
    if ticket.public_id:
        schedule_conversation_realtime_snapshot(
            conversation_id=conversation.id,
            ticket_public_id=ticket.public_id,
            snapshot=snapshot,
            owner_user_id=user.id,
        )
    return snapshot
