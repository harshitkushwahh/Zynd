from __future__ import annotations

import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_TWILIO_MESSAGES_URL = "https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"


def _to_e164(phone: str) -> str:
    raw = phone.strip()
    if raw.startswith("+"):
        digits = "".join(ch for ch in raw[1:] if ch.isdigit())
        return f"+{digits}" if digits else raw

    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) == 10:
        return f"+91{digits}"
    if len(digits) == 12 and digits.startswith("91"):
        return f"+{digits}"
    if digits:
        return f"+{digits}"
    return raw


async def _deliver_twilio(*, to_phone: str, body: str) -> bool:
    settings = get_settings()
    account_sid = settings.twilio_account_sid.strip()
    auth_token = settings.twilio_auth_token.strip()
    from_number = settings.twilio_from_number.strip()
    messaging_service_sid = settings.twilio_messaging_service_sid.strip()

    if not account_sid or not auth_token:
        logger.error("Twilio SMS requested but TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is missing.")
        return False

    if not from_number and not messaging_service_sid:
        logger.error(
            "Twilio SMS requested but neither TWILIO_FROM_NUMBER nor "
            "TWILIO_MESSAGING_SERVICE_SID is configured."
        )
        return False

    payload: dict[str, str] = {"To": _to_e164(to_phone), "Body": body}
    if messaging_service_sid:
        payload["MessagingServiceSid"] = messaging_service_sid
    else:
        payload["From"] = from_number

    url = _TWILIO_MESSAGES_URL.format(account_sid=account_sid)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                url,
                data=payload,
                auth=(account_sid, auth_token),
            )
    except httpx.HTTPError:
        logger.exception("Twilio SMS request failed for to=%s", payload["To"])
        return False

    if response.is_success:
        logger.info("Twilio SMS sent to=%s status=%s", payload["To"], response.status_code)
        return True

    logger.error(
        "Twilio SMS failed to=%s status=%s body=%s",
        payload["To"],
        response.status_code,
        response.text[:500],
    )
    return False


async def deliver_sms(*, to_phone: str, body: str) -> bool:
    settings = get_settings()
    normalized = _to_e164(to_phone)

    if not settings.sms_provider:
        if settings.debug:
            logger.info("[DEV SMS] to=%s\n%s", normalized or to_phone, body)
            return True
        logger.warning("SMS_PROVIDER is not configured.")
        return False

    if settings.sms_provider == "stub":
        logger.info("[SMS stub] to=%s body_len=%d", normalized or to_phone, len(body))
        return True

    if settings.sms_provider == "twilio":
        return await _deliver_twilio(to_phone=normalized or to_phone, body=body)

    logger.warning("SMS provider %s is not implemented.", settings.sms_provider)
    return False
