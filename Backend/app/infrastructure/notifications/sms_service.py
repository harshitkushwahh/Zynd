from __future__ import annotations

import logging

from app.core.config import get_settings

logger = logging.getLogger(__name__)


async def deliver_sms(*, to_phone: str, body: str) -> bool:
    settings = get_settings()
    normalized = "".join(ch for ch in to_phone if ch.isdigit() or ch == "+")

    if settings.debug or not settings.sms_provider:
        logger.info("[DEV SMS] to=%s\n%s", normalized or to_phone, body)
        return True

    if settings.sms_provider == "stub":
        logger.info("[SMS stub] to=%s body_len=%d", normalized or to_phone, len(body))
        return True

    logger.warning("SMS provider %s is not implemented.", settings.sms_provider)
    return False
