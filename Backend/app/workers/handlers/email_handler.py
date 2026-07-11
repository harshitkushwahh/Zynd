from __future__ import annotations

import asyncio
import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings
from app.domain.account.events import SecurityEmailRequestedPayload
from app.domain.shared.event_factory import parse_event_payload
from app.domain.shared.events import DomainEvent

logger = logging.getLogger(__name__)


def _smtp_configured() -> bool:
    settings = get_settings()
    return bool(settings.smtp_host and settings.email_from)


def _send_smtp_sync(*, to_email: str, subject: str, body: str) -> None:
    settings = get_settings()
    message = EmailMessage()
    message["From"] = settings.email_from
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)

    if settings.smtp_use_tls:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
            smtp.starttls()
            if settings.smtp_username and settings.smtp_password:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
        return

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
        if settings.smtp_username and settings.smtp_password:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)


async def deliver_security_email(*, to_email: str, subject: str, body: str) -> bool:
    settings = get_settings()

    if settings.debug and not _smtp_configured():
        logger.info("[DEV EMAIL] to=%s subject=%s\n%s", to_email, subject, body)
        return True

    if not _smtp_configured():
        logger.warning("SMTP not configured; skipping delivery to=%s subject=%s", to_email, subject)
        return False

    try:
        await asyncio.to_thread(
            _send_smtp_sync,
            to_email=to_email,
            subject=subject,
            body=body,
        )
        logger.info("Email sent to=%s subject=%s", to_email, subject)
        return True
    except Exception:
        logger.exception("SMTP delivery failed for to=%s subject=%s", to_email, subject)
        return False


async def handle_security_email_requested(event: DomainEvent) -> None:
    payload = parse_event_payload(event, SecurityEmailRequestedPayload)
    await deliver_security_email(
        to_email=payload.to_email,
        subject=payload.subject,
        body=payload.body,
    )
