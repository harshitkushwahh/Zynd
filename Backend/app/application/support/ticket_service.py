from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.kyc.bootstrap_redaction import mask_pan_display
from app.infrastructure.persistence.models import KycJourneyState, User, UserKycStatus
from app.infrastructure.persistence.support_models import (
    SupportConversation,
    SupportMessage,
    SupportResolutionExample,
    SupportTicket,
)

BOT_SENDER = "Zynd Help Bot"
AUTO_CLOSE_HOURS = 24
RESOLUTION_PROMPT_BODY = "Is this ticket resolved?"
AUTO_CLOSE_BODY = "This ticket was closed automatically after 24 hours with no reply."
RESOLUTION_YES_BODY = "You marked this ticket as resolved."
RESOLUTION_NO_BODY = "This ticket stays in progress."


class SupportActionError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def resolution_window_elapsed(
    prompted_at: datetime | None,
    choice: str | None,
    status: str,
    *,
    now: datetime | None = None,
) -> bool:
    if status == "resolved" or choice or prompted_at is None:
        return False
    moment = now or utcnow()
    return _aware(prompted_at) <= moment - timedelta(hours=AUTO_CLOSE_HOURS)


def person_name(user: User, *, fallback: str = "Customer") -> str:
    parts = [part.strip() for part in (user.first_name or "", user.last_name or "") if part and part.strip()]
    return " ".join(parts) or fallback


def mask_email(email: str | None) -> str:
    if not email or "@" not in email:
        return "—"
    local, domain = email.split("@", 1)
    if not local or not domain:
        return "—"
    return f"{local[:1]}***@{domain}"


def mask_phone(phone: str | None) -> str:
    if not phone:
        return "—"
    digits = "".join(char for char in phone if char.isdigit())
    if len(digits) < 4:
        return "—"
    return f"••••••{digits[-4:]}"


def _optional_masked(value: str | None) -> str | None:
    if not value or value.strip() in {"—", "-", ""}:
        return None
    return value


