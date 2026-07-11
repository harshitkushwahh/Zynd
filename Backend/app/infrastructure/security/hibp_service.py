from __future__ import annotations

import hashlib
import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class PasswordPwnedError(Exception):
    """Raised when a password appears in the HIBP breach corpus."""


class HibpUnavailableError(Exception):
    """Raised when the breach check cannot be completed in production."""


async def is_password_pwned(password: str) -> bool:
    digest = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
    prefix, suffix = digest[:5], digest[5:]
    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.get(f"https://api.pwnedpasswords.com/range/{prefix}")
        response.raise_for_status()

    for line in response.text.splitlines():
        hash_suffix, _count = line.split(":", 1)
        if hash_suffix == suffix:
            return True
    return False


async def ensure_password_not_pwned(password: str) -> None:
    settings = get_settings()
    if not settings.hibp_enabled:
        return

    try:
        if await is_password_pwned(password):
            raise PasswordPwnedError(
                "This password appeared in a known data breach. Choose a different one."
            )
    except (PasswordPwnedError, HibpUnavailableError):
        raise
    except Exception:
        logger.exception("HIBP lookup failed; allowing password change to proceed")
        if settings.app_env == "production":
            raise HibpUnavailableError(
                "Password safety check is temporarily unavailable. Try again shortly."
            ) from None
