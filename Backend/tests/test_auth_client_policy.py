from __future__ import annotations

import pytest

from app.application.auth.auth_client_policy import (
    invite_target_console,
    resolve_auth_client_kind,
    validate_invite_client_for_role,
    validate_user_role_for_client,
)
from app.application.auth.errors import AuthError
from app.infrastructure.persistence.models import User, UserRole


def _admin_user() -> User:
    return User(email="admin@test.example", password_hash="hash", role=UserRole.admin)


def _investor_user() -> User:
    return User(email="user@test.example", password_hash="hash", role=UserRole.user)


def test_mitra_manager_blocked_from_admin_client() -> None:
    user = _admin_user()
    with pytest.raises(AuthError) as exc:
        validate_user_role_for_client(
            user,
            client="admin",
            role_keys=["mitra_manager"],
        )
    assert exc.value.code == "distributor_console_required"


def test_mitra_manager_allowed_on_distributor_client() -> None:
    user = _admin_user()
    validate_user_role_for_client(
        user,
        client="distributor",
        role_keys=["mitra_manager"],
    )


def test_state_head_allowed_on_admin_client() -> None:
    user = _admin_user()
    validate_user_role_for_client(
        user,
        client="admin",
        role_keys=["mitra_state_head"],
    )


def test_state_head_blocked_on_distributor_client() -> None:
    user = _admin_user()
    with pytest.raises(AuthError) as exc:
        validate_user_role_for_client(
            user,
            client="distributor",
            role_keys=["mitra_state_head"],
        )
    assert exc.value.code == "distributor_console_required"


def test_investor_allowed_on_web_client() -> None:
    user = _investor_user()
    validate_user_role_for_client(user, client="web", role_keys=[])


def test_mitra_manager_invite_requires_distributor_client() -> None:
    with pytest.raises(AuthError) as exc:
        validate_invite_client_for_role(role_key="mitra_manager", client="admin")
    assert exc.value.code == "distributor_console_required"


def test_state_head_invite_requires_admin_client() -> None:
    with pytest.raises(AuthError) as exc:
        validate_invite_client_for_role(role_key="mitra_state_head", client="distributor")
    assert exc.value.code == "admin_console_required"


def test_web_client_with_browser_fingerprint() -> None:
    assert resolve_auth_client_kind(header=None, fingerprint="zynd-12345678") == "web"


def test_web_client_without_fingerprint() -> None:
    assert resolve_auth_client_kind(header=None, fingerprint=None) == "web"


def test_admin_client_requires_matching_header_and_fingerprint() -> None:
    assert (
        resolve_auth_client_kind(header="admin", fingerprint="admin-console") == "admin"
    )


def test_admin_header_without_console_fingerprint_rejected() -> None:
    with pytest.raises(AuthError) as exc:
        resolve_auth_client_kind(header="admin", fingerprint="zynd-12345678")
    assert exc.value.code == "invalid_auth_client"


def test_console_fingerprint_without_matching_header_rejected() -> None:
    with pytest.raises(AuthError) as exc:
        resolve_auth_client_kind(header=None, fingerprint="admin-console")
    assert exc.value.code == "invalid_auth_client"


def test_unknown_client_header_rejected() -> None:
    with pytest.raises(AuthError) as exc:
        resolve_auth_client_kind(header="mobile", fingerprint="zynd-12345678")
    assert exc.value.code == "invalid_auth_client"


def test_support_agent_allowed_on_support_client() -> None:
    user = _admin_user()
    validate_user_role_for_client(
        user,
        client="support",
        role_keys=["support_agent"],
    )


def test_support_agent_blocked_from_admin_client() -> None:
    user = _admin_user()
    with pytest.raises(AuthError) as exc:
        validate_user_role_for_client(
            user,
            client="admin",
            role_keys=["support_agent"],
        )
    assert exc.value.code == "support_console_required"


def test_super_admin_blocked_from_support_client() -> None:
    user = _admin_user()
    with pytest.raises(AuthError) as exc:
        validate_user_role_for_client(
            user,
            client="support",
            role_keys=["super_admin"],
        )
    assert exc.value.code == "support_console_required"


def test_support_agent_invite_requires_support_client() -> None:
    with pytest.raises(AuthError) as exc:
        validate_invite_client_for_role(role_key="support_agent", client="admin")
    assert exc.value.code == "support_console_required"


def test_support_client_requires_matching_header_and_fingerprint() -> None:
    assert (
        resolve_auth_client_kind(header="support", fingerprint="support-console") == "support"
    )


def test_support_role_invite_targets_support_console() -> None:
    assert invite_target_console("support_lead") == "support"
