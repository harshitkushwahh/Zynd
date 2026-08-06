from __future__ import annotations

from app.application.admin.rbac_service import (
    DISTRIBUTOR_CONSOLE_ROLE_KEYS,
    DISTRIBUTOR_MANAGER_ROLE_KEY,
    DISTRIBUTOR_PARTNER_ROLE_KEY,
)
from app.application.auth.errors import AuthError

DistributorConsolePersona = str  # "branch_manager" | "distributor"


def is_distributor_console_role(role_key: str) -> bool:
    return role_key in DISTRIBUTOR_CONSOLE_ROLE_KEYS


def resolve_distributor_console_persona(role_keys: list[str]) -> DistributorConsolePersona | None:
    normalized = set(role_keys)
    if DISTRIBUTOR_MANAGER_ROLE_KEY in normalized:
        return "branch_manager"
    if DISTRIBUTOR_PARTNER_ROLE_KEY in normalized:
        return "distributor"
    return None


def assert_distributor_console_access(role_keys: list[str]) -> DistributorConsolePersona:
    persona = resolve_distributor_console_persona(role_keys)
    if persona is None:
        raise AuthError(
            "This account does not have distributor console access.",
            "distributor_console_required",
            403,
        )
    return persona
