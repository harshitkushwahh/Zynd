from __future__ import annotations

from datetime import datetime, timezone

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.admin_distributor_hierarchy_service import (
    _generate_branch_id,
    create_admin_distributor_branch,
    create_admin_distributor_state_head,
    get_admin_distributor_overview,
    list_admin_distributor_branches,
    list_eligible_branch_manager_candidates,
    list_eligible_state_head_candidates,
    list_admin_distributor_managers,
    list_admin_distributor_partners,
)
from app.application.admin.rbac_service import (
    DISTRIBUTOR_MANAGER_ROLE_KEY,
    ensure_rbac_seed,
    set_admin_user_roles,
)
from app.core.config import get_settings
from app.infrastructure.persistence.distributor_branch_models import DistributorBranch
from app.infrastructure.persistence.models import User, UserRole, UserStatus
from app.infrastructure.security.passwords import hash_password


async def _seed_test_branch_manager(db_session: AsyncSession) -> None:
    await ensure_rbac_seed(db_session)
    now = datetime.now(timezone.utc)
    suffix = uuid4().hex[:8]
    manager = User(
        email=f"branch-manager-{suffix}@test.example",
        password_hash=hash_password("12345678"),
        first_name="Test",
        last_name="Manager",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    db_session.add(manager)
    await db_session.flush()
    await set_admin_user_roles(db_session, user_id=manager.id, role_keys=[DISTRIBUTOR_MANAGER_ROLE_KEY])
    await create_admin_distributor_branch(
        db_session,
        name="Test Branch",
        city="Mumbai",
        state_code="MH",
        state_name="Maharashtra",
        manager_user_id=manager.id,
        branch_id=f"br-test-{suffix}",
    )


@pytest.mark.asyncio
async def test_admin_hierarchy_lists_seeded_branch(db_session: AsyncSession) -> None:
    await _seed_test_branch_manager(db_session)
    await db_session.commit()

    branches = await list_admin_distributor_branches(db_session, state_filter=None)
    managers = await list_admin_distributor_managers(db_session, state_filter=None)
    overview = await get_admin_distributor_overview(db_session, state_filter=None)

    assert len(branches) >= 1
    seeded_branch = next(row for row in branches if row["id"].startswith("br-test-"))
    assert seeded_branch["state_code"] == "MH"
    seeded_manager = next(row for row in managers if row["email"].endswith("@test.example"))
    assert seeded_manager["email"].endswith("@test.example")
    assert overview["branch_count"] >= 1
    assert overview["manager_count"] >= 1


@pytest.mark.asyncio
async def test_admin_hierarchy_state_filter_limits_results(db_session: AsyncSession) -> None:
    await _seed_test_branch_manager(db_session)
    await db_session.commit()

    empty = await list_admin_distributor_branches(db_session, state_filter="__none__")
    assert empty == []

    partners = await list_admin_distributor_partners(db_session, state_filter="MH")
    assert isinstance(partners, list)


@pytest.mark.asyncio
async def test_generate_branch_id_is_unique(db_session: AsyncSession) -> None:
    first = await _generate_branch_id(db_session, name="Pune West", city="Pune")
    assert first == "br-pune-west"

    await ensure_rbac_seed(db_session)
    now = datetime.now(timezone.utc)
    manager = User(
        email="existing-branch-manager@test.example",
        password_hash=hash_password("12345678"),
        first_name="Existing",
        last_name="Manager",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    db_session.add(manager)
    await db_session.flush()
    db_session.add(
        DistributorBranch(
            id=first,
            name="Existing",
            city="Pune",
            state_code="MH",
            state_name="Maharashtra",
            manager_user_id=manager.id,
        )
    )
    await db_session.flush()

    second = await _generate_branch_id(db_session, name="Pune West", city="Pune")
    assert second == "br-pune-west-2"


@pytest.mark.asyncio
async def test_list_eligible_branch_manager_candidates_excludes_assigned(db_session: AsyncSession) -> None:
    await ensure_rbac_seed(db_session)
    now = datetime.now(timezone.utc)
    assigned = User(
        email="assigned-manager@test.example",
        password_hash=hash_password("12345678"),
        first_name="Assigned",
        last_name="Manager",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    available = User(
        email="available-manager@test.example",
        password_hash=hash_password("12345678"),
        first_name="Available",
        last_name="Manager",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    db_session.add_all([assigned, available])
    await db_session.flush()
    await set_admin_user_roles(db_session, user_id=assigned.id, role_keys=[DISTRIBUTOR_MANAGER_ROLE_KEY])
    await set_admin_user_roles(db_session, user_id=available.id, role_keys=[DISTRIBUTOR_MANAGER_ROLE_KEY])
    await create_admin_distributor_branch(
        db_session,
        name="Assigned Branch",
        city="Mumbai",
        state_code="MH",
        state_name="Maharashtra",
        manager_user_id=assigned.id,
        branch_id="br-assigned",
    )

    candidates = await list_eligible_branch_manager_candidates(db_session)
    emails = {row["email"] for row in candidates}
    assert "available-manager@test.example" in emails
    assert "assigned-manager@test.example" not in emails


@pytest.mark.asyncio
async def test_create_branch_auto_generates_id(db_session: AsyncSession) -> None:
    await ensure_rbac_seed(db_session)
    now = datetime.now(timezone.utc)
    manager = User(
        email="auto-branch-manager@test.example",
        password_hash=hash_password("12345678"),
        first_name="Auto",
        last_name="Manager",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    db_session.add(manager)
    await db_session.flush()
    await set_admin_user_roles(db_session, user_id=manager.id, role_keys=[DISTRIBUTOR_MANAGER_ROLE_KEY])

    branch = await create_admin_distributor_branch(
        db_session,
        name="Pune West",
        city="Pune",
        state_code="MH",
        state_name="Maharashtra",
        manager_user_id=manager.id,
    )
    assert branch["id"] == "br-pune-west"


@pytest.mark.asyncio
async def test_list_eligible_state_head_candidates_excludes_assigned(db_session: AsyncSession) -> None:
    await ensure_rbac_seed(db_session)
    now = datetime.now(timezone.utc)
    assigned = User(
        email="assigned-state-head@test.example",
        password_hash=hash_password("12345678"),
        first_name="Assigned",
        last_name="Head",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    available = User(
        email="available-state-head@test.example",
        password_hash=hash_password("12345678"),
        first_name="Available",
        last_name="Head",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    db_session.add_all([assigned, available])
    await db_session.flush()
    await set_admin_user_roles(db_session, user_id=assigned.id, role_keys=[DISTRIBUTOR_MANAGER_ROLE_KEY])
    await set_admin_user_roles(db_session, user_id=available.id, role_keys=[DISTRIBUTOR_MANAGER_ROLE_KEY])
    await create_admin_distributor_state_head(
        db_session,
        user_id=assigned.id,
        state_code="MH",
        state_name="Maharashtra",
    )

    candidates = await list_eligible_state_head_candidates(db_session)
    emails = {row["email"] for row in candidates}
    assert "available-state-head@test.example" in emails
    assert "assigned-state-head@test.example" not in emails


@pytest.mark.asyncio
async def test_create_state_head_assigns_existing_admin_user(db_session: AsyncSession) -> None:
    await ensure_rbac_seed(db_session)
    now = datetime.now(timezone.utc)
    admin_user = User(
        email="future-state-head@test.example",
        password_hash=hash_password("12345678"),
        first_name="Future",
        last_name="Head",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    db_session.add(admin_user)
    await db_session.flush()
    await set_admin_user_roles(db_session, user_id=admin_user.id, role_keys=[DISTRIBUTOR_MANAGER_ROLE_KEY])

    state_head = await create_admin_distributor_state_head(
        db_session,
        user_id=admin_user.id,
        state_code="KA",
        state_name="Karnataka",
    )

    assert state_head["email"] == "future-state-head@test.example"
    assert state_head["state_code"] == "KA"
