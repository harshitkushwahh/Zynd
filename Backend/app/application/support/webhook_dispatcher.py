from __future__ import annotations

import hashlib
import hmac
import json
import logging
from contextvars import ContextVar
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_pending_webhooks: ContextVar[list[tuple[str, dict[str, Any]]] | None] = ContextVar(
    "_support_webhook_pending",
    default=None,
)


def begin_support_webhook_batch() -> None:
    _pending_webhooks.set([])


def discard_support_webhook_batch() -> None:
    _pending_webhooks.set(None)


def schedule_support_webhook(event_type: str, payload: dict[str, Any]) -> None:
    settings = get_settings()
    if not settings.support_webhook_url_list:
        return
    batch = _pending_webhooks.get()
    if batch is None:
        batch = []
        _pending_webhooks.set(batch)
    batch.append((event_type, payload))


def take_support_webhooks() -> list[tuple[str, dict[str, Any]]]:
    batch = _pending_webhooks.get()
    _pending_webhooks.set(None)
    return batch or []


def _sign_body(secret: str, body: bytes) -> str:
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


async def flush_support_webhooks() -> None:
    settings = get_settings()
    urls = settings.support_webhook_url_list
    secret = settings.support_webhook_secret.strip()
    if not urls:
        take_support_webhooks()
        return
    events = take_support_webhooks()
    if not events:
        return
    async with httpx.AsyncClient(timeout=10.0) as client:
        for event_type, payload in events:
            body = json.dumps({"type": event_type, "payload": payload}).encode("utf-8")
            headers = {"Content-Type": "application/json"}
            if secret:
                headers["X-Zynd-Signature"] = _sign_body(secret, body)
            for url in urls:
                try:
                    await client.post(url, content=body, headers=headers)
                except Exception:
                    logger.exception("support_webhook_delivery_failed url=%s type=%s", url, event_type)


def verify_inbound_support_webhook_signature(
    *,
    raw_body: bytes,
    signature_header: str | None,
) -> bool:
    settings = get_settings()
    secret = settings.support_webhook_secret.strip()
    if not secret:
        return settings.app_env == "development"
    if not signature_header:
        return False
    expected = _sign_body(secret, raw_body)
    return hmac.compare_digest(expected, signature_header.strip())
