from datetime import datetime, timezone
from uuid import uuid4

import pytest

from app.application.support.bot_help_feedback_helpers import help_feedback_fields, latest_bot_text_message_id
from app.application.support.bot_help_feedback_service import (
    BOT_UNHELPFUL_ESCALATE_THRESHOLD,
    submit_bot_help_feedback,
)
from app.application.support.ticket_service import SupportActionError
from app.infrastructure.persistence.support_models import (
    SupportConversation,
    SupportMessage,
    SupportTicket,
)


def _bot_msg(*, conversation_id, body="answer", msg_id=None):
    return SupportMessage(
        id=msg_id or uuid4(),
        conversation_id=conversation_id,
        role="bot",
        body=body,
        visibility="customer",
        kind="text",
        created_at=datetime.now(timezone.utc),
    )


def _conversation(*, user_id, handler="bot", status="open"):
    return SupportConversation(
        id=uuid4(),
        user_id=user_id,
        handler=handler,
        status=status,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


def _ticket(*, conversation_id, user_id, count=0):
    return SupportTicket(
        id=uuid4(),
        public_id="T-TEST-001",
        conversation_id=conversation_id,
        user_id=user_id,
        subject="Test",
        description="Test",
        topic="account",
        topics=["account"],
        status="pending",
        priority="medium",
        channel="web_chat",
        handled_by="bot",
        bot_unhelpful_count=count,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


def test_latest_bot_text_message_id_picks_last_bot() -> None:
    conv_id = uuid4()
    user = uuid4()
    first = _bot_msg(conversation_id=conv_id, body="one")
    second = _bot_msg(conversation_id=conv_id, body="two")
    user_msg = SupportMessage(
        id=uuid4(),
        conversation_id=conv_id,
        role="user",
        body="hi",
        visibility="customer",
        kind="text",
        created_at=datetime.now(timezone.utc),
    )
    assert latest_bot_text_message_id([first, user_msg, second]) == second.id


def test_help_feedback_active_only_on_latest_bot() -> None:
    conv = _conversation(user_id=uuid4())
    ticket = _ticket(conversation_id=conv.id, user_id=conv.user_id)
    old = _bot_msg(conversation_id=conv.id, body="old")
    latest = _bot_msg(conversation_id=conv.id, body="latest")
    fb_old, active_old = help_feedback_fields(
        message=old,
        conversation=conv,
        ticket=ticket,
        latest_bot_id=latest.id,
        recorded_choice=None,
    )
    fb_new, active_new = help_feedback_fields(
        message=latest,
        conversation=conv,
        ticket=ticket,
        latest_bot_id=latest.id,
        recorded_choice=None,
    )
    assert fb_old is None and active_old is False
    assert fb_new == "pending" and active_new is True


def test_recorded_yes_shows_no_active_prompt() -> None:
    conv = _conversation(user_id=uuid4())
    ticket = _ticket(conversation_id=conv.id, user_id=conv.user_id)
    msg = _bot_msg(conversation_id=conv.id)
    fb, active = help_feedback_fields(
        message=msg,
        conversation=conv,
        ticket=ticket,
        latest_bot_id=msg.id,
        recorded_choice="yes",
    )
    assert fb == "yes"
    assert active is False


@pytest.mark.asyncio
async def test_submit_yes_resets_unhelpful_count(db_session, monkeypatch) -> None:
    from app.infrastructure.persistence.models import User, UserRole, UserStatus

    user = User(
        id=uuid4(),
        email=f"feedback-{uuid4().hex}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
        client_id=f"test-{uuid4().hex}@zynd",
    )
    db_session.add(user)
    conv = _conversation(user_id=user.id)
    db_session.add(conv)
    ticket = _ticket(conversation_id=conv.id, user_id=user.id, count=2)
    db_session.add(ticket)
    msg = _bot_msg(conversation_id=conv.id)
    db_session.add(msg)
    await db_session.flush()

    async def _noop_async(*args, **kwargs):
        return None

    def _noop_sync(*args, **kwargs):
        return None

    monkeypatch.setattr(
        "app.application.support.bot_help_feedback_service.schedule_conversation_realtime_snapshot",
        _noop_sync,
    )
    monkeypatch.setattr(
        "app.application.support.ticket_list_cache.bump_customer_ticket_list_cache_version",
        _noop_async,
    )

    snapshot = await submit_bot_help_feedback(db_session, user, msg.id, "yes")
    await db_session.refresh(ticket)
    assert ticket.bot_unhelpful_count == 0
    bot_messages = [m for m in snapshot["messages"] if m["role"] == "bot"]
    answered = next(m for m in bot_messages if m["id"] == str(msg.id))
    assert answered["help_feedback"] == "yes"
    assert answered["help_feedback_active"] is False


@pytest.mark.asyncio
async def test_submit_no_third_time_escalates(db_session, monkeypatch) -> None:
    from app.infrastructure.persistence.models import User, UserRole, UserStatus

    user = User(
        id=uuid4(),
        email=f"feedback-{uuid4().hex}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
        client_id=f"test-{uuid4().hex}@zynd",
    )
    db_session.add(user)
    conv = _conversation(user_id=user.id)
    db_session.add(conv)
    ticket = _ticket(
        conversation_id=conv.id,
        user_id=user.id,
        count=BOT_UNHELPFUL_ESCALATE_THRESHOLD - 1,
    )
    db_session.add(ticket)
    msg = _bot_msg(conversation_id=conv.id)
    db_session.add(msg)
    await db_session.flush()

    escalated: list[str] = []

    async def _escalate(db, u, conversation, body, topics, reason, **kwargs):
        escalated.append(reason)
        conversation.handler = "human"
        conversation.status = "escalated"

    monkeypatch.setattr(
        "app.application.support.help_bot_service.escalate_conversation_to_human",
        _escalate,
    )
    monkeypatch.setattr(
        "app.application.support.bot_help_feedback_service.schedule_conversation_realtime_snapshot",
        lambda **kwargs: None,
    )

    async def _bump_async(*args):
        return None

    monkeypatch.setattr(
        "app.application.support.ticket_list_cache.bump_customer_ticket_list_cache_version",
        _bump_async,
    )

    await submit_bot_help_feedback(db_session, user, msg.id, "no")
    await db_session.refresh(ticket)
    await db_session.refresh(conv)
    assert ticket.bot_unhelpful_count == BOT_UNHELPFUL_ESCALATE_THRESHOLD
    assert escalated
    assert conv.handler == "human"


@pytest.mark.asyncio
async def test_submit_no_on_stale_message_rejected(db_session) -> None:
    from app.infrastructure.persistence.models import User, UserRole, UserStatus

    user = User(
        id=uuid4(),
        email=f"feedback-{uuid4().hex}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
        client_id=f"test-{uuid4().hex}@zynd",
    )
    db_session.add(user)
    conv = _conversation(user_id=user.id)
    db_session.add(conv)
    ticket = _ticket(conversation_id=conv.id, user_id=user.id)
    db_session.add(ticket)
    old = _bot_msg(conversation_id=conv.id, body="old")
    latest = _bot_msg(conversation_id=conv.id, body="latest")
    db_session.add(old)
    db_session.add(latest)
    await db_session.flush()

    with pytest.raises(SupportActionError) as exc:
        await submit_bot_help_feedback(db_session, user, old.id, "no")
    assert exc.value.status_code == 409
