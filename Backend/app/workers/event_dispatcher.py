from __future__ import annotations

import logging

from app.application.messaging.outbox_service import claim_event_for_processing
from app.application.messaging.streams import (
    EVENT_AUTH_LOGIN_FAILED,
    EVENT_AUTH_LOGIN_SUCCEEDED,
    EVENT_AUTH_OTP_REQUESTED,
    EVENT_AUTH_REFRESH_REUSE_DETECTED,
    EVENT_NOTIFICATION_CREATED,
    EVENT_SECURITY_EMAIL_REQUESTED,
    EVENT_SECURITY_REVIEW_FLAGGED,
)
from app.core.database import AsyncSessionLocal
from app.domain.shared.events import DomainEvent
from app.workers.handlers.email_handler import handle_security_email_requested
from app.workers.handlers.notification_handler import handle_notification_created
from app.workers.handlers.otp_delivery_handler import handle_otp_requested
from app.workers.handlers.security_login_handler import (
    handle_login_failed,
    handle_login_succeeded,
    handle_refresh_reuse_detected,
    handle_security_review_flagged,
)

logger = logging.getLogger(__name__)

_HANDLERS = {
    EVENT_SECURITY_EMAIL_REQUESTED: handle_security_email_requested,
    EVENT_AUTH_OTP_REQUESTED: handle_otp_requested,
    EVENT_AUTH_LOGIN_SUCCEEDED: handle_login_succeeded,
    EVENT_AUTH_LOGIN_FAILED: handle_login_failed,
    EVENT_SECURITY_REVIEW_FLAGGED: handle_security_review_flagged,
    EVENT_AUTH_REFRESH_REUSE_DETECTED: handle_refresh_reuse_detected,
    EVENT_NOTIFICATION_CREATED: handle_notification_created,
}


async def _run_handler(event: DomainEvent) -> None:
    handler = _HANDLERS.get(event.event_type)
    if handler is None:
        logger.debug("No handler registered for event_type=%s", event.event_type)
        return
    await handler(event)


async def dispatch_event(event: DomainEvent) -> None:
    async with AsyncSessionLocal() as session:
        claimed = await claim_event_for_processing(session, event)
        if not claimed:
            logger.debug("Skipping already-processed event_id=%s", event.event_id)
            return
        await session.commit()

    try:
        await _run_handler(event)
    except Exception:
        async with AsyncSessionLocal() as session:
            from app.infrastructure.persistence.models import ProcessedDomainEvent

            row = await session.get(ProcessedDomainEvent, event.event_id)
            if row:
                await session.delete(row)
                await session.commit()
        raise
