from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.rbac_service import (
    ensure_rbac_seed,
    list_user_role_keys,
    set_admin_user_roles,
)
from app.application.admin.user_admin_service import create_admin_user, list_users
from app.infrastructure.persistence.models import User, UserRole, UserStatus


@pytest.mark.asyncio
async def test_create_admin_user_assigns_team_roles(db_session: AsyncSession) -> None:
    actor = User(
        email=f"actor-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(actor)
    await db_session.flush()
    await ensure_rbac_seed(db_session)

    summary = await create_admin_user(
        db_session,
        actor=actor,
        email=f"new-admin-{uuid4()}@example.com",
        first_name="Ops",
        last_name="Lead",
        password="password123",
        role_keys=["mitra_manager"],
        ip="127.0.0.1",
    )

    assert summary["role"] == UserRole.admin.value
    assert summary["roles"] == ["mitra_manager"]
    assert summary["display_name"] == "Ops Lead"

    role_keys = await list_user_role_keys(db_session, summary["user_id"])
    assert role_keys == ["mitra_manager"]


@pytest.mark.asyncio
async def test_create_admin_user_rejects_customer_email(db_session: AsyncSession) -> None:
    shared_email = f"customer-{uuid4()}@example.com"
    customer = User(
        email=shared_email,
        password_hash="hash",
        role=UserRole.user,
        status=UserStatus.active,
    )
    actor = User(
        email=f"actor-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add_all([customer, actor])
    await db_session.flush()
    await ensure_rbac_seed(db_session)

    with pytest.raises(ValueError, match="customer account"):
        await create_admin_user(
            db_session,
            actor=actor,
            email=shared_email,
            first_name="Ops",
            last_name=None,
            password="password123",
            role_keys=["mitra_manager"],
        )


@pytest.mark.asyncio
async def test_list_users_filters_by_admin_role(db_session: AsyncSession) -> None:
    admin = User(
        email=f"admin-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    customer = User(
        email=f"customer-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add_all([admin, customer])
    await db_session.flush()

    admins = await list_users(db_session, role=UserRole.admin, limit=100)
    admin_ids = {item["user_id"] for item in admins}

    assert admin.id in admin_ids
    assert customer.id not in admin_ids


@pytest.mark.asyncio
async def test_set_admin_user_roles_replaces_assignments(db_session: AsyncSession) -> None:
    admin = User(
        email=f"admin-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(admin)
    await db_session.flush()
    await ensure_rbac_seed(db_session)

    roles = await set_admin_user_roles(
        db_session,
        user_id=admin.id,
        role_keys=["mitra_manager", "mitra_state_head"],
    )
    assert sorted(roles) == ["mitra_manager", "mitra_state_head"]

    roles = await set_admin_user_roles(
        db_session,
        user_id=admin.id,
        role_keys=["super_admin"],
    )
    assert roles == ["super_admin"]


@pytest.mark.asyncio
async def test_list_users_puts_deleted_users_last(db_session: AsyncSession) -> None:
    from datetime import datetime, timedelta, timezone

    now = datetime.now(timezone.utc)
    active_user = User(
        email=f"active-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.user,
        status=UserStatus.active,
        created_at=now - timedelta(days=2),
    )
    deleted_user = User(
        email=f"deleted-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.deleted,
        created_at=now,
    )
    db_session.add_all([active_user, deleted_user])
    await db_session.flush()

    users = await list_users(db_session, limit=100)
    user_ids = [item["user_id"] for item in users]

    assert user_ids.index(active_user.id) < user_ids.index(deleted_user.id)
