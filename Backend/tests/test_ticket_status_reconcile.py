from datetime import datetime, timezone
from uuid import uuid4

import pytest

from app.application.support.ticket_service import (
    effective_ticket_status,
    reconcile_ticket_resolution_state,
)
from app.infrastructure.persistence.support_models import SupportConversation, SupportTicket


def test_effective_status_closed_conversation() -> None:
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
        status="open",
        priority="medium",
        channel="web_chat",
        handled_by="human",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    assert effective_ticket_status(ticket, conv) == "resolved"


@pytest.mark.asyncio
async def test_reconcile_updates_open_ticket_when_conversation_closed(db_session) -> None:
    from app.infrastructure.persistence.models import User, UserRole, UserStatus

    user = User(
        id=uuid4(),
        email=f"reconcile-{uuid4().hex}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
        client_id=f"test-{uuid4().hex}@zynd",
    )
    db_session.add(user)
    conv = SupportConversation(
        id=uuid4(),
        user_id=user.id,
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
        user_id=user.id,
        subject="Test",
        description="Test",
        topic="account",
        topics=["account"],
        status="open",
        priority="medium",
        channel="web_chat",
        handled_by="human",
        resolution_choice="yes",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db_session.add(ticket)
    await db_session.flush()

    status = await reconcile_ticket_resolution_state(db_session, ticket, conv)
    await db_session.refresh(ticket)
    assert status == "resolved"
    assert ticket.status == "resolved"
    assert ticket.resolved_at is not None
