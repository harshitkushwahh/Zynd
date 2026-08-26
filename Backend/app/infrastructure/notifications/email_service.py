"""Schedule security emails for post-commit dispatch (Phase 2).

SMTP delivery runs in the email worker / sync dispatcher — not on the request path.
"""

from __future__ import annotations

import logging

from app.application.messaging.scheduled_events import schedule_domain_event
from app.application.messaging.streams import STREAM_NOTIFICATIONS_EMAIL
from app.core.config import get_settings
from app.domain.account.events import SecurityEmailRequestedPayload, security_email_requested_event

logger = logging.getLogger(__name__)


def smtp_configured() -> bool:
    settings = get_settings()
    return bool(settings.smtp_host and settings.email_from)


async def send_security_email(*, to_email: str, subject: str, body: str) -> None:
    settings = get_settings()
    schedule_domain_event(
        STREAM_NOTIFICATIONS_EMAIL,
        security_email_requested_event(
            SecurityEmailRequestedPayload(
                to_email=to_email,
                subject=subject,
                body=body,
            )
        ),
    )
    if settings.debug:
        logger.debug("[EMAIL scheduled] to=%s subject=%s", to_email, subject)
