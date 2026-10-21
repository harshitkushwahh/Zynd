"""Support AI routing: Ollama decisions + analytics fallback."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.support.ollama_client import OllamaError, RoutingDecision, complete_routing_decision, resolve_llm_model
from app.application.support.realtime.presence import read_agent_presence
from app.application.support.support_intelligence_features import build_support_routing_features
from app.application.support.ticket_routing_service import PRIORITY_RANK, _merge_priority, sla_snapshot
from app.core.config import get_settings
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.support_models import SupportTicket, SupportTicketRoutingEvent

logger = logging.getLogger(__name__)

OPEN_STATUSES = ("open", "pending")

SLA_BOUNDS: dict[str, tuple[tuple[float, float], tuple[float, float]]] = {
    "high": ((0.5, 4.0), (4.0, 24.0)),
    "medium": ((1.0, 8.0), (8.0, 48.0)),
    "low": ((2.0, 12.0), (12.0, 72.0)),
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _clamp_hours(value: float, bounds: tuple[float, float]) -> float:
    low, high = bounds
    return max(low, min(high, value))


def _routing_needs_refresh(ticket: SupportTicket, *, debounce_seconds: int) -> bool:
    meta = ticket.routing_metadata if isinstance(ticket.routing_metadata, dict) else None
    if not meta or not meta.get("computed_at"):
        return True
    try:
        computed = _aware(datetime.fromisoformat(str(meta["computed_at"]).replace("Z", "+00:00")))
    except ValueError:
        return True
    return (_utcnow() - computed).total_seconds() >= debounce_seconds


def _pick_fallback_assignee(features: dict[str, Any]) -> str | None:
    candidates = features.get("agent_candidates")
    if not isinstance(candidates, list) or not candidates:
        return None

    def score(row: dict[str, Any]) -> float:
        backlog = float(row.get("open_backlog") or 0)
        presence = str(row.get("presence") or "offline")
        multiplier = {"online": 0.65, "away": 1.0}.get(presence, 1.35)
        topic = features.get("ticket", {}).get("topic")
        topic_load = row.get("open_by_topic") if isinstance(row.get("open_by_topic"), dict) else {}
        topic_bonus = float(topic_load.get(topic, 0)) * 0.15
        resolved = float(row.get("resolved_last_7d") or 0)
        return backlog * multiplier + topic_bonus - min(resolved, 10) * 0.05

    best = min(candidates, key=lambda row: (score(row), str(row.get("id"))))
    return str(best.get("id")) if best.get("id") else None


def _fallback_decision(features: dict[str, Any]) -> RoutingDecision:
    ticket = features.get("ticket") if isinstance(features.get("ticket"), dict) else {}
    customer = features.get("customer") if isinstance(features.get("customer"), dict) else {}
    signals = list(ticket.get("behavior_signals") or [])
    wait = float(ticket.get("minutes_since_last_customer_message") or 0)
    created = float(ticket.get("created_minutes_ago") or 0)
    urgency = 35
    if "requested_human_agent" in signals:
        urgency += 25
    if "follow_up_pressure" in signals:
        urgency += 15
    if "high_message_volume" in signals:
        urgency += 10
    if wait >= 30:
        urgency += 15
    if wait >= 120:
        urgency += 20
    topic = str(ticket.get("topic") or "other")
    if topic in {"payment", "kyc"}:
        urgency += 10
    urgency = max(0, min(100, urgency))

    if urgency >= 75:
        priority = "high"
    elif urgency >= 45:
        priority = "medium"
    else:
        priority = "low"

    first_bounds, resolution_bounds = SLA_BOUNDS[priority]
    first_h = _clamp_hours(2.0 if priority == "medium" else (1.0 if priority == "high" else 4.0), first_bounds)
    resolution_h = _clamp_hours(24.0 if priority == "medium" else (8.0 if priority == "high" else 48.0), resolution_bounds)

    pm_co_handling = None
    pm_context = customer.get("pm_context")
    if isinstance(pm_context, dict) and customer.get("in_distributor_book"):
        action = "consult" if urgency >= 50 or topic in {"payment", "portfolio", "kyc"} else "notify"
        pm_co_handling = {
            "recommended_action": action,
            "reason": "Book client; PM visibility recommended for this topic and urgency.",
            "mitra_user_id": pm_context.get("mitra_user_id"),
            "mitra_display_name": pm_context.get("mitra_display_name"),
            "mitra_client_id": pm_context.get("mitra_client_id"),
        }

    assignee_id = _pick_fallback_assignee(features)
    return RoutingDecision(
        priority=priority,
        urgency_score=urgency,
        first_response_hours=first_h,
        resolution_hours=resolution_h,
        assignee_id=assignee_id,
        pm_co_handling=pm_co_handling,
        reason_summary="Fallback routing from wait time, message behavior, and agent load.",
        priority_rationale=f"Score {urgency}/100 from signals and wait time.",
        sla_rationale=f"Policy band for {priority} priority.",
        assignee_rationale="Lowest weighted backlog among support agents.",
        signals=tuple(signals[:8]),
    )


def _validate_assignee(decision: RoutingDecision, candidate_ids: set[str]) -> RoutingDecision:
    if decision.assignee_id and decision.assignee_id in candidate_ids:
        return decision
    if not candidate_ids:
        return RoutingDecision(
            priority=decision.priority,
            urgency_score=decision.urgency_score,
            first_response_hours=decision.first_response_hours,
            resolution_hours=decision.resolution_hours,
            assignee_id=None,
            pm_co_handling=decision.pm_co_handling,
            reason_summary=decision.reason_summary,
            priority_rationale=decision.priority_rationale,
            sla_rationale=decision.sla_rationale,
            assignee_rationale=decision.assignee_rationale + " (no eligible agents)",
            signals=decision.signals,
        )
    replacement = next(iter(sorted(candidate_ids)))
    return RoutingDecision(
        priority=decision.priority,
        urgency_score=decision.urgency_score,
        first_response_hours=decision.first_response_hours,
        resolution_hours=decision.resolution_hours,
        assignee_id=replacement,
        pm_co_handling=decision.pm_co_handling,
        reason_summary=decision.reason_summary,
        priority_rationale=decision.priority_rationale,
        sla_rationale=decision.sla_rationale,
        assignee_rationale=decision.assignee_rationale + " (assignee corrected to eligible agent)",
        signals=decision.signals,
    )


def _clamp_decision_sla(decision: RoutingDecision) -> RoutingDecision:
    first_bounds, resolution_bounds = SLA_BOUNDS.get(decision.priority, SLA_BOUNDS["medium"])
    return RoutingDecision(
        priority=decision.priority,
        urgency_score=decision.urgency_score,
        first_response_hours=_clamp_hours(decision.first_response_hours, first_bounds),
        resolution_hours=_clamp_hours(decision.resolution_hours, resolution_bounds),
        assignee_id=decision.assignee_id,
        pm_co_handling=decision.pm_co_handling,
        reason_summary=decision.reason_summary,
        priority_rationale=decision.priority_rationale,
        sla_rationale=decision.sla_rationale,
        assignee_rationale=decision.assignee_rationale,
        signals=decision.signals,
    )


def _enrich_pm_co_handling(decision: RoutingDecision, features: dict[str, Any]) -> dict[str, Any] | None:
    if not decision.pm_co_handling:
        return None
    customer = features.get("customer") if isinstance(features.get("customer"), dict) else {}
    pm_context = customer.get("pm_context")
    if not isinstance(pm_context, dict):
        return None
    merged = {**decision.pm_co_handling}
    merged.setdefault("mitra_user_id", pm_context.get("mitra_user_id"))
    merged.setdefault("mitra_display_name", pm_context.get("mitra_display_name"))
    merged.setdefault("mitra_client_id", pm_context.get("mitra_client_id"))
    merged.setdefault(
        "recommended_action",
        str(decision.pm_co_handling.get("recommended_action") or "notify"),
    )
    return merged


async def _resolve_decision(
    features: dict[str, Any],
    *,
    fallback_only: bool = False,
) -> tuple[RoutingDecision, str, str]:
    settings = get_settings()
    candidate_ids = {
        str(row.get("id"))
        for row in (features.get("agent_candidates") or [])
        if isinstance(row, dict) and row.get("id")
    }
    if settings.support_ai_routing_enabled and not fallback_only:
        try:
            model = await resolve_llm_model()
            decision = await complete_routing_decision(
                user_prompt=json.dumps(features, default=str),
            )
            decision = _clamp_decision_sla(decision)
            decision = _validate_assignee(decision, candidate_ids)
            return decision, "ai", model
        except OllamaError as exc:
            logger.warning("support_routing_ollama_failed: %s", exc)
    decision = _fallback_decision(features)
    decision = _validate_assignee(decision, candidate_ids)
    return decision, "fallback", "fallback-scorer"


def _apply_sla_hours(ticket: SupportTicket, *, first_hours: float, resolution_hours: float) -> None:
    anchor = _aware(ticket.created_at or _utcnow())
    ticket.first_response_due_at = anchor + timedelta(hours=first_hours)
    ticket.resolution_due_at = anchor + timedelta(hours=resolution_hours)


async def apply_support_intelligence(
    db: AsyncSession,
    ticket: SupportTicket,
    customer: User,
    *,
    trigger: str,
    force: bool = False,
    routing_fallback_only: bool = False,
) -> bool:
    """Run AI/fallback routing. Returns True if applied."""
    settings = get_settings()
    if ticket.status not in OPEN_STATUSES:
        return False

    needs_agent = ticket.handled_by == "human" or bool(ticket.escalation_reason)
    if not needs_agent:
        return False

    if not force and not _routing_needs_refresh(ticket, debounce_seconds=settings.support_routing_debounce_seconds):
        return False

    features = await build_support_routing_features(db, ticket=ticket, customer=customer, trigger=trigger)
    decision, source, model = await _resolve_decision(features, fallback_only=routing_fallback_only)

    previous_priority = ticket.priority
    if trigger in {"escalation", "ensure_ticket", "customer_message"}:
        ticket.priority = _merge_priority(ticket.priority, decision.priority)
    else:
        ticket.priority = _merge_priority(previous_priority, decision.priority)

    _apply_sla_hours(
        ticket,
        first_hours=decision.first_response_hours,
        resolution_hours=decision.resolution_hours,
    )

    pm_co_handling = _enrich_pm_co_handling(decision, features)
    candidate_ids = {
        str(row.get("id"))
        for row in (features.get("agent_candidates") or [])
        if isinstance(row, dict) and row.get("id")
    }

    should_assign = ticket.assignee_id is None
    if (
        not should_assign
        and settings.support_routing_reassign_when_away
        and ticket.assignee_id is not None
        and decision.urgency_score >= 70
        and trigger == "customer_message"
    ):
        presence = await read_agent_presence(ticket.assignee_id)
        if presence != "online":
            should_assign = True

    if should_assign and decision.assignee_id and decision.assignee_id in candidate_ids:
        ticket.assignee_id = UUID(decision.assignee_id)
        ticket.handled_by = "human"

    computed_at = _utcnow().isoformat()
    ticket.routing_metadata = {
        "urgency_score": decision.urgency_score,
        "reason_summary": decision.reason_summary,
        "priority_rationale": decision.priority_rationale,
        "sla_rationale": decision.sla_rationale,
        "assignee_rationale": decision.assignee_rationale,
        "pm_co_handling": pm_co_handling,
        "signals": list(decision.signals),
        "model": model,
        "source": source,
        "computed_at": computed_at,
        "trigger": trigger,
        "first_response_hours": decision.first_response_hours,
        "resolution_hours": decision.resolution_hours,
    }

    event_payload = {
        "decision": {
            "priority": ticket.priority,
            "urgency_score": decision.urgency_score,
            "assignee_id": str(ticket.assignee_id) if ticket.assignee_id else None,
            "source": source,
        },
        "features_digest": {
            "behavior_signals": features.get("ticket", {}).get("behavior_signals"),
            "wait_minutes": features.get("ticket", {}).get("minutes_since_last_customer_message"),
        },
    }
    db.add(
        SupportTicketRoutingEvent(
            ticket_id=ticket.id,
            trigger=trigger,
            payload=event_payload,
        )
    )
    await db.flush()
    # `updated_at` uses DB onupdate; flush expires it — reload before sync serializers read attrs.
    await db.refresh(ticket)
    return True


def serialize_routing_metadata(ticket: SupportTicket) -> dict[str, Any] | None:
    meta = ticket.routing_metadata if isinstance(ticket.routing_metadata, dict) else None
    if not meta:
        return None
    return {
        "urgency_score": meta.get("urgency_score"),
        "reason_summary": meta.get("reason_summary"),
        "priority_rationale": meta.get("priority_rationale"),
        "sla_rationale": meta.get("sla_rationale"),
        "assignee_rationale": meta.get("assignee_rationale"),
        "pm_co_handling": meta.get("pm_co_handling"),
        "signals": meta.get("signals") or [],
        "source": meta.get("source"),
        "model": meta.get("model"),
        "computed_at": meta.get("computed_at"),
        "first_response_hours": meta.get("first_response_hours"),
        "resolution_hours": meta.get("resolution_hours"),
    }


def ticket_urgency_score(ticket: SupportTicket) -> int:
    meta = ticket.routing_metadata if isinstance(ticket.routing_metadata, dict) else None
    if not meta:
        return PRIORITY_RANK.get(ticket.priority, 0) * 30
    try:
        return int(meta.get("urgency_score") or 0)
    except (TypeError, ValueError):
        return 0
