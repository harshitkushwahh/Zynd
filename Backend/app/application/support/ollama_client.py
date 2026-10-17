"""Local Ollama chat client. The model only writes a reply from context we provide."""

from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.I)

# Avoid hammering Ollama when it is down (console detail + help bot share this probe).
_ollama_probe: dict[str, Any] = {"checked_at": 0.0, "ok": False, "model": ""}
_OLLAMA_PROBE_TTL_SECONDS = 45.0


@dataclass(frozen=True)
class BotDraft:
    can_answer: bool
    answer: str


class OllamaError(Exception):
    pass


def parse_bot_draft(content: str) -> BotDraft:
    cleaned = content.strip()
    cleaned = _FENCE.sub("", cleaned).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end <= start:
        raise OllamaError("Help bot reply was not JSON.")
    try:
        payload = json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError as exc:
        raise OllamaError("Help bot reply was not JSON.") from exc
    if not isinstance(payload, dict):
        raise OllamaError("Help bot reply was not an object.")
    answer = str(payload.get("answer") or "").strip()
    can_answer = bool(payload.get("can_answer")) and bool(answer)
    if len(answer) > 2000:
        answer = answer[:2000].rstrip()
    return BotDraft(can_answer=can_answer, answer=answer)


async def _fetch_ollama_model_names() -> list[str]:
    settings = get_settings()
    url = settings.ollama_base_url.rstrip("/") + "/api/tags"
    timeout = httpx.Timeout(3.0, connect=1.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(url)
        response.raise_for_status()
        payload = response.json()
    models = payload.get("models") if isinstance(payload, dict) else None
    if not isinstance(models, list):
        return []
    return [str(row.get("name") or "") for row in models if isinstance(row, dict) and row.get("name")]


def _pick_model_name(configured: str, names: list[str]) -> str:
    if configured in names:
        return configured

    family = configured.split(":")[0]
    for name in names:
        if name.split(":")[0] == family:
            logger.warning(
                "ollama_model_alias configured=%s resolved=%s",
                configured,
                name,
            )
            return name

    fallback = names[0]
    logger.warning(
        "ollama_model_missing configured=%s available=%s using=%s",
        configured,
        names[:8],
        fallback,
    )
    return fallback


def _cache_ollama_probe(*, ok: bool, model: str) -> None:
    _ollama_probe["checked_at"] = time.monotonic()
    _ollama_probe["ok"] = ok
    _ollama_probe["model"] = model


async def resolve_ollama_model() -> str:
    """Pick a chat model that exists locally (falls back when OLLAMA_MODEL is missing)."""
    settings = get_settings()
    configured = settings.ollama_model.strip()
    now = time.monotonic()
    if now - float(_ollama_probe.get("checked_at") or 0.0) < _OLLAMA_PROBE_TTL_SECONDS:
        if not _ollama_probe.get("ok"):
            raise OllamaError("Ollama is unavailable.")
        cached = str(_ollama_probe.get("model") or "").strip()
        if cached:
            return cached

    try:
        names = await _fetch_ollama_model_names()
    except (httpx.HTTPError, ValueError) as exc:
        _cache_ollama_probe(ok=False, model="")
        raise OllamaError("Ollama is unavailable.") from exc

    if not names:
        _cache_ollama_probe(ok=False, model="")
        raise OllamaError("Ollama has no models installed.")

    resolved = _pick_model_name(configured, names)
    _cache_ollama_probe(ok=True, model=resolved)
    return resolved


async def check_ollama_ready() -> tuple[bool, str]:
    """Lightweight probe for Help Bot (Ollama) availability."""
    settings = get_settings()
    try:
        model = await resolve_ollama_model()
        return True, model
    except OllamaError:
        return False, settings.ollama_model


async def complete_help_reply(*, system_prompt: str, user_prompt: str) -> BotDraft:
    settings = get_settings()
    model = await resolve_ollama_model()
    url = settings.ollama_base_url.rstrip("/") + "/api/chat"
    body = {
        "model": model,
        "stream": False,
        "format": "json",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "options": {"temperature": 0.2},
    }
    timeout = httpx.Timeout(settings.ollama_timeout_seconds, connect=5.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=body)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:240] if exc.response is not None else ""
        raise OllamaError(f"Ollama chat failed ({exc.response.status_code}): {detail}") from exc
    except (httpx.HTTPError, ValueError) as exc:
        raise OllamaError("Ollama is unavailable.") from exc

    message = payload.get("message") if isinstance(payload, dict) else None
    content = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, str) or not content.strip():
        raise OllamaError("Ollama returned an empty reply.")
    return parse_bot_draft(content)


