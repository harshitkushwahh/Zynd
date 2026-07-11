from __future__ import annotations

from uuid import UUID

from app.core.config import Settings, get_settings
from app.infrastructure.persistence.models import User


def build_anonymized_email(user_id: UUID, domain: str | None = None) -> str:
    settings = get_settings()
    resolved_domain = domain or settings.anonymized_email_domain
    return f"deleted+{user_id}@{resolved_domain}"


def anonymize_user_profile(user: User, settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    user.email = build_anonymized_email(user.id, settings.anonymized_email_domain)
    user.phone = None
    user.password_hash = None
    user.first_name = None
    user.middle_name = None
    user.last_name = None
    user.mfa_enrolled_at = None
    user.email_verified_at = None
    user.phone_verified_at = None
    user.is_locked = False
    user.failed_login_count = 0
    user.locked_until = None
