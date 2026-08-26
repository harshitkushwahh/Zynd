from __future__ import annotations

from typing import Literal

from app.application.admin.rbac_service import (
    ADMIN_CONSOLE_ROLE_KEYS,
    DISTRIBUTOR_CONSOLE_ROLE_KEYS,
)
from app.application.auth.errors import AuthError
from app.core.config import get_settings
from app.infrastructure.persistence.models import User, UserRole

AuthClientKind = Literal["web", "admin", "distributor"]

ADMIN_CLIENT_HEADER = "admin"
DISTRIBUTOR_CLIENT_HEADER = "distributor"
ADMIN_DEVICE_FINGERPRINT = "admin-console"
DISTRIBUTOR_DEVICE_FINGERPRINT = "distributor-console"


def is_admin_device_fingerprint(fingerprint: str | None) -> bool:
    return fingerprint == ADMIN_DEVICE_FINGERPRINT


def is_distributor_device_fingerprint(fingerprint: str | None) -> bool:
    return fingerprint == DISTRIBUTOR_DEVICE_FINGERPRINT


def is_admin_auth_header(client_header: str | None) -> bool:
    return client_header.strip().lower() == ADMIN_CLIENT_HEADER if client_header else False


def is_distributor_auth_header(client_header: str | None) -> bool:
    return client_header.strip().lower() == DISTRIBUTOR_CLIENT_HEADER if client_header else False


def _has_admin_console_access(role_keys: list[str]) -> bool:
    return any(key in ADMIN_CONSOLE_ROLE_KEYS for key in role_keys)


def _has_distributor_console_access(role_keys: list[str]) -> bool:
    return any(key in DISTRIBUTOR_CONSOLE_ROLE_KEYS for key in role_keys)


def resolve_auth_client_kind(
    *,
    header: str | None,
    fingerprint: str | None,
) -> AuthClientKind:
    header_admin = is_admin_auth_header(header)
    header_distributor = is_distributor_auth_header(header)
    fingerprint_admin = is_admin_device_fingerprint(fingerprint)
    fingerprint_distributor = is_distributor_device_fingerprint(fingerprint)

    if header_admin or fingerprint_admin:
        if header_admin != fingerprint_admin:
            raise AuthError(
                "Sign-in client mismatch. Use the correct app to continue.",
                "invalid_auth_client",
                403,
            )
        return "admin"

    if header_distributor or fingerprint_distributor:
        if header_distributor != fingerprint_distributor:
            raise AuthError(
                "Sign-in client mismatch. Use the correct app to continue.",
                "invalid_auth_client",
                403,
            )
        return "distributor"

    if header:
        raise AuthError(
            "Sign-in client mismatch. Use the correct app to continue.",
            "invalid_auth_client",
            403,
        )

    return "web"


def resolve_admin_client(*, header_admin: bool, fingerprint_admin: bool) -> bool:
    """Backward-compatible helper for legacy bool admin-client checks."""
    if header_admin != fingerprint_admin:
        raise AuthError(
            "Sign-in client mismatch. Use the correct app to continue.",
            "invalid_auth_client",
            403,
        )
    return header_admin


def uses_admin_refresh_cookie(client: AuthClientKind) -> bool:
    return client == "admin"


def refresh_cookie_name_for_client(client: AuthClientKind) -> str:
    settings = get_settings()
    if client == "admin":
        return settings.refresh_cookie_name_admin
    if client == "distributor":
        return settings.refresh_cookie_name_distributor
    return settings.refresh_cookie_name


def invite_target_console(role_key: str) -> AuthClientKind:
    if role_key in DISTRIBUTOR_CONSOLE_ROLE_KEYS:
        return "distributor"
    return "admin"


def auth_client_from_pending_payload(payload: dict[str, object]) -> AuthClientKind:
    stored = payload.get("auth_client")
    if stored in ("web", "admin", "distributor"):
        return stored  # type: ignore[return-value]
    return "admin" if payload.get("admin_client") else "web"


def validate_invite_client_for_role(*, role_key: str, client: AuthClientKind) -> None:
    expected = invite_target_console(role_key)
    if client != expected:
        if expected == "distributor":
            raise AuthError(
                "This invitation is for the Zynd Mitra console. "
                "Open the link from your email in the distributor dashboard.",
                "distributor_console_required",
                403,
            )
        raise AuthError(
            "This invitation is for the ZYND Admin Console. "
            "Open the link from your email in the admin portal.",
            "admin_console_required",
            403,
        )


def validate_user_role_for_client(
    user: User,
    *,
    client: AuthClientKind,
    role_keys: list[str],
) -> None:
    has_admin_console = _has_admin_console_access(role_keys)
    has_distributor_console = _has_distributor_console_access(role_keys)

    if client == "admin":
        if user.role != UserRole.admin:
            raise AuthError(
                "This account does not have admin access.",
                "admin_required",
                403,
            )
        if not has_admin_console:
            raise AuthError(
                "This account is for the Zynd Mitra console. Sign in at the distributor dashboard.",
                "distributor_console_required",
                403,
            )
        return

    if client == "distributor":
        if user.role != UserRole.admin:
            raise AuthError(
                "This account does not have distributor console access.",
                "distributor_console_required",
                403,
            )
        if not has_distributor_console:
            raise AuthError(
                "This account does not have distributor console access.",
                "distributor_console_required",
                403,
            )
        return

    if user.role == UserRole.admin:
        if has_distributor_console and not has_admin_console:
            raise AuthError(
                "This account is for the Zynd Mitra console. Sign in at the distributor dashboard.",
                "distributor_console_required",
                403,
            )
        raise AuthError(
            "This account is for the admin console. Sign in at the management portal.",
            "admin_console_required",
            403,
        )
