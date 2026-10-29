from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from app.application.support.context_pack import build_context_pack
from app.application.support.help_bot_answer_policy import (
    HELP_BOT_SYSTEM_PROMPT,
    build_help_bot_user_prompt,
    pick_customer_reply,
    should_escalate_to_human,
)
from app.application.support.help_bot_conversation_context import resolve_help_topics
from app.application.support.help_bot_grounded_reply import (
    should_answer_without_llm,
    try_grounded_account_reply,
)
from app.application.support.help_bot_order_context import (
    enrich_payment_context_for_message,
    message_mentions_order_id,
    reply_for_pasted_order_ids,
)
from app.application.support.help_bot_types import BotDraft
from app.application.support.ollama_client import OllamaError, complete_help_reply
from app.application.support.scope_gate import BOT_NAME, OUT_OF_SCOPE_REPLY, classify_message
from app.application.support.training_loader import similar_training_examples
from app.application.support.ticket_service import (
    SupportActionError,
    add_message,
    close_stale_resolution_prompts,
    create_conversation,
    dismiss_open_resolution_prompt,
    ensure_ticket,
    find_active_conversation,
    get_ticket_for_conversation,
    list_messages,
    parse_resolution_choice,
    person_name,
    respond_to_resolution,
    serialize_customer_conversation,
    similar_resolutions,
    utcnow,
)
from app.application.support.customer_message_limits import validate_customer_message_text
from app.application.support.ticket_attachments import store_ticket_image
from app.infrastructure.persistence.models import User

def _escalation_text(public_id: str) -> str:
    return (
        f"I can't confirm that from your Zynd account. I've opened {public_id} and a support agent "
        "will take it from here. You can keep writing in this chat."
    )


async def get_current_conversation(db: AsyncSession, user: User) -> dict:
    await close_stale_resolution_prompts(db, user_id=user.id)
    conversation = await find_active_conversation(db, user.id)
    return await serialize_customer_conversation(db, user, conversation)


async def begin_new_customer_conversation(db: AsyncSession, user: User) -> dict:
    """Close the active thread (if any) and open a fresh Help Bot conversation."""
    await close_stale_resolution_prompts(db, user_id=user.id)
    active = await find_active_conversation(db, user.id)
    if active is not None and active.status != "closed":
        active.status = "closed"
        active.updated_at = utcnow()
    conversation = await create_conversation(db, user.id)
    return await serialize_customer_conversation(db, user, conversation)


