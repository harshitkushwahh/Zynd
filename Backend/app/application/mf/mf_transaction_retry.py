"""Transient retry helpers for MF payment workers (metadata-based, no migration)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.config import get_settings
from app.infrastructure.kyc.fp_clients import FpClientError

_TRANSIENT_FP_CODES = frozenset(
    {
        "fp_client_error",
        "timeout",
        "rate_limit",
        "service_unavailable",
        "gateway_timeout",
    }
)


def is_transient_error(exc: Exception) -> bool:
    if isinstance(exc, (TimeoutError, ConnectionError)):
        return True
    if isinstance(exc, FpClientError):
        if exc.status_code >= 500:
            return True
        return exc.code in _TRANSIENT_FP_CODES
    message = str(exc).lower()
    return "timeout" in message or "temporarily unavailable" in message


def get_retry_meta(metadata: dict[str, Any] | None) -> dict[str, Any]:
    meta = dict(metadata or {})
    ops = meta.get("ops")
    return dict(ops) if isinstance(ops, dict) else {}


def should_skip_retry(metadata: dict[str, Any] | None) -> bool:
    ops = get_retry_meta(metadata)
    next_retry_at = ops.get("next_retry_at")
    if not next_retry_at:
        return False
    try:
        deadline = datetime.fromisoformat(str(next_retry_at))
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
    except ValueError:
        return False
    return datetime.now(timezone.utc) < deadline


def bump_transient_retry(metadata: dict[str, Any] | None, *, error_code: str, error_message: str) -> tuple[dict[str, Any], bool]:
    """Returns updated metadata and whether the error should be treated as terminal."""
    settings = get_settings()
    meta = dict(metadata or {})
    ops = get_retry_meta(meta)
    retry_count = int(ops.get("retry_count") or 0) + 1
    max_retries = settings.zynd_mf_worker_max_transient_retries
    if retry_count >= max_retries:
        ops.update(
            {
                "retry_count": retry_count,
                "last_error_code": error_code,
                "last_error_message": error_message,
                "next_retry_at": None,
            }
        )
        meta["ops"] = ops
        return meta, True

    backoff_seconds = min(30 * (2 ** (retry_count - 1)), 900)
    next_retry = datetime.now(timezone.utc) + timedelta(seconds=backoff_seconds)
    ops.update(
        {
            "retry_count": retry_count,
            "last_error_code": error_code,
            "last_error_message": error_message,
            "next_retry_at": next_retry.isoformat(),
        }
    )
    meta["ops"] = ops
    return meta, False