def _optional_field(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text in {"—", "-", "none", "unknown"}:
        return None
    return text


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


async def find_active_conversation(db: AsyncSession, user_id: UUID) -> SupportConversation | None:
    return await db.scalar(
        select(SupportConversation)
        .where(
            SupportConversation.user_id == user_id,
            SupportConversation.status != "closed",
        )
        .order_by(SupportConversation.created_at.desc())
        .limit(1)
    )


async def create_conversation(db: AsyncSession, user_id: UUID) -> SupportConversation:
    now = utcnow()
    conversation = SupportConversation(
        user_id=user_id,
        status="open",
        handler="bot",
        created_at=now,
        updated_at=now,
    )
    db.add(conversation)
    await db.flush()
    return conversation


async def list_messages(db: AsyncSession, conversation_id: UUID) -> list[SupportMessage]:
    result = await db.execute(
        select(SupportMessage)
        .where(SupportMessage.conversation_id == conversation_id)
        .order_by(SupportMessage.created_at.asc())
    )
    return list(result.scalars())


async def add_message(
    db: AsyncSession,
    conversation: SupportConversation,
    *,
    role: str,
    body: str,
    visibility: str = "customer",
    sender_name: str | None = None,
    author_user_id: UUID | None = None,
    kind: str = "text",
    attachment_document_id: UUID | None = None,
    attachment_filename: str | None = None,
) -> SupportMessage:
    now = utcnow()
    message = SupportMessage(
        conversation_id=conversation.id,
        author_user_id=author_user_id,
        role=role,
        visibility=visibility,
        kind=kind,
        sender_name=sender_name,
        body=body.strip(),
        attachment_document_id=attachment_document_id,
        attachment_filename=attachment_filename,
        created_at=now,
    )
    db.add(message)
    conversation.updated_at = utcnow()
    await db.flush()
    if visibility == "customer":
        ticket = await get_ticket_for_conversation(db, conversation.id)
        schedule_message_realtime(
            conversation_id=conversation.id,
            ticket_public_id=ticket.public_id if ticket else None,
            message=serialize_message(message),
        )
    return message


async def reopen_for_agent(db: AsyncSession, conversation: SupportConversation) -> None:
    """Keep a single active thread per customer when an agent replies after resolve."""
    active = await find_active_conversation(db, conversation.user_id)
    if active is not None and active.id != conversation.id:
        return
    conversation.status = "escalated"
    conversation.handler = "human"


async def get_ticket_for_conversation(db: AsyncSession, conversation_id: UUID) -> SupportTicket | None:
    return await db.scalar(select(SupportTicket).where(SupportTicket.conversation_id == conversation_id))


async def get_ticket_by_public_id(db: AsyncSession, public_id: str) -> SupportTicket | None:
    return await db.scalar(select(SupportTicket).where(SupportTicket.public_id == public_id.strip()))


async def _next_public_id(db: AsyncSession) -> str:
    value = await db.scalar(text("SELECT nextval('support_ticket_public_seq')"))
    return f"TKT-{int(value)}"


async def ensure_ticket(
    db: AsyncSession,
    conversation: SupportConversation,
    user: User,
    *,
    body: str,
    topics: tuple[str, ...] | list[str],
    handled_by: str,
    status: str,
    escalation_reason: str | None = None,
) -> SupportTicket:
    from app.application.support.support_intelligence_router import apply_support_intelligence

    now = utcnow()
    topic_list = [topic for topic in topics if topic] or ["other"]
    primary = topic_list[0]
    ticket = await get_ticket_for_conversation(db, conversation.id)
    if ticket is None:
        ticket = SupportTicket(
            public_id=await _next_public_id(db),
            conversation_id=conversation.id,
            user_id=user.id,
            subject=body.strip()[:160] or "Support request",
            description=body.strip()[:500],
            topic=primary,
            topics=topic_list,
            status=status,
            priority="medium",
            channel="web_chat",
            handled_by=handled_by,
            escalation_reason=escalation_reason,
            first_response_due_at=None,
            resolution_due_at=None,
            first_responded_at=now if status == "resolved" else None,
            resolved_at=now if status == "resolved" else None,
            created_at=now,
            updated_at=now,
        )
        db.add(ticket)
    else:
        if ticket.topic == "other" and primary != "other":
            ticket.topic = primary
        ticket.topics = topic_list
        ticket.description = body.strip()[:500]
        ticket.handled_by = handled_by
        ticket.status = status
        ticket.updated_at = now
        if escalation_reason:
            ticket.escalation_reason = escalation_reason
        if status == "resolved":
            ticket.resolved_at = now
            if ticket.first_responded_at is None:
                ticket.first_responded_at = now
        else:
            ticket.resolved_at = None
        if handled_by == "bot" and status == "pending" and ticket.first_responded_at is None:
            ticket.first_responded_at = now
    await db.flush()
    if ticket.handled_by == "human" or escalation_reason:
        trigger = "escalation" if escalation_reason else "ensure_ticket"
        await apply_support_intelligence(db, ticket, user, trigger=trigger, force=True)
    await db.flush()
    from app.application.support.ticket_list_cache import bump_customer_ticket_list_cache_version

    await bump_customer_ticket_list_cache_version(user.id)
    return ticket


def parse_resolution_choice(text: str) -> str | None:
    normalized = " ".join(text.strip().lower().replace(",", " ").split())
    if normalized in {
        "yes",
        "y",
        "yes resolved",
        "resolved",
        "it is resolved",
        "ticket resolved",
    }:
        return "yes"
    if normalized in {
        "no",
        "n",
        "no still open",
        "not resolved",
        "still open",
        "not yet",
    }:
        return "no"
    return None


def _is_resolution_prompt_message(message: SupportMessage) -> bool:
    if (message.kind or "text") == "resolution_prompt":
        return True
    return (
        message.role == "system"
        and message.visibility == "customer"
        and message.body.strip() == RESOLUTION_PROMPT_BODY
    )


def serialize_message(
    message: SupportMessage,
    *,
    resolution_active: bool = False,
) -> dict[str, Any]:
    kind = "resolution_prompt" if _is_resolution_prompt_message(message) else (message.kind or "text")
    return {
        "id": str(message.id),
        "role": message.role,
        "body": message.body,
        "created_at": _iso(message.created_at),
        "sender_name": message.sender_name,
        "visibility": message.visibility,
        "kind": kind,
        "attachment_document_id": str(message.attachment_document_id) if message.attachment_document_id else None,
        "attachment_filename": message.attachment_filename,
        "resolution_active": resolution_active,
    }


def _prompt_is_active(ticket: SupportTicket | None, message: SupportMessage, latest_prompt_id: UUID | None) -> bool:
    return bool(
        ticket is not None
        and _is_resolution_prompt_message(message)
        and message.id == latest_prompt_id
        and ticket.status != "resolved"
        and ticket.resolution_choice is None
        and ticket.resolution_prompted_at is not None
    )


async def serialize_customer_conversation(
    db: AsyncSession,
    user: User,
    conversation: SupportConversation | None,
) -> dict[str, Any]:
    if conversation is None:
        return {
            "id": None,
            "status": "open",
            "handler": "bot",
            "participant": "bot",
            "ticket_id": None,
            "ticket_status": None,
            "assignee_name": None,
            "agent_presence": None,
            "resolution_open": False,
            "messages": [],
        }
    ticket = await get_ticket_for_conversation(db, conversation.id)
    stored = [message for message in await list_messages(db, conversation.id) if message.visibility == "customer"]
    prompt_ids = [message.id for message in stored if _is_resolution_prompt_message(message)]
    latest_prompt_id = prompt_ids[-1] if prompt_ids else None
    messages = [
        serialize_message(message, resolution_active=_prompt_is_active(ticket, message, latest_prompt_id))
        for message in stored
    ]
    resolution_open = any(message["resolution_active"] for message in messages)
    participant = conversation.handler if conversation.handler in {"bot", "human"} else "bot"
    assignee_name: str | None = None
    agent_presence: str | None = None
    if participant == "human" and ticket is not None:
        if ticket.assignee_id:
            names = await _assignee_names(db, [ticket])
            assignee_name = names.get(ticket.assignee_id)
        from app.application.support.realtime.presence import resolve_agent_presence_for_customer

        agent_presence = await resolve_agent_presence_for_customer(
            assignee_id=ticket.assignee_id,
            messages=messages,
        )
    return {
        "id": str(conversation.id),
        "status": conversation.status,
        "handler": conversation.handler,
        "participant": participant,
        "ticket_id": ticket.public_id if ticket else None,
        "ticket_status": ticket.status if ticket else None,
        "assignee_name": assignee_name,
        "agent_presence": agent_presence,
        "resolution_open": resolution_open,
        "messages": messages,
    }


def schedule_conversation_realtime_snapshot(
    *,
    conversation_id: UUID,
    ticket_public_id: str | None,
    snapshot: dict[str, Any],
    owner_user_id: UUID | None = None,
) -> None:
    from app.application.support.realtime.events import support_event
    from app.application.support.realtime.publisher import schedule_support_realtime_event

    event_payload: dict[str, Any] = {
        "conversation_id": str(conversation_id),
        "ticket_id": ticket_public_id,
        "handler": snapshot.get("handler"),
        "participant": snapshot.get("participant"),
        "ticket_status": snapshot.get("ticket_status"),
        "assignee_name": snapshot.get("assignee_name"),
        "agent_presence": snapshot.get("agent_presence"),
        "resolution_open": snapshot.get("resolution_open"),
        "status": snapshot.get("status"),
    }
    if owner_user_id is not None:
        event_payload["owner_user_id"] = str(owner_user_id)
    schedule_support_realtime_event(support_event("ticket:updated", event_payload))


def schedule_message_realtime(
    *,
    conversation_id: UUID,
    ticket_public_id: str | None,
    message: dict[str, Any],
) -> None:
    from app.application.support.realtime.events import support_event
    from app.application.support.realtime.publisher import schedule_support_realtime_event

    schedule_support_realtime_event(
        support_event(
            "message:new",
            {
                "conversation_id": str(conversation_id),
                "ticket_id": ticket_public_id,
                "message": message,
            },
        )
    )


def schedule_conversation_locked(
    *,
    conversation_id: UUID,
    ticket_public_id: str | None,
    owner_user_id: UUID | None = None,
) -> None:
    from app.application.support.realtime.events import support_event
    from app.application.support.realtime.publisher import schedule_support_realtime_event

    event_payload: dict[str, Any] = {
        "conversation_id": str(conversation_id),
        "ticket_id": ticket_public_id,
    }
    if owner_user_id is not None:
        event_payload["owner_user_id"] = str(owner_user_id)
    schedule_support_realtime_event(support_event("conversation:locked", event_payload))


async def _assignee_names(db: AsyncSession, tickets: list[SupportTicket]) -> dict[UUID, str]:
    ids = {ticket.assignee_id for ticket in tickets if ticket.assignee_id}
    if not ids:
        return {}
    result = await db.execute(select(User).where(User.id.in_(ids)))
    return {user.id: person_name(user, fallback="Support") for user in result.scalars()}


async def _client_codes(db: AsyncSession, tickets: list[SupportTicket]) -> dict[UUID, str]:
    ids = {ticket.user_id for ticket in tickets}
    if not ids:
        return {}
    result = await db.execute(select(User).where(User.id.in_(ids)))
    return {user.id: user.client_id for user in result.scalars()}


def serialize_ticket(
    ticket: SupportTicket,
    *,
    client_code: str,
    assignee_name: str | None,
    messages: list[dict[str, Any]] | None = None,
    include_sla: bool = False,
) -> dict[str, Any]:
    from app.application.support.ticket_routing_service import sla_snapshot

    payload: dict[str, Any] = {
        "id": ticket.public_id,
        "subject": ticket.subject,
        "description": ticket.description,
        "topic": ticket.topic,
        "status": ticket.status,
        "priority": ticket.priority,
        "user_id": client_code,
        "assignee_id": str(ticket.assignee_id) if ticket.assignee_id else None,
        "assignee_name": assignee_name,
        "created_at": _iso(ticket.created_at),
        "updated_at": _iso(ticket.updated_at),
        "channel": ticket.channel,
        "handled_by": ticket.handled_by,
        "escalation_reason": ticket.escalation_reason,
        "first_response_due_at": _iso(ticket.first_response_due_at),
        "resolution_due_at": _iso(ticket.resolution_due_at),
        "first_responded_at": _iso(ticket.first_responded_at),
        "resolved_at": _iso(ticket.resolved_at),
        "messages": messages or [],
        "attachments": [
            {
                "id": message["id"],
                "file_name": message.get("attachment_filename") or "Image",
            }
            for message in (messages or [])
            if message.get("attachment_document_id")
        ],
    }
    if include_sla:
        payload["sla"] = sla_snapshot(ticket)
    from app.application.support.support_intelligence_router import serialize_routing_metadata, ticket_urgency_score

    routing = serialize_routing_metadata(ticket)
    if routing is not None:
        payload["routing"] = routing
    payload["urgency_score"] = ticket_urgency_score(ticket)
    return payload


CUSTOMER_TICKET_LIST_MAX_LIMIT = 50


async def list_customer_tickets_page(
    db: AsyncSession,
    user: User,
    *,
    offset: int,
    limit: int,
) -> dict[str, Any]:
    from app.application.support.ticket_list_cache import (
        read_cached_customer_ticket_page,
        write_cached_customer_ticket_page,
    )

    safe_offset = max(0, offset)
    safe_limit = min(max(1, limit), CUSTOMER_TICKET_LIST_MAX_LIMIT)

    cached = await read_cached_customer_ticket_page(
        user.id,
        offset=safe_offset,
        limit=safe_limit,
    )
    if cached is not None:
        return cached

    await close_stale_resolution_prompts(db, user_id=user.id)
    result = await db.execute(
        select(SupportTicket)
        .where(SupportTicket.user_id == user.id)
        .order_by(SupportTicket.updated_at.desc(), SupportTicket.id.desc())
        .offset(safe_offset)
        .limit(safe_limit + 1)
    )
    rows = list(result.scalars())
    has_more = len(rows) > safe_limit
    tickets = rows[:safe_limit]
    names = await _assignee_names(db, tickets)
    items = [
        serialize_ticket(
            ticket,
            client_code=user.client_id,
            assignee_name=names.get(ticket.assignee_id) if ticket.assignee_id else None,
        )
        for ticket in tickets
    ]
    payload = {
        "items": items,
        "has_more": has_more,
        "next_offset": safe_offset + len(items),
    }
    await write_cached_customer_ticket_page(
        user.id,
        offset=safe_offset,
        limit=safe_limit,
        payload=payload,
    )
    return payload


async def list_console_tickets(
    db: AsyncSession,
    *,
    queue: str = "escalated",
    client_id: str | None = None,
) -> list[dict[str, Any]]:
    await close_stale_resolution_prompts(db)
    query = select(SupportTicket)
    if queue == "escalated":
        query = query.where(SupportTicket.handled_by == "human", SupportTicket.status != "resolved")
    elif queue == "bot":
        query = query.where(SupportTicket.handled_by == "bot")
    if client_id and client_id.strip():
        query = query.join(User, User.id == SupportTicket.user_id).where(User.client_id == client_id.strip())
    result = await db.execute(query.order_by(SupportTicket.updated_at.desc()).limit(200))
    tickets = list(result.scalars())
    from app.application.support.support_intelligence_router import ticket_urgency_score
    from app.application.support.ticket_routing_service import PRIORITY_RANK

    # List is read-only: use persisted routing_metadata for urgency sort. Intelligence runs on
    # ticket detail, escalation, and customer messages — not on every console list poll.
    tickets.sort(
        key=lambda row: (
            ticket_urgency_score(row),
            PRIORITY_RANK.get(row.priority, 0),
            _aware(row.updated_at) if row.updated_at else utcnow(),
        ),
        reverse=True,
    )
    names = await _assignee_names(db, tickets)
    codes = await _client_codes(db, tickets)
    return [
        serialize_ticket(
            ticket,
            client_code=codes.get(ticket.user_id, ""),
            assignee_name=names.get(ticket.assignee_id) if ticket.assignee_id else None,
            include_sla=True,
        )
        for ticket in tickets
    ]


def _kyc_label(overall: str | None) -> tuple[str, bool]:
    if overall == "completed":
        return "Verified", True
    if overall in {"submitted", "phase1_complete", "phase2_complete", "in_progress"}:
        return overall.replace("_", " ").title(), False
    return "Not started", False


async def customer_snapshot(db: AsyncSession, user: User) -> dict[str, Any]:
    status = await db.get(UserKycStatus, user.id)
    journey = await db.get(KycJourneyState, user.id)
    overall = status.overall_status.value if status else "none"
    label, compliant = _kyc_label(overall)
    pan_masked: str | None = None
    if journey and isinstance(journey.pan_draft_json, dict):
        masked = mask_pan_display(str(journey.pan_draft_json.get("panNumber") or "") or None)
        if masked:
            pan_masked = masked
    return {
        "display_name": person_name(user),
        "email_masked": _optional_masked(mask_email(user.email)),
        "mobile_masked": _optional_masked(mask_phone(user.phone)),
        "pan_masked": pan_masked,
        "aadhaar_masked": None,
        "kyc_status_label": label,
        "kyc_compliant": compliant,
        "client_type": "Individual",
        "onboarding_date": _iso(user.created_at),
    }


def domain_context(topic: str, pack: dict[str, Any], client_code: str) -> dict[str, Any] | None:
    user_href = f"/dashboard/users/{client_code}"
    if topic == "kyc":
        kyc = pack.get("kyc") or {}
        return {
            "title": "KYC",
            "view_in_href": f"{user_href}?tab=kyc",
            "view_in_label": "View KYC",
            "status_label": str(kyc.get("overall_status") or "unknown"),
            "status_variant": "success" if kyc.get("overall_status") == "completed" else "warning",
            "fields": [
                {"label": "Overall status", "value": _optional_field(kyc.get("overall_status"))},
                {"label": "Last step", "value": _optional_field(kyc.get("last_completed_step"))},
                {"label": "PAN check", "value": _optional_field(kyc.get("pan_verification_status"))},
                {"label": "Bank check", "value": _optional_field(kyc.get("bank_verification_status"))},
            ],
        }
    if topic in {"payment", "portfolio"}:
        payments = pack.get("payments") or {}
        portfolio = pack.get("portfolio") or {}
        orders = payments.get("recent_orders") or []
        latest = orders[0] if orders else {}
        return {
            "title": "Payments and portfolio",
            "view_in_href": f"{user_href}?tab=portfolio",
            "view_in_label": "View portfolio",
            "status_label": str(latest.get("status") or portfolio.get("status") or "—"),
            "status_variant": "info",
            "fields": [
                {"label": "Latest order", "value": str(latest.get("amount") or "No recent order")},
                {"label": "Order status", "value": str(latest.get("status") or "—")},
                {"label": "Portfolio value", "value": str(portfolio.get("current_value") or "—")},
                {"label": "Holdings", "value": str(portfolio.get("holdings_count") if portfolio.get("holdings_count") is not None else "—")},
            ],
        }
    if topic == "goals":
        goals = (pack.get("goals") or {}).get("goals") or []
        first = goals[0] if goals else {}
        return {
            "title": "Goals",
            "view_in_href": user_href,
            "view_in_label": "View customer",
            "status_label": str(first.get("status") or "No goals"),
            "status_variant": "info",
            "fields": [
                {"label": "Goal", "value": str(first.get("title") or "—")},
                {"label": "Target", "value": str(first.get("target_amount") or "—")},
                {"label": "Saved", "value": str(first.get("current_amount") or "—")},
            ],
        }
    if topic == "family":
        groups = (pack.get("family_groups") or {}).get("groups") or []
        first = groups[0] if groups else {}
        return {
            "title": "Family group",
            "view_in_href": user_href,
            "view_in_label": "View customer",
            "status_label": str(first.get("status") or "No group"),
            "status_variant": "info",
            "fields": [
                {"label": "Group", "value": str(first.get("title") or "—")},
                {"label": "Role", "value": str(first.get("my_role") or "—")},
                {"label": "Members", "value": str(first.get("member_count") if first.get("member_count") is not None else "—")},
            ],
        }
    if topic == "referrals":
        referrals = pack.get("referrals") or {}
        return {
            "title": "Referrals",
            "view_in_href": user_href,
            "view_in_label": "View customer",
            "status_label": "Code ready" if referrals.get("has_code") else "No code yet",
            "status_variant": "info",
            "fields": [
                {"label": "Signups", "value": str(referrals.get("signup_count", "—"))},
                {"label": "KYC verified", "value": str(referrals.get("kyc_verified_count", "—"))},
            ],
        }
    if topic == "account":
        account = pack.get("account") or {}
        return {
            "title": "Account",
            "view_in_href": user_href,
            "view_in_label": "View profile",
            "status_label": str(account.get("account_status") or "—"),
            "status_variant": "info",
            "fields": [
                {"label": "Email verified", "value": "Yes" if account.get("email_verified") else "No"},
                {"label": "Phone verified", "value": "Yes" if account.get("phone_verified") else "No"},
                {"label": "MFA", "value": "On" if account.get("mfa_enrolled") else "Off"},
            ],
        }
    return None


async def dismiss_open_resolution_prompt(db: AsyncSession, ticket: SupportTicket | None) -> None:
    if ticket is None or ticket.status == "resolved":
        return
    if ticket.resolution_prompted_at is not None and ticket.resolution_choice is None:
        ticket.resolution_choice = "no"
        ticket.resolution_prompted_at = None
        ticket.status = "pending"
        ticket.updated_at = utcnow()
        await db.flush()


async def ask_if_resolved(
    db: AsyncSession,
    conversation: SupportConversation,
    ticket: SupportTicket,
    *,
    sender_name: str,
) -> None:
    now = utcnow()
    ticket.status = "pending"
    ticket.resolved_at = None
    ticket.resolution_prompted_at = now
    ticket.resolution_choice = None
    ticket.updated_at = now
    await add_message(
        db,
        conversation,
        role="system",
        body=RESOLUTION_PROMPT_BODY,
        sender_name=sender_name,
        kind="resolution_prompt",
    )


async def close_stale_resolution_prompts(db: AsyncSession, *, user_id: UUID | None = None) -> None:
    now = utcnow()
    cutoff = now - timedelta(hours=AUTO_CLOSE_HOURS)
    query = select(SupportTicket).where(
        SupportTicket.status != "resolved",
        SupportTicket.resolution_choice.is_(None),
        SupportTicket.resolution_prompted_at.is_not(None),
        SupportTicket.resolution_prompted_at <= cutoff,
    )
    if user_id is not None:
        query = query.where(SupportTicket.user_id == user_id)
    result = await db.execute(query)
    for ticket in result.scalars():
        if not resolution_window_elapsed(
            ticket.resolution_prompted_at,
            ticket.resolution_choice,
            ticket.status,
            now=now,
        ):
            continue
        conversation = await db.get(SupportConversation, ticket.conversation_id)
        ticket.status = "resolved"
        ticket.resolution_choice = "auto"
        ticket.resolved_at = now
        ticket.updated_at = now
        if conversation is not None:
            await add_message(
                db,
                conversation,
                role="system",
                body=AUTO_CLOSE_BODY,
                sender_name=BOT_SENDER,
            )
            conversation.status = "closed"
        await store_resolution_examples(db, ticket)
    await db.flush()


async def customer_ticket_thread(db: AsyncSession, user: User, public_id: str) -> dict[str, Any]:
    await close_stale_resolution_prompts(db, user_id=user.id)
    ticket = await get_ticket_by_public_id(db, public_id)
    if ticket is None or ticket.user_id != user.id:
        raise SupportActionError("ticket_not_found", "Ticket not found.", 404)
    conversation = await db.get(SupportConversation, ticket.conversation_id)
    if conversation is None:
        raise SupportActionError("ticket_not_found", "Ticket not found.", 404)
    return await serialize_customer_conversation(db, user, conversation)


async def respond_to_resolution(
    db: AsyncSession,
    user: User,
    public_id: str,
    choice: str,
) -> dict[str, Any]:
    await close_stale_resolution_prompts(db, user_id=user.id)
    ticket = await get_ticket_by_public_id(db, public_id)
    if ticket is None or ticket.user_id != user.id:
        raise SupportActionError("ticket_not_found", "Ticket not found.", 404)
    conversation = await db.get(SupportConversation, ticket.conversation_id)
    if conversation is None:
        raise SupportActionError("ticket_not_found", "Ticket not found.", 404)
    if choice not in {"yes", "no"}:
        raise SupportActionError("invalid_choice", "Choose yes or no.")
    if ticket.status != "resolved":
        now = utcnow()
        if choice == "yes":
            ticket.status = "resolved"
            ticket.resolution_choice = "yes"
            ticket.resolved_at = now
            conversation.status = "closed"
            await add_message(
                db,
                conversation,
                role="system",
                body=RESOLUTION_YES_BODY,
                sender_name=BOT_SENDER,
            )
            await store_resolution_examples(db, ticket)
        else:
            ticket.status = "pending"
            ticket.resolution_choice = "no"
            ticket.resolution_prompted_at = None
            ticket.resolved_at = None
            await add_message(
                db,
                conversation,
                role="system",
                body=RESOLUTION_NO_BODY,
                sender_name=BOT_SENDER,
            )
        ticket.updated_at = now
        await db.flush()
        from app.application.support.ticket_list_cache import bump_customer_ticket_list_cache_version

        await bump_customer_ticket_list_cache_version(user.id)
        if choice == "yes":
            schedule_conversation_locked(
                conversation_id=conversation.id,
                ticket_public_id=ticket.public_id,
                owner_user_id=user.id,
            )
        snapshot = await serialize_customer_conversation(db, user, conversation)
        schedule_conversation_realtime_snapshot(
            conversation_id=conversation.id,
            ticket_public_id=ticket.public_id,
            snapshot=snapshot,
            owner_user_id=user.id,
        )
    return await serialize_customer_conversation(db, user, conversation)


async def _notify_customer_conversation_realtime(
    db: AsyncSession,
    *,
    conversation: SupportConversation,
    ticket: SupportTicket | None,
) -> None:
    from app.application.support.ticket_list_cache import bump_customer_ticket_list_cache_version

    await bump_customer_ticket_list_cache_version(conversation.user_id)
    customer = await db.get(User, conversation.user_id)
    if customer is None:
        return
    snapshot = await serialize_customer_conversation(db, customer, conversation)
    schedule_conversation_realtime_snapshot(
        conversation_id=conversation.id,
        ticket_public_id=ticket.public_id if ticket else None,
        snapshot=snapshot,
        owner_user_id=customer.id,
    )
    if conversation.status == "closed" or (ticket is not None and ticket.status == "resolved"):
        schedule_conversation_locked(
            conversation_id=conversation.id,
            ticket_public_id=ticket.public_id if ticket else None,
            owner_user_id=customer.id,
        )


async def console_ticket_detail(db: AsyncSession, public_id: str) -> dict[str, Any]:
    await close_stale_resolution_prompts(db)
    ticket = await get_ticket_by_public_id(db, public_id)
    if ticket is None:
        raise SupportActionError("ticket_not_found", "Ticket not found.", 404)
    user = await db.get(User, ticket.user_id)
    if user is None:
        raise SupportActionError("ticket_not_found", "Ticket not found.", 404)
    if ticket.assignee_id is None and ticket.status in {"open", "pending"}:
        from app.application.support.support_intelligence_router import apply_support_intelligence

        await apply_support_intelligence(db, ticket, user, trigger="ticket_detail", force=False)
        await db.flush()
    messages = [
        serialize_message(message) for message in await list_messages(db, ticket.conversation_id)
    ]
    names = await _assignee_names(db, [ticket])
    recent_result = await db.execute(
        select(SupportTicket)
        .where(SupportTicket.user_id == user.id, SupportTicket.id != ticket.id)
        .order_by(SupportTicket.updated_at.desc())
        .limit(5)
    )
    recent = list(recent_result.scalars())
    recent_names = await _assignee_names(db, recent)
    from app.application.support.context_pack import build_context_pack

    topics = tuple(ticket.topics or [ticket.topic])
    pack = await build_context_pack(db, user, topics)
    from app.application.support.ticket_linked_records_service import build_ticket_linked_records

    await db.refresh(ticket)
    return {
        "ticket": serialize_ticket(
            ticket,
            client_code=user.client_id,
            assignee_name=names.get(ticket.assignee_id) if ticket.assignee_id else None,
            messages=messages,
            include_sla=True,
        ),
        "customer": await customer_snapshot(db, user),
        "domain": domain_context(ticket.topic, pack, user.client_id),
        "linked_records": await build_ticket_linked_records(db, user=user, ticket=ticket),
        "recent_tickets": [
            serialize_ticket(
                row,
                client_code=user.client_id,
                assignee_name=recent_names.get(row.assignee_id) if row.assignee_id else None,
            )
            for row in recent
        ],
    }


async def add_agent_reply(
    db: AsyncSession,
    public_id: str,
    agent: User,
    *,
    body: str,
    internal: bool,
    resolution_prompt: bool = False,
) -> dict[str, Any]:
    ticket = await get_ticket_by_public_id(db, public_id)
    if ticket is None:
        raise SupportActionError("ticket_not_found", "Ticket not found.", 404)
    conversation = await db.get(SupportConversation, ticket.conversation_id)
    if conversation is None:
        raise SupportActionError("ticket_not_found", "Ticket not found.", 404)
    cleaned = body.strip()
    if not cleaned and not resolution_prompt:
        raise SupportActionError("empty_message", "Write a message before sending.")
    if resolution_prompt and internal:
        raise SupportActionError("invalid_message", "A resolution question is sent to the customer.")
    now = utcnow()
    sender = person_name(agent, fallback="Support")
    if cleaned:
        await add_message(
            db,
            conversation,
            role="agent",
            body=cleaned,
            visibility="internal" if internal else "customer",
            sender_name=sender,
            author_user_id=agent.id,
        )
    if not internal or resolution_prompt:
        if ticket.assignee_id is None:
            ticket.assignee_id = agent.id
        if ticket.first_responded_at is None:
            ticket.first_responded_at = now
        ticket.updated_at = now
        ticket.handled_by = "human"
        if ticket.status == "resolved":
            ticket.status = "pending"
            ticket.resolved_at = None
        elif ticket.status == "open":
            ticket.status = "pending"
        await reopen_for_agent(db, conversation)
    if resolution_prompt:
        await ask_if_resolved(db, conversation, ticket, sender_name=sender)
    await _notify_customer_conversation_realtime(db, conversation=conversation, ticket=ticket)
    return await console_ticket_detail(db, ticket.public_id)


async def update_console_ticket(
    db: AsyncSession,
    public_id: str,
    agent: User,
    *,
    status: str | None,
    assign_to_self: bool,
) -> dict[str, Any]:
    ticket = await get_ticket_by_public_id(db, public_id)
    if ticket is None:
        raise SupportActionError("ticket_not_found", "Ticket not found.", 404)
    conversation = await db.get(SupportConversation, ticket.conversation_id)
    if conversation is None:
        raise SupportActionError("ticket_not_found", "Ticket not found.", 404)
    now = utcnow()
    if assign_to_self:
        ticket.assignee_id = agent.id
        ticket.handled_by = "human"
        await reopen_for_agent(db, conversation)
        if ticket.status == "open":
            ticket.status = "pending"
    if status:
        if status not in {"open", "pending", "resolved"}:
            raise SupportActionError("invalid_status", "Status must be open, pending, or resolved.")
        ticket.status = status
        ticket.handled_by = "human"
        if status == "resolved":
            ticket.resolved_at = now
            if ticket.resolution_choice is None:
                ticket.resolution_choice = "yes"
            conversation.status = "closed"
            conversation.handler = "human"
            await store_resolution_examples(db, ticket)
        else:
            ticket.resolved_at = None
            ticket.resolution_choice = None
            ticket.resolution_prompted_at = None
            await reopen_for_agent(db, conversation)
    ticket.updated_at = now
    await db.flush()
    await _notify_customer_conversation_realtime(db, conversation=conversation, ticket=ticket)
    if status == "resolved":
        from app.application.support.webhook_dispatcher import schedule_support_webhook

        schedule_support_webhook(
            "ticket.resolved",
            {
                "ticket_id": ticket.public_id,
                "user_id": str(ticket.user_id),
                "status": ticket.status,
            },
        )
    return await console_ticket_detail(db, ticket.public_id)


async def store_resolution_examples(db: AsyncSession, ticket: SupportTicket) -> None:
    messages = await list_messages(db, ticket.conversation_id)
    last_question: str | None = None
    pairs: list[tuple[str, str]] = []
    for message in messages:
        if message.visibility != "customer" or message.kind == "resolution_prompt":
            continue
        if message.role == "user":
            last_question = message.body
        elif message.role == "agent" and last_question:
            pairs.append((last_question, message.body))
    existing = await db.execute(
        select(SupportResolutionExample).where(SupportResolutionExample.ticket_id == ticket.id)
    )
    for row in existing.scalars():
        await db.delete(row)
    for question, answer in pairs[-5:]:
        db.add(
            SupportResolutionExample(
                ticket_id=ticket.id,
                topic=ticket.topic,
                question=question[:2000],
                answer=answer[:2000],
            )
        )
    await db.flush()


async def similar_resolutions(
    db: AsyncSession,
    question: str,
    topics: tuple[str, ...] | list[str],
) -> list[dict[str, str]]:
    cleaned = " ".join(question.split())
    if len(cleaned) < 3:
        return []
    try:
        return await _ranked_resolutions(db, cleaned, topics)
    except Exception:
        return []


async def _ranked_resolutions(
    db: AsyncSession,
    cleaned: str,
    topics: tuple[str, ...] | list[str],
) -> list[dict[str, str]]:
    rank = func.ts_rank(
        SupportResolutionExample.search_vector,
        func.plainto_tsquery("english", cleaned),
    )
    match = SupportResolutionExample.search_vector.op("@@")(func.plainto_tsquery("english", cleaned))

    async def _fetch(filter_topic: bool) -> list[SupportResolutionExample]:
        query = select(SupportResolutionExample).where(match).order_by(rank.desc()).limit(3)
        if filter_topic and topics:
            query = query.where(SupportResolutionExample.topic.in_(list(topics)))
        result = await db.execute(query)
        return list(result.scalars())

    rows = await _fetch(True)
    if not rows:
        rows = await _fetch(False)
    return [{"question": row.question, "answer": row.answer} for row in rows]
