from __future__ import annotations

from typing import Any, Literal

SupportRealtimeEventType = Literal[
    "message:new",
    "message:read",
    "ticket:updated",
    "agent:typing",
    "agent:presence",
    "conversation:locked",
]


def support_event(event_type: SupportRealtimeEventType, payload: dict[str, Any]) -> dict[str, Any]:
    return {"type": event_type, **payload}
