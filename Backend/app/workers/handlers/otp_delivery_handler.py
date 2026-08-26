from __future__ import annotations

import logging

from app.application.identity.otp_purposes import build_otp_message, get_purpose_definition
from app.core.config import get_settings
from app.domain.account.events import OtpRequestedPayload
from app.domain.shared.event_factory import parse_event_payload
from app.domain.shared.events import DomainEvent
from app.infrastructure.notifications.sms_service import deliver_sms
from app.infrastructure.otp.service import peek_otp_code
from app.workers.handlers.email_handler import deliver_security_email

logger = logging.getLogger(__name__)


async def handle_otp_requested(event: DomainEvent) -> None:
    payload = parse_event_payload(event, OtpRequestedPayload)
    purpose = payload.purpose
    definition = get_purpose_definition(purpose)
    storage_key = payload.storage_key or definition.storage_key
    identifier = payload.identifier
    destination = payload.destination
    channel = payload.channel

    code = await peek_otp_code(storage_key, identifier)
    if not code:
        logger.warning(
            "OTP delivery skipped — code unavailable purpose=%s identifier=%s",
            purpose.value,
            identifier,
        )
        return

    body = build_otp_message(purpose=purpose, code=code)
    if channel == "email":
        await deliver_security_email(
            to_email=destination,
            subject=definition.email_subject,
            body=body,
        )
        return

    if channel == "sms":
        delivered = await deliver_sms(to_phone=destination, body=body)
        if not delivered:
            settings = get_settings()
            if settings.debug:
                logger.warning(
                    "SMS delivery failed for purpose=%s destination=%s — "
                    "use the [DEV OTP] log line above for local testing, "
                    "or set DEV_OTP in Backend/.env",
                    purpose.value,
                    destination,
                )
        return

    logger.warning("Unsupported OTP channel=%s purpose=%s", channel, purpose.value)