async def post_customer_message(
    db: AsyncSession,
    user: User,
    *,
    body: str,
    upload: tuple[str, bytes] | None = None,
) -> dict:
    has_image = upload is not None and len(upload[1]) > 0
    text = validate_customer_message_text(text=body, has_attachment=has_image)

    await close_stale_resolution_prompts(db, user_id=user.id)
    conversation = await find_active_conversation(db, user.id)
    if conversation is None:
        conversation = await create_conversation(db, user.id)
    elif conversation.status == "closed":
        raise SupportActionError(
            "conversation_closed",
            "This ticket is resolved. Start a new chat to message support.",
            403,
        )

    ticket = await get_ticket_for_conversation(db, conversation.id)
    if ticket is not None and ticket.status == "resolved":
        raise SupportActionError(
            "conversation_closed",
            "This ticket is resolved. Start a new chat to message support.",
            403,
        )
    if has_image and conversation.handler != "human":
        raise SupportActionError(
            "attachment_not_available",
            "You can share images after a support agent joins this chat.",
            400,
        )
    if (
        ticket is not None
        and not has_image
        and ticket.resolution_prompted_at is not None
        and ticket.resolution_choice is None
    ):
        choice = parse_resolution_choice(text)
        if choice is not None:
            return await respond_to_resolution(db, user, ticket.public_id, choice)

    await dismiss_open_resolution_prompt(db, ticket)
    raw_topics = ticket.topics if ticket is not None and isinstance(ticket.topics, list) else []
    previous = tuple(str(topic) for topic in raw_topics)
    decision = classify_message(text, previous_topics=previous)

    attachment_document_id = None
    attachment_filename = None
    if has_image and upload is not None:
        filename, content = upload
        ticket = await ensure_ticket(
            db,
            conversation,
            user,
            body=text,
            topics=decision.topics,
            handled_by="human",
            status="open",
        )
        document = await store_ticket_image(
            db,
            user,
            ticket,
            filename=filename,
            content=content,
        )
        attachment_document_id = document.id
        attachment_filename = document.original_filename

    user_message = await add_message(
        db,
        conversation,
        role="user",
        body=text,
        sender_name=person_name(user),
        author_user_id=user.id,
        attachment_document_id=attachment_document_id,
        attachment_filename=attachment_filename,
    )
    ticket = ticket or await get_ticket_for_conversation(db, conversation.id)
    if conversation.handler != "human":
        from app.application.support.read_receipts import mark_support_read

        await mark_support_read(
            db,
            user_message,
            reader="bot",
            ticket_public_id=ticket.public_id if ticket else None,
        )

    if has_image:
        if conversation.handler != "human":
            await _escalate(
                db,
                user,
                conversation,
                text,
                decision.topics,
                "Customer shared an image the bot cannot review.",
            )
        elif ticket is not None:
            ticket.description = text[:500]
            ticket.handled_by = "human"
            ticket.updated_at = utcnow()
        return await serialize_customer_conversation(db, user, conversation)

    if conversation.handler == "human":
        if ticket is not None:
            ticket.description = text[:500]
            ticket.updated_at = utcnow()
            from app.application.support.support_intelligence_router import apply_support_intelligence

            await apply_support_intelligence(
                db,
                ticket,
                user,
                trigger="customer_message",
                force=True,
            )
        return await serialize_customer_conversation(db, user, conversation)

    if not decision.in_scope:
        await add_message(
            db,
            conversation,
            role="system",
            body=OUT_OF_SCOPE_REPLY,
            sender_name=BOT_NAME,
        )
        return await serialize_customer_conversation(db, user, conversation)

    if decision.needs_human:
        await _escalate(
            db,
            user,
            conversation,
            text,
            decision.topics,
            "Customer asked to speak with a person.",
        )
        return await serialize_customer_conversation(db, user, conversation)

    history = await list_messages(db, conversation.id)
    transcript = [
        {"role": message.role, "body": message.body}
        for message in history
        if message.visibility == "customer" and message.kind != "resolution_prompt"
    ][-6:]

    topics = resolve_help_topics(
        message_topics=tuple(decision.topics),
        transcript=transcript,
        latest_text=text,
    )
    if message_mentions_order_id(text) and "payment" not in topics:
        topics = (*topics, "payment")
    pack = await build_context_pack(db, user, topics)
    await enrich_payment_context_for_message(db, user.id, text, pack)

    if message_mentions_order_id(text):
        order_reply = await reply_for_pasted_order_ids(db, user.id, text)
        if order_reply:
            await add_message(
                db,
                conversation,
                role="bot",
                body=order_reply,
                sender_name=BOT_NAME,
            )
            await ensure_ticket(
                db,
                conversation,
                user,
                body=text,
                topics=topics,
                handled_by="bot",
                status="pending",
            )
            conversation.handler = "bot"
            conversation.status = "open"
            return await serialize_customer_conversation(db, user, conversation)

    if should_answer_without_llm(text):
        grounded_only = try_grounded_account_reply(text, pack, topics)
        if grounded_only:
            await add_message(
                db,
                conversation,
                role="bot",
                body=grounded_only,
                sender_name=BOT_NAME,
            )
            await ensure_ticket(
                db,
                conversation,
                user,
                body=text,
                topics=topics,
                handled_by="bot",
                status="pending",
            )
            conversation.handler = "bot"
            conversation.status = "open"
            return await serialize_customer_conversation(db, user, conversation)

    examples = await similar_resolutions(db, text, topics)
    if len(examples) < 3:
        examples = [
            *examples,
            *similar_training_examples(
                text,
                topics,
                limit=3 - len(examples),
            ),
        ]
    user_prompt = build_help_bot_user_prompt(
        topics=topics,
        pack=pack,
        examples=examples,
        transcript=transcript,
        latest_question=text,
    )

    llm_unavailable = False
    draft = BotDraft(can_answer=False, answer="", needs_agent=False)
    try:
        draft = await complete_help_reply(
            system_prompt=HELP_BOT_SYSTEM_PROMPT,
            user_prompt=user_prompt,
        )
    except OllamaError as exc:
        llm_unavailable = True
        logger.warning("help_bot_ollama_failed user=%s error=%s", user.id, exc)

    customer_reply = pick_customer_reply(
        question=text,
        pack=pack,
        topics=topics,
        draft=draft,
    )
    escalate, escalate_reason = should_escalate_to_human(
        needs_human=False,
        draft=draft,
        customer_reply=customer_reply,
        llm_unavailable=llm_unavailable,
    )
    if escalate:
        logger.info(
            "help_bot_escalate user=%s topics=%s reason=%s",
            user.id,
            topics,
            escalate_reason[:240],
        )
        await _escalate(
            db,
            user,
            conversation,
            text,
            topics,
            escalate_reason,
            routing_fallback_only=True,
        )
        return await serialize_customer_conversation(db, user, conversation)

    await add_message(
        db,
        conversation,
        role="bot",
        body=customer_reply or "",
        sender_name=BOT_NAME,
    )
    await ensure_ticket(
        db,
        conversation,
        user,
        body=text,
        topics=topics,
        handled_by="bot",
        status="pending",
    )
    conversation.handler = "bot"
    conversation.status = "open"
    return await serialize_customer_conversation(db, user, conversation)


