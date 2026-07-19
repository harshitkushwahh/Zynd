from __future__ import annotations

from app.application.auth.errors import AuthError
from app.infrastructure.persistence.models import User, UserRole

ADMIN_CLIENT_HEADER = "admin"
ADMIN_DEVICE_FINGERPRINT = "admin-console"


def is_admin_device_fingerprint(fingerprint: str | None) -> bool:
    return fingerprint == ADMIN_DEVICE_FINGERPRINT


def is_admin_auth_header(client_header: str | None) -> bool:
    return client_header.strip().lower() == ADMIN_CLIENT_HEADER if client_header else False


def resolve_admin_client(*, header_admin: bool, fingerprint_admin: bool) -> bool:
    if header_admin != fingerprint_admin:
        raise AuthError(
            "Sign-in client mismatch. Use the correct app to continue.",
            "invalid_auth_client",
            403,
        )
    return header_admin


def validate_user_role_for_client(user: User, *, admin_client: bool) -> None:
    if admin_client and user.role != UserRole.admin:
        raise AuthError(
            "This account does not have admin access.",
            "admin_required",
            403,
        )
    if not admin_client and user.role == UserRole.admin:
        raise AuthError(
            "This account is for the admin console. Sign in at the management portal.",
            "admin_console_required",
            403,
        )
