from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState
from app.application.admin.rbac_service import get_user_permission_keys
from app.application.auth.user_service import get_user_by_id
from app.application.support.realtime.connection_manager import support_connection_manager
from app.application.support.realtime.events import support_event
from app.application.support.realtime.presence import set_agent_presence
from app.application.support.realtime.publisher import publish_support_realtime_event
from app.application.support.ticket_service import get_ticket_by_public_id
from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.support_models import SupportConversation
from app.infrastructure.security.tokens import decode_access_token

logger = logging.getLogger(__name__)

router = APIRouter()


async def _authenticate_ws(token: str | None) -> User | None:
    if not token:
        return None
    try:
        payload = decode_access_token(token.strip())
        user_id = UUID(str(payload["sub"]))
    except (jwt.InvalidTokenError, ValueError, KeyError):
        return None
    async with AsyncSessionLocal() as session:
        user = await get_user_by_id(session, user_id)
        if user is None:
            return None
        await session.commit()
        return user


async def _safe_accept(websocket: WebSocket) -> bool:
    if websocket.application_state == WebSocketState.CONNECTED:
        return True
    if websocket.application_state != WebSocketState.CONNECTING:
        return False
    try:
        await websocket.accept()
        return True
    except RuntimeError:
        logger.warning("support_ws_accept_skipped", exc_info=True)
        return websocket.application_state == WebSocketState.CONNECTED


async def _user_may_subscribe_ticket(session, user: User, ticket_public_id: str) -> SupportConversation | None:
    ticket = await get_ticket_by_public_id(session, ticket_public_id)
    if ticket is None:
        return None
    permissions = await get_user_permission_keys(session, user.id)
    if "support.tickets.read" in permissions:
        return await session.get(SupportConversation, ticket.conversation_id)
    if ticket.user_id == user.id:
        return await session.get(SupportConversation, ticket.conversation_id)
    return None


@router.websocket("/ws")
async def support_realtime_ws(websocket: WebSocket) -> None:
    settings = get_settings()
    if not settings.support_realtime_enabled:
        await websocket.close(code=1008)
        return

    if not await _safe_accept(websocket):
        return

    token = websocket.query_params.get("token")
    user = await _authenticate_ws(token)
    if user is None:
        await websocket.close(code=1008)
        return

    conn = await support_connection_manager.connect(websocket, user.id)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                frame: dict[str, Any] = json.loads(raw)
            except json.JSONDecodeError:
                continue
            frame_type = str(frame.get("type") or "")
            if frame_type == "subscribe":
                conversation_id = frame.get("conversation_id")
                ticket_id = frame.get("ticket_id")
                async with AsyncSessionLocal() as session:
                    if conversation_id:
                        conversation = await session.get(SupportConversation, UUID(str(conversation_id)))
                        if conversation is not None and conversation.user_id == user.id:
                            await support_connection_manager.subscribe_conversation(conn, str(conversation_id))
                    if ticket_id:
                        allowed = await _user_may_subscribe_ticket(session, user, str(ticket_id))
                        if allowed is not None:
                            await support_connection_manager.subscribe_ticket(conn, str(ticket_id))
                            await support_connection_manager.subscribe_conversation(conn, str(allowed.id))
                    await session.commit()
                await websocket.send_text(json.dumps({"type": "subscribed", "ok": True}))
                continue

            if frame_type == "agent:typing":
                ticket_id = str(frame.get("ticket_id") or "").strip()
                typing = bool(frame.get("typing"))
                if not ticket_id:
                    continue
                conversation_id: str | None = None
                async with AsyncSessionLocal() as session:
                    allowed = await _user_may_subscribe_ticket(session, user, ticket_id)
                    if allowed is not None:
                        permissions = await get_user_permission_keys(session, user.id)
                        if "support.tickets.manage" in permissions:
                            conversation_id = str(allowed.id)
                    await session.commit()
                if conversation_id is None:
                    continue
                event = support_event(
                    "agent:typing",
                    {
                        "conversation_id": conversation_id,
                        "ticket_id": ticket_id,
                        "typing": typing,
                        "agent_user_id": str(user.id),
                    },
                )
                await publish_support_realtime_event(event)
                continue

            if frame_type == "agent:presence":
                status = str(frame.get("status") or "online")
                if status not in {"online", "away"}:
                    status = "online"
                async with AsyncSessionLocal() as session:
                    permissions = await get_user_permission_keys(session, user.id)
                    if "support.tickets.read" not in permissions:
                        await session.commit()
                        continue
                    await session.commit()
                if status == "online":
                    await set_agent_presence(user.id, status="online")
                else:
                    from app.application.support.realtime.presence import clear_agent_presence

                    await clear_agent_presence(user.id)
                for ticket_id in conn.ticket_public_ids:
                    event = support_event(
                        "agent:presence",
                        {
                            "ticket_id": ticket_id,
                            "agent_user_id": str(user.id),
                            "status": status,
                        },
                    )
                    await publish_support_realtime_event(event)
                continue
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("support_ws_session_failed user=%s", user.id)
    finally:
        await support_connection_manager.disconnect(conn)
