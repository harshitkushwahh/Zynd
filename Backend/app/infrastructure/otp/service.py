from __future__ import annotations

import json
import logging
import random
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.config import get_settings
from app.core.redis import get_redis
from app.infrastructure.security.rate_limit import check_rate_limit

logger = logging.getLogger(__name__)

OTP_TTL_SECONDS = 600
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_BASE_SECONDS = 30
OTP_RESEND_MAX_SECONDS = 300
OTP_RESEND_MULTIPLIER = 2


class OtpRateLimitError(Exception):
    """Raised when OTP send rate limits are exceeded."""


class OtpCooldownError(Exception):
    """Raised when OTP resend cooldown has not elapsed."""

    def __init__(self, retry_after_seconds: int):
        self.retry_after_seconds = retry_after_seconds
        super().__init__(f"Wait {retry_after_seconds}s before requesting another code.")


def _otp_key(purpose: str, identifier: str) -> str:
    return f"otp:{purpose}:{identifier}"


def _cooldown_key(purpose: str, identifier: str) -> str:
    return f"otp_resend_cooldown:{purpose}:{identifier.lower()}"


def _calc_retry_after(resend_count: int) -> int:
    exponent = max(resend_count - 1, 0)
    delay = OTP_RESEND_BASE_SECONDS * (OTP_RESEND_MULTIPLIER**exponent)
    return min(int(delay), OTP_RESEND_MAX_SECONDS)


async def _get_cooldown_remaining(purpose: str, identifier: str) -> int:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    raw = await redis.get(_cooldown_key(purpose, identifier))
    if not raw:
        return 0
    payload = json.loads(raw)
    remaining = int(payload.get("next_allowed_at", 0) - time.time())
    return max(remaining, 0)


async def send_otp(
    purpose: str,
    identifier: str,
    *,
    ip: str | None = None,
) -> dict[str, int]:
    remaining = await _get_cooldown_remaining(purpose, identifier)
    if remaining > 0:
        raise OtpCooldownError(remaining)

    await generate_otp(purpose, identifier, ip=ip)

    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    cooldown_key = _cooldown_key(purpose, identifier)
    raw = await redis.get(cooldown_key)
    resend_count = 1
    if raw:
        resend_count = json.loads(raw).get("resend_count", 0) + 1

    retry_after_seconds = _calc_retry_after(resend_count)
    payload = {
        "resend_count": resend_count,
        "next_allowed_at": time.time() + retry_after_seconds,
    }
    await redis.setex(cooldown_key, max(retry_after_seconds + 300, 3600), json.dumps(payload))
    return {
        "retry_after_seconds": retry_after_seconds,
        "expires_in": OTP_TTL_SECONDS,
    }


def _dev_otp_code(settings) -> str | None:
    if settings.debug and settings.dev_otp:
        return settings.dev_otp.strip()
    return None


async def generate_otp(
    purpose: str,
    identifier: str,
    *,
    ip: str | None = None,
) -> str:
    settings = get_settings()
    if not await check_rate_limit(
        f"otp_send:{purpose}:{identifier}",
        settings.otp_send_limit_per_identifier,
        settings.otp_send_window_seconds,
    ):
        raise OtpRateLimitError("Too many verification codes requested. Try again later.")
    if ip and not await check_rate_limit(
        f"otp_send_ip:{ip}",
        settings.otp_send_limit_per_ip,
        settings.otp_send_window_seconds,
    ):
        raise OtpRateLimitError("Too many verification codes requested. Try again later.")

    dev_code = _dev_otp_code(settings)
    code = dev_code if dev_code else f"{random.randint(0, 999999):06d}"
    redis = await get_redis(settings.redis_cache_db)
    payload = {"code": code, "attempts": 0}
    await redis.setex(_otp_key(purpose, identifier), OTP_TTL_SECONDS, json.dumps(payload))

    if settings.debug:
        logger.info("[DEV OTP] purpose=%s identifier=%s code=%s", purpose, identifier, code)

    return code


async def peek_otp_code(purpose: str, identifier: str) -> str | None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    raw = await redis.get(_otp_key(purpose, identifier))
    if not raw:
        return None
    payload = json.loads(raw)
    return payload.get("code")


async def verify_otp(purpose: str, identifier: str, code: str) -> bool:
    settings = get_settings()
    normalized_code = code.strip()
    dev_code = _dev_otp_code(settings)
    if dev_code and normalized_code == dev_code:
        redis = await get_redis(settings.redis_cache_db)
        await redis.delete(_otp_key(purpose, identifier))
        return True

    redis = await get_redis(settings.redis_cache_db)
    key = _otp_key(purpose, identifier)
    raw = await redis.get(key)
    if not raw:
        return False

    payload = json.loads(raw)
    if payload.get("attempts", 0) >= OTP_MAX_ATTEMPTS:
        await redis.delete(key)
        return False

    if payload.get("code") != normalized_code:
        payload["attempts"] = payload.get("attempts", 0) + 1
        ttl = await redis.ttl(key)
        if ttl > 0:
            await redis.setex(key, ttl, json.dumps(payload))
        return False

    await redis.delete(key)
    return True


# Backward-compatible re-exports — prefer persistence stores directly.
from app.infrastructure.persistence.password_reset_token_store import (  # noqa: E402
    consume_reset_token,
    create_reset_token,
)
from app.infrastructure.persistence.signup_draft_store import (  # noqa: E402
    create_signup_draft,
    delete_signup_draft,
    get_signup_draft,
    update_signup_draft,
)
