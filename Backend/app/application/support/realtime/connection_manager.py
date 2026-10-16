from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from fastapi import WebSocket

logger = logging.getLogger(__name__)

MAX_CONNECTIONS_PER_USER = 4


@dataclass
class SupportRealtimeConnection:
    websocket: WebSocket
    user_id: UUID
    conversation_ids: set[str] = field(default_factory=set)
    ticket_public_ids: set[str] = field(default_factory=set)


class SupportConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[UUID, list[SupportRealtimeConnection]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, user_id: UUID) -> SupportRealtimeConnection:
        """Register an already-accepted WebSocket (call ``accept`` in the route handler)."""
        conn = SupportRealtimeConnection(websocket=websocket, user_id=user_id)
        async with self._lock:
            rows = self._connections.setdefault(user_id, [])
            while len(rows) >= MAX_CONNECTIONS_PER_USER:
                stale = rows.pop(0)
                try:
                    await stale.websocket.close(code=1000)
                except Exception:
                    logger.debug("support_ws_prune_failed user=%s", user_id)
            rows.append(conn)
        return conn

    async def disconnect(self, conn: SupportRealtimeConnection) -> None:
        async with self._lock:
            rows = self._connections.get(conn.user_id, [])
            if conn in rows:
                rows.remove(conn)
            if not rows:
                self._connections.pop(conn.user_id, None)

    async def subscribe_conversation(self, conn: SupportRealtimeConnection, conversation_id: str) -> None:
        conn.conversation_ids.add(conversation_id)

    async def subscribe_ticket(self, conn: SupportRealtimeConnection, ticket_public_id: str) -> None:
        conn.ticket_public_ids.add(ticket_public_id.strip())

    async def broadcast_json(self, payload: dict[str, Any]) -> None:
        conversation_id = payload.get("conversation_id")
        ticket_id = payload.get("ticket_id")
        owner_user_id = payload.get("owner_user_id")
        owner_uuid: UUID | None = None
        if owner_user_id:
            try:
                owner_uuid = UUID(str(owner_user_id))
            except ValueError:
                owner_uuid = None
        targets: list[SupportRealtimeConnection] = []
        async with self._lock:
            for connections in self._connections.values():
                for conn in connections:
                    if owner_uuid is not None and conn.user_id == owner_uuid:
                        targets.append(conn)
                    elif conversation_id and conversation_id in conn.conversation_ids:
                        targets.append(conn)
                    elif ticket_id and ticket_id in conn.ticket_public_ids:
                        targets.append(conn)
                    elif payload.get("type") == "agent:presence" and payload.get("agent_user_id"):
                        agent_id = str(payload["agent_user_id"])
                        if any(agent_id in tid for tid in conn.ticket_public_ids):
                            targets.append(conn)
        seen: set[int] = set()
        for conn in targets:
            key = id(conn.websocket)
            if key in seen:
                continue
            seen.add(key)
            try:
                await conn.websocket.send_text(json.dumps(payload))
            except Exception:
                logger.debug("support_ws_send_failed user=%s", conn.user_id)

    async def send_to_user(self, user_id: UUID, payload: dict[str, Any]) -> None:
        async with self._lock:
            connections = list(self._connections.get(user_id, []))
        body = json.dumps(payload)
        for conn in connections:
            try:
                await conn.websocket.send_text(body)
            except Exception:
                logger.debug("support_ws_user_send_failed user=%s", user_id)


support_connection_manager = SupportConnectionManager()
