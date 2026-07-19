from __future__ import annotations

import logging
from contextvars import ContextVar
from typing import Any
from uuid import UUID

from app.core.database import AsyncSessionLocal
from app.infrastructure.persistence.provider_log_models import ProviderLogSource
from app.infrastructure.persistence.repositories.provider_log_repository import ProviderLogRepository

logger = logging.getLogger(__name__)

_provider_log_user_id: ContextVar[UUID | None] = ContextVar("provider_log_user_id", default=None)


def set_provider_log_user_id(user_id: UUID | None) -> None:
    _provider_log_user_id.set(user_id)


def get_provider_log_user_id() -> UUID | None:
    return _provider_log_user_id.get()


def _redact_summary(payload: Any, *, max_keys: int = 12) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {}
    summary: dict[str, Any] = {}
    for index, (key, value) in enumerate(payload.items()):
        if index >= max_keys:
            summary["_truncated"] = True
            break
        if key.lower() in {"password", "client_secret", "secret", "token", "access_token"}:
            summary[key] = "[redacted]"
            continue
        if isinstance(value, (str, int, float, bool)) or value is None:
            summary[key] = value
        elif isinstance(value, dict):
            summary[key] = "{...}"
        elif isinstance(value, list):
            summary[key] = f"[{len(value)} items]"
        else:
            summary[key] = str(value)[:120]
    return summary


def _derive_action(method: str, path: str) -> str:
    cleaned = path.strip() or "/"
    return f"{method.upper()} {cleaned}"[:160]


async def record_provider_api_log(
    *,
    source: ProviderLogSource | str,
    method: str,
    path: str,
    user_id: UUID | None = None,
    status_code: int | None = None,
    success: bool = False,
    duration_ms: int | None = None,
    error_code: str | None = None,
    request_body: Any = None,
    response_body: Any = None,
    metadata: dict[str, Any] | None = None,
    action: str | None = None,
) -> None:
    parsed_source = source if isinstance(source, ProviderLogSource) else ProviderLogSource(source)
    resolved_user_id = user_id if user_id is not None else get_provider_log_user_id()

    try:
        async with AsyncSessionLocal() as session:
            await ProviderLogRepository(session).append(
                source=parsed_source,
                user_id=resolved_user_id,
                action=action or _derive_action(method, path),
                method=method,
                path=path,
                status_code=status_code,
                success=success,
                duration_ms=duration_ms,
                error_code=error_code,
                request_summary=_redact_summary(request_body) if request_body is not None else None,
                response_summary=_redact_summary(response_body) if response_body is not None else None,
                metadata=metadata,
            )
            await session.commit()
    except Exception:
        logger.exception("Failed to record provider API log for %s %s", method, path)
