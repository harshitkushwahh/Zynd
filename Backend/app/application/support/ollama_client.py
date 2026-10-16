"""Local Ollama chat client. The model only writes a reply from context we provide."""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.I)


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
    timeout = httpx.Timeout(5.0, connect=3.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(url)
        response.raise_for_status()
        payload = response.json()
    models = payload.get("models") if isinstance(payload, dict) else None
    if not isinstance(models, list):
        return []
    return [str(row.get("name") or "") for row in models if isinstance(row, dict) and row.get("name")]


async def resolve_ollama_model() -> str:
    """Pick a chat model that exists locally (falls back when OLLAMA_MODEL is missing)."""
    settings = get_settings()
    configured = settings.ollama_model.strip()
    try:
        names = await _fetch_ollama_model_names()
    except (httpx.HTTPError, ValueError) as exc:
        raise OllamaError("Ollama is unavailable.") from exc

    if not names:
        raise OllamaError("Ollama has no models installed.")

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
