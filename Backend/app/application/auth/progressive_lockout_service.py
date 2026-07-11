from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.security.security_config_service import get_lockout_settings
from app.core.config import get_settings
from app.core.redis import get_redis
from app.infrastructure.persistence.models import LoginAttempt


@dataclass
class ProgressiveLockoutState:
    attempt_count: int
    captcha_required: bool
    delay_seconds: int
    account_locked: bool
    ip_blocked: bool


async def _read_counter(key: str) -> int:
    redis = await get_redis(get_settings().redis_cache_db)
    raw = await redis.get(f"rl:{key}")
    return int(raw or 0)


async def _increment_counter(key: str, window_seconds: int = 3600) -> int:
    redis = await get_redis(get_settings().redis_cache_db)
    full_key = f"rl:{key}"
    current = await redis.incr(full_key)
    if current == 1:
        await redis.expire(full_key, window_seconds)
    return current


async def peek_failure_count(*, email: str, ip: str | None) -> int:
    email_count = await _read_counter(f"login_fail:email:{email.lower()}")
    if not ip:
        return email_count
    ip_count = await _read_counter(f"login_fail:ip:{ip}")
    return max(email_count, ip_count)


async def record_failure_counters(*, email: str, ip: str | None) -> int:
    email_count = await _increment_counter(f"login_fail:email:{email.lower()}", 3600)
    ip_count = email_count
    if ip:
        ip_count = await _increment_counter(f"login_fail:ip:{ip}", 3600)
        await _increment_counter(f"login_fail_ip_only:{ip}", 3600)
    return max(email_count, ip_count)


async def clear_failure_counters(*, email: str, ip: str | None) -> None:
    redis = await get_redis(get_settings().redis_cache_db)
    await redis.delete(f"rl:login_fail:email:{email.lower()}")
    if ip:
        await redis.delete(f"rl:login_fail:ip:{ip}")
        await redis.delete(f"rl:login_fail_ip_only:{ip}")


async def evaluate_progressive_lockout(
    db: AsyncSession,
    *,
    email: str,
    ip: str | None,
    attempt_count: int | None = None,
) -> ProgressiveLockoutState:
    settings = await get_lockout_settings(db)
    count = attempt_count if attempt_count is not None else await peek_failure_count(email=email, ip=ip)

    ip_blocked = False
    if ip:
        ip_failures = await _read_counter(f"login_fail_ip_only:{ip}")
        ip_blocked = ip_failures >= settings["ip_block_threshold"]

    captcha_required = count >= settings["captcha_after_attempt"]
    delay_seconds = 0
    if count >= settings["backoff_start_attempt"]:
        exponent = count - settings["backoff_start_attempt"]
        delay_seconds = settings["backoff_base_seconds"] * (2**exponent)

    account_locked = count >= settings["max_attempts"]
    return ProgressiveLockoutState(
        attempt_count=count,
        captcha_required=captcha_required,
        delay_seconds=delay_seconds,
        account_locked=account_locked,
        ip_blocked=ip_blocked,
    )


async def record_login_attempt(
    db: AsyncSession,
    *,
    email: str,
    user_id: UUID | None,
    ip: str | None,
    success: bool,
    failure_reason: str | None = None,
    captcha_required: bool = False,
) -> None:
    db.add(
        LoginAttempt(
            email=email.lower().strip(),
            user_id=user_id,
            ip_address=ip,
            success=success,
            failure_reason=failure_reason,
            captcha_required=captcha_required,
        )
    )
    await db.flush()


async def apply_login_delay(state: ProgressiveLockoutState) -> None:
    if state.delay_seconds > 0:
        await asyncio.sleep(min(state.delay_seconds, 30))
