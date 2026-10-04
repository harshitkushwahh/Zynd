from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncGenerator

import redis.asyncio as redis
from redis.asyncio.retry import Retry
from redis.backoff import ExponentialBackoff

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)

# Errors that mean "Redis is unreachable right now" rather than a bug.
# Workers back off and retry on these instead of exiting.
REDIS_TRANSIENT_ERRORS: tuple[type[BaseException], ...] = (
    redis.ConnectionError,
    redis.TimeoutError,
)

_redis_clients: dict[tuple[int, bool], redis.Redis] = {}


def _build_redis_url(base_url: str, db: int) -> str:
    """Replace or append DB index on a redis:// URL."""
    if "/" in base_url.rsplit(":", 1)[-1]:
        return base_url.rsplit("/", 1)[0] + f"/{db}"
    return f"{base_url}/{db}"


def _client_kwargs(settings: Settings, *, blocking: bool) -> dict:
    # redis-py 8 made DEFAULT_SOCKET_TIMEOUT 5s. A blocking BRPOP/XREADGROUP
    # that waits 5s server-side then races that read timeout and raises
    # TimeoutError. Blocking clients therefore disable the read timeout and
    # rely on the command's own ``timeout``/``block`` argument.
    socket_timeout = None if blocking else settings.redis_socket_timeout_seconds
    return {
        "decode_responses": True,
        "socket_timeout": socket_timeout,
        "socket_connect_timeout": settings.redis_socket_connect_timeout_seconds,
        "socket_keepalive": True,
        "health_check_interval": settings.redis_health_check_interval_seconds,
        "max_connections": settings.redis_max_connections,
        # Reconnect transparently on dropped connections. Timeouts are not
        # retried here: non-idempotent commands (INCR, LPUSH) must not repeat.
        "retry": Retry(ExponentialBackoff(cap=1.0, base=0.1), retries=3),
        "retry_on_error": [redis.ConnectionError],
    }


async def get_redis(
    db: int | None = None,
    settings: Settings | None = None,
    *,
    blocking: bool = False,
) -> redis.Redis:
    """Return a shared Redis client for ``db``.

    ``blocking=True`` returns a client for long-blocking commands (BRPOP,
    XREADGROUP). Those clients are pooled separately so the API's bounded
    read timeout is unaffected.
    """
    settings = settings or get_settings()
    db_index = db if db is not None else 0
    key = (db_index, blocking)

    if key not in _redis_clients:
        url = _build_redis_url(settings.redis_url, db_index)
        _redis_clients[key] = redis.from_url(url, **_client_kwargs(settings, blocking=blocking))

    return _redis_clients[key]


async def close_redis() -> None:
    clients = list(_redis_clients.values())
    _redis_clients.clear()
    for client in clients:
        await client.aclose()


async def redis_dependency() -> AsyncGenerator[redis.Redis, None]:
    client = await get_redis()
    yield client


def redis_retry_delay(attempt: int, *, cap: float = 30.0) -> float:
    """Exponential delay for worker reconnect loops: 1, 2, 4, ... up to ``cap``."""
    return float(min(cap, 2 ** max(attempt - 1, 0)))


async def wait_for_redis_retry(attempt: int, *, what: str, error: BaseException) -> None:
    delay = redis_retry_delay(attempt)
    logger.warning(
        "Redis unavailable during %s (%s: %s); retrying in %.0fs (attempt %s)",
        what,
        type(error).__name__,
        error,
        delay,
        attempt,
    )
    await asyncio.sleep(delay)
