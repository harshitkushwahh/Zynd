from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.admin_action_service import (
    approve_admin_action_request,
    create_admin_action_request,
)
from app.application.admin.audit_admin_service import list_audit_logs
from app.application.admin.permission_matrix import PERMISSION_ROUTE_MATRIX
from app.application.admin.rbac_service import (
    assign_role_to_admin_user,
    create_admin_permission,
    create_admin_role,
    delete_admin_role,
    ensure_rbac_seed,
    get_user_permission_keys,
    list_user_role_keys,
    revoke_role_from_admin_user,
    update_admin_role,
    user_has_permission,
)
from app.application.admin.user_admin_service import list_users
from app.application.security.security_config_service import (
    ensure_security_config_seed,
    get_security_config_value,
    list_security_config,
)
from app.infrastructure.persistence.models import (
    AdminActionType,
    AuditEventType,
    AuditLog,
    User,
    UserRole,
    UserStatus,
)


@pytest.mark.asyncio
async def test_list_users_and_audit_logs(db_session: AsyncSession) -> None:
    user = User(
        email=f"listed-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    db_session.add(
        AuditLog(
            user_id=user.id,
            event_type=AuditEventType.login_success,
            ip_address="127.0.0.1",
            metadata_={"source": "test"},
        )
    )
    await db_session.flush()

    users = await list_users(db_session, email="listed-", limit=10)
    assert any(item["user_id"] == user.id for item in users)
    listed = next(item for item in users if item["user_id"] == user.id)
    assert listed["kyc_compliant"] is False

    logs = await list_audit_logs(
        db_session,
        user_id=user.id,
        event_type=AuditEventType.login_success,
    )
    assert len(logs) >= 1
    assert logs[0]["event_type"] == "login_success"


@pytest.mark.asyncio
async def test_support_agent_has_read_only_permissions(db_session: AsyncSession) -> None:
    admin = User(
        email=f"support-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(admin)
    await db_session.flush()
    await ensure_rbac_seed(db_session)

    await assign_role_to_admin_user(
        db_session,
        user_id=admin.id,
        role_key="support_agent",
    )
    await revoke_role_from_admin_user(
        db_session,
        user_id=admin.id,
        role_key="super_admin",
    )

    permissions = await get_user_permission_keys(db_session, admin.id)
    assert "users.read" in permissions
    assert "security_reviews.read" in permissions
    assert "documents.read" in permissions
    assert "users.suspend" not in permissions
    assert "rbac.manage" not in permissions
    assert "transactions.execute" not in permissions
    assert "documents.download" not in permissions


@pytest.mark.asyncio
async def test_rbac_assign_and_revoke_roles(db_session: AsyncSession) -> None:
    admin = User(
        email=f"rbac-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(admin)
    await db_session.flush()
    await ensure_rbac_seed(db_session)

    roles = await assign_role_to_admin_user(
        db_session,
        user_id=admin.id,
        role_key="compliance_officer",
    )
    assert "compliance_officer" in roles
    assert "super_admin" in roles

    roles = await revoke_role_from_admin_user(
        db_session,
        user_id=admin.id,
        role_key="compliance_officer",
    )
    assert "compliance_officer" not in roles
    assert "super_admin" in roles


@pytest.mark.asyncio
async def test_security_config_update_via_maker_checker(db_session: AsyncSession) -> None:
    await ensure_security_config_seed(db_session)

    requester = User(
        email=f"req-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    approver = User(
        email=f"app-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add_all([requester, approver])
    await db_session.flush()
    await ensure_rbac_seed(db_session)

    before = await get_security_config_value(db_session, "lockout.max_attempts", 8)
    new_value = before + 1

    action = await create_admin_action_request(
        db_session,
        action_type=AdminActionType.security_config_update,
        requester=requester,
        payload={"key": "lockout.max_attempts", "value": new_value},
        reason="Phase 5 test bump",
        ip="127.0.0.1",
    )
    result = await approve_admin_action_request(
        db_session,
        action_id=action["id"],
        approver=approver,
        ip="127.0.0.1",
    )
    assert result["status"] == "approved"
    assert result["outcome"]["value"] == new_value

    after = await get_security_config_value(db_session, "lockout.max_attempts", 8)
    assert after == new_value

    config_items = await list_security_config(db_session)
    keys = {item["key"] for item in config_items}
    assert "lockout.max_attempts" in keys


@pytest.mark.asyncio
async def test_compliance_officer_lacks_transactions_execute(db_session: AsyncSession) -> None:
    admin = User(
        email=f"co-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(admin)
    await db_session.flush()
    await ensure_rbac_seed(db_session)

    await assign_role_to_admin_user(db_session, user_id=admin.id, role_key="compliance_officer")
    await revoke_role_from_admin_user(db_session, user_id=admin.id, role_key="super_admin")

    assert not await user_has_permission(db_session, admin.id, "transactions.execute")

    super_admin_roles = await list_user_role_keys(db_session, admin.id)
    assert super_admin_roles == ["compliance_officer"]


def test_permission_matrix_fully_enforced() -> None:
    for entry in PERMISSION_ROUTE_MATRIX:
        assert entry["status"] == "enforced", entry["permission"]
        assert entry["routes"], entry["permission"]


@pytest.mark.asyncio
async def test_rbac_role_and_permission_crud(db_session: AsyncSession) -> None:
    await ensure_rbac_seed(db_session)

    permission = await create_admin_permission(
        db_session,
        key="reports.read",
        description="View custom operational reports",
    )
    assert permission["key"] == "reports.read"

    role = await create_admin_role(
        db_session,
        key="report_viewer",
        name="Report Viewer",
        description="Read-only custom report access.",
        permission_keys=["reports.read", "users.read"],
    )
    assert role["key"] == "report_viewer"
    assert "reports.read" in role["permissions"]
    assert role["is_system"] is False

    updated = await update_admin_role(
        db_session,
        role_key="report_viewer",
        name="Report Analyst",
        permission_keys=["reports.read"],
    )
    assert updated["name"] == "Report Analyst"
    assert updated["permissions"] == ["reports.read"]

    await delete_admin_role(db_session, role_key="report_viewer")

    with pytest.raises(ValueError, match="Built-in roles cannot be deleted"):
        await delete_admin_role(db_session, role_key="super_admin")