_ROUTING_SYSTEM = """You are Zynd Support Intelligence. Route support tickets using ONLY the JSON features provided.
Return JSON only with this shape:
{
  "priority": "low" | "medium" | "high",
  "urgency_score": 0-100 integer,
  "first_response_hours": number,
  "resolution_hours": number,
  "assignee_id": "uuid string from agent_candidates or null",
  "pm_co_handling": null or {
    "recommended_action": "notify" | "consult",
    "reason": "short string"
  },
  "reason_summary": "1-2 sentences for agents",
  "priority_rationale": "short",
  "sla_rationale": "short",
  "assignee_rationale": "short",
  "signals": ["bullet", "..."]
}
Weigh customer wait time, message tone, payment/KYC risk, agent presence and backlog.
Prefer online agents with lower open_backlog and relevant topic experience.
Flag pm_co_handling when customer is in_distributor_book and PM consult would help (not for assignee)."""


@dataclass(frozen=True)
class RoutingDecision:
    priority: str
    urgency_score: int
    first_response_hours: float
    resolution_hours: float
    assignee_id: str | None
    pm_co_handling: dict[str, Any] | None
    reason_summary: str
    priority_rationale: str
    sla_rationale: str
    assignee_rationale: str
    signals: tuple[str, ...]


def parse_routing_decision(content: str) -> RoutingDecision:
    cleaned = content.strip()
    cleaned = _FENCE.sub("", cleaned).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end <= start:
        raise OllamaError("Routing reply was not JSON.")
    try:
        payload = json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError as exc:
        raise OllamaError("Routing reply was not JSON.") from exc
    if not isinstance(payload, dict):
        raise OllamaError("Routing reply was not an object.")

    priority = str(payload.get("priority") or "medium").lower()
    if priority not in {"low", "medium", "high"}:
        priority = "medium"
    urgency = int(payload.get("urgency_score") or 50)
    urgency = max(0, min(100, urgency))
    first_h = float(payload.get("first_response_hours") or 2)
    resolution_h = float(payload.get("resolution_hours") or 24)
    assignee_raw = payload.get("assignee_id")
    assignee_id = str(assignee_raw).strip() if assignee_raw else None
    pm = payload.get("pm_co_handling")
    pm_co_handling = pm if isinstance(pm, dict) else None
    signals_raw = payload.get("signals")
    signals: tuple[str, ...] = ()
    if isinstance(signals_raw, list):
        signals = tuple(str(item)[:120] for item in signals_raw[:8])

    return RoutingDecision(
        priority=priority,
        urgency_score=urgency,
        first_response_hours=first_h,
        resolution_hours=resolution_h,
        assignee_id=assignee_id,
        pm_co_handling=pm_co_handling,
        reason_summary=str(payload.get("reason_summary") or "")[:500],
        priority_rationale=str(payload.get("priority_rationale") or "")[:300],
        sla_rationale=str(payload.get("sla_rationale") or "")[:300],
        assignee_rationale=str(payload.get("assignee_rationale") or "")[:300],
        signals=signals,
    )


async def complete_routing_decision(*, user_prompt: str) -> RoutingDecision:
    settings = get_settings()
    model = await resolve_ollama_model()
    url = settings.ollama_base_url.rstrip("/") + "/api/chat"
    body = {
        "model": model,
        "stream": False,
        "format": "json",
        "messages": [
            {"role": "system", "content": _ROUTING_SYSTEM},
            {"role": "user", "content": user_prompt[:14_000]},
        ],
        "options": {"temperature": 0.15},
    }
    timeout = httpx.Timeout(settings.support_routing_timeout_seconds, connect=1.5)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=body)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:240] if exc.response is not None else ""
        raise OllamaError(f"Ollama routing failed ({exc.response.status_code}): {detail}") from exc
    except (httpx.HTTPError, ValueError) as exc:
        raise OllamaError("Ollama is unavailable.") from exc

    message = payload.get("message") if isinstance(payload, dict) else None
    content = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, str) or not content.strip():
        raise OllamaError("Ollama returned an empty routing reply.")
    return parse_routing_decision(content)
