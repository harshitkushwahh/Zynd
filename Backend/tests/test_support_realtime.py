from datetime import datetime, timedelta, timezone

from app.application.support.realtime.presence import _recent_agent_message
from app.application.support.webhook_dispatcher import _sign_body


def test_recent_agent_message_within_window() -> None:
    now = datetime(2026, 3, 1, 12, 0, tzinfo=timezone.utc)
    messages = [
        {
            "role": "user",
            "created_at": (now - timedelta(minutes=5)).isoformat(),
        },
        {
            "role": "agent",
            "created_at": (now - timedelta(minutes=1)).isoformat(),
        },
    ]
    assert _recent_agent_message(messages, now=now) is True


def test_recent_agent_message_outside_window() -> None:
    now = datetime(2026, 3, 1, 12, 0, tzinfo=timezone.utc)
    messages = [
        {
            "role": "agent",
            "created_at": (now - timedelta(minutes=10)).isoformat(),
        },
    ]
    assert _recent_agent_message(messages, now=now) is False


def test_support_webhook_signature() -> None:
    body = b'{"type":"ticket.resolved","payload":{"ticket_id":"TKT-1"}}'
    secret = "test-secret"
    signature = _sign_body(secret, body)
    assert signature.startswith("sha256=")
    assert len(signature) > len("sha256=")
