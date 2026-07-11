"""Redis stream names and domain event type constants (Phase 2).

Event type strings are sourced from domain packages (Phase 6).
"""

from __future__ import annotations

from app.domain.account.events import AccountEventType
from app.domain.auth.events import AuthEventType, SecurityEventType
from app.domain.notifications.events import NotificationEventType

# Streams
STREAM_NOTIFICATIONS_EMAIL = "notifications.email"
STREAM_NOTIFICATIONS_DISPATCH = "notifications.dispatch"
STREAM_AUTH = "auth.events"
STREAM_SECURITY = "security.events"

# Event types (re-exported from domain)
EVENT_SECURITY_EMAIL_REQUESTED = AccountEventType.SECURITY_EMAIL_REQUESTED
EVENT_AUTH_LOGIN_SUCCEEDED = AuthEventType.LOGIN_SUCCEEDED
EVENT_AUTH_LOGIN_FAILED = AuthEventType.LOGIN_FAILED
EVENT_AUTH_REFRESH_REUSE_DETECTED = AuthEventType.REFRESH_REUSE_DETECTED
EVENT_AUTH_OTP_REQUESTED = AccountEventType.OTP_REQUESTED
EVENT_SECURITY_REVIEW_FLAGGED = SecurityEventType.REVIEW_FLAGGED
EVENT_NOTIFICATION_CREATED = NotificationEventType.CREATED

# Consumer group shared by workers
DEFAULT_CONSUMER_GROUP = "zynd-workers"