async def escalate_conversation_to_human(
    db,
    user,
    conversation,
    body: str,
    topics,
    reason: str,
    *,
    routing_fallback_only: bool = True,
) -> None:
    await _escalate(
        db,
        user,
        conversation,
        body,
        topics,
        reason,
        routing_fallback_only=routing_fallback_only,
    )


async def _escalate(
    db,
    user,
    conversation,
    body: str,
    topics,
    reason: str,
    *,
    routing_fallback_only: bool = True,
) -> None:
    ticket = await ensure_ticket(
        db,
        conversation,
        user,
        body=body,
        topics=topics,
        handled_by="human",
        status="open",
        escalation_reason=reason[:500],
        routing_fallback_only=routing_fallback_only,
    )
    conversation.handler = "human"
    conversation.status = "escalated"
    await add_message(
        db,
        conversation,
        role="system",
        body=_escalation_text(ticket.public_id),
        sender_name=BOT_NAME,
    )
    await add_message(
        db,
        conversation,
        role="system",
        body=f"Zynd Help Bot escalated this chat: {reason[:500]}",
        visibility="internal",
        sender_name=BOT_NAME,
    )
    pm_handling = (
        ticket.routing_metadata.get("pm_co_handling")
        if isinstance(ticket.routing_metadata, dict)
        else None
    )
    if isinstance(pm_handling, dict) and pm_handling.get("mitra_display_name"):
        action = pm_handling.get("recommended_action") or "notify"
        mitra_name = pm_handling.get("mitra_display_name")
        mitra_client = pm_handling.get("mitra_client_id") or "—"
        await add_message(
            db,
            conversation,
            role="system",
            body=(
                f"PM co-handling ({action}): consult {mitra_name} "
                f"(book client {mitra_client}) if investor context requires Mitra alignment."
            ),
            visibility="internal",
            sender_name=BOT_NAME,
        )
    from app.application.support.ticket_service import schedule_conversation_realtime_snapshot

    snapshot = await serialize_customer_conversation(db, user, conversation)
    schedule_conversation_realtime_snapshot(
        conversation_id=conversation.id,
        ticket_public_id=ticket.public_id,
        snapshot=snapshot,
        owner_user_id=user.id,
    )
    from app.application.support.webhook_dispatcher import schedule_support_webhook

    schedule_support_webhook(
        "ticket.escalated",
        {
            "ticket_id": ticket.public_id,
            "user_id": str(user.id),
            "reason": reason[:500],
        },
    )
