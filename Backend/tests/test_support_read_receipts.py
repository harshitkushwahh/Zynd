from datetime import datetime, timezone
from uuid import uuid4

from app.application.support.read_receipts import mark_customer_read, mark_support_read
from app.infrastructure.persistence.support_models import SupportMessage


def _user_message(**overrides) -> SupportMessage:
    message = SupportMessage(
        id=uuid4(),
        conversation_id=uuid4(),
        role="user",
        body="hello",
        visibility="customer",
        kind="text",
        created_at=datetime.now(timezone.utc),
    )
    for key, value in overrides.items():
        setattr(message, key, value)
    return message


def _bot_message(**overrides) -> SupportMessage:
    message = SupportMessage(
        id=uuid4(),
        conversation_id=uuid4(),
        role="bot",
        body="hi",
        visibility="customer",
        kind="text",
        created_at=datetime.now(timezone.utc),
    )
    for key, value in overrides.items():
        setattr(message, key, value)
    return message


class _FakeSession:
    async def flush(self) -> None:
        return None


async def test_mark_support_read_sets_bot_reader(monkeypatch) -> None:
    published: list[dict] = []

    async def _capture(**kwargs) -> None:
        published.append(kwargs)

    monkeypatch.setattr(
        "app.application.support.read_receipts._publish_read",
        _capture,
    )
    message = _user_message()
    db = _FakeSession()
    changed = await mark_support_read(db, message, reader="bot", ticket_public_id="T-1")
    assert changed is True
    assert message.support_read_by == "bot"
    assert message.support_read_at is not None
    assert published[0]["side"] == "support"
    assert published[0]["reader"] == "bot"


async def test_mark_customer_read_skips_internal_roles() -> None:
    message = _bot_message(role="agent", visibility="internal")
    db = _FakeSession()
    changed = await mark_customer_read(db, message)
    assert changed is False


async def test_mark_support_read_idempotent() -> None:
    message = _user_message(support_read_at=datetime.now(timezone.utc), support_read_by="agent")
    db = _FakeSession()
    changed = await mark_support_read(db, message, reader="agent")
    assert changed is False
