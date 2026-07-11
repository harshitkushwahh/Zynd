"""Application port for security email delivery."""

from __future__ import annotations

from app.infrastructure.notifications.email_service import send_security_email

__all__ = ["send_security_email"]
