from datetime import datetime, timezone
from uuid import uuid4

import pytest

from app.application.support.ticket_service import (
    SupportActionError,
    _prompt_is_active,
    add_agent_reply,
)
from app.infrastructure.persistence.models import User, UserRole, UserStatus
from app.infrastructure.persistence.support_models import (
    SupportConversation,
    SupportMessage,
    SupportTicket,
)


def _message(*, conversation_id, kind="resolution_prompt", body="Is this ticket resolved?"):
    return SupportMessage(
        id=uuid4(),
        conversation_id=conversation_id,
        role="system",
        body=body,
        visibility="customer",
        kind=kind,
        created_at=datetime.now(timezone.utc),
    )


def test_prompt_not_active_when_conversation_closed() -> None:
    conv = SupportConversation(
        id=uuid4(),
        user_id=uuid4(),
        status="closed",
        handler="human",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    ticket = SupportTicket(
        id=uuid4(),
        public_id="T-1",
        conversation_id=conv.id,
        user_id=conv.user_id,
        subject="Test",
        description="Test",
        topic="account",
        topics=["account"],
        status="pending",
        priority="medium",
        channel="web_chat",
        handled_by="human",
        resolution_prompted_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    msg = _message(conversation_id=conv.id)
    assert _prompt_is_active(ticket, msg, msg.id, conv) is False


@pytest.mark.asyncio
async def test_agent_cannot_message_resolved_ticket(db_session) -> None:
    agent = User(
        id=uuid4(),
        email=f"agent-{uuid4().hex}@example.com",
        role=UserRole.admin,
        status=UserStatus.active,
        client_id=f"agent-{uuid4().hex}@zynd",
    )
    customer = User(
        id=uuid4(),
        email=f"cust-{uuid4().hex}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
        client_id=f"cust-{uuid4().hex}@zynd",
    )
    db_session.add(agent)
    db_session.add(customer)
    conv = SupportConversation(
        id=uuid4(),
        user_id=customer.id,
        status="closed",
        handler="human",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db_session.add(conv)
    ticket = SupportTicket(
        id=uuid4(),
        public_id=f"TKT-{uuid4().hex[:6]}",
        conversation_id=conv.id,
        user_id=customer.id,
        subject="Test",
        description="Test",
        topic="account",
        topics=["account"],
        status="resolved",
        priority="medium",
        channel="web_chat",
        handled_by="human",
        resolution_choice="yes",
        resolved_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db_session.add(ticket)
    await db_session.flush()

    with pytest.raises(SupportActionError) as exc:
        await add_agent_reply(
            db_session,
            ticket.public_id,
            agent,
            body="",
            internal=False,
            resolution_prompt=True,
        )
    assert exc.value.status_code == 409
