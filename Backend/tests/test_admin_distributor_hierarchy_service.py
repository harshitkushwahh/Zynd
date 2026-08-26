from __future__ import annotations

from datetime import datetime, timezone

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.admin_distributor_hierarchy_service import (
    AdminDistributorHierarchyError,
    _generate_branch_id,
    approve_admin_distributor_branch,
    assign_admin_distributor_branch_manager,
    create_admin_distributor_branch,
    create_admin_distributor_state_head,
    get_actor_hierarchy_state_scope,
    get_admin_distributor_overview,
    get_admin_distributor_branch,
    invite_admin_mitra_manager,
    list_admin_distributor_branches,
    list_admin_distributor_state_heads,
    list_eligible_branch_manager_candidates,
    list_eligible_state_head_candidates,
    list_admin_distributor_managers,
    list_admin_distributor_partners,
    list_admin_mitra_manager_invitations,
    list_unassigned_hierarchy_states,
    pause_admin_distributor_state_head,
    replace_admin_distributor_state_head,
    unassign_admin_distributor_branch_manager,
    update_admin_distributor_branch,
    resume_admin_distributor_state_head,
    unassign_admin_distributor_state_head,
)
from app.application.admin.rbac_service import (
    DISTRIBUTOR_MANAGER_ROLE_KEY,
    MITRA_STATE_HEAD_ROLE_KEY,
    MITRA_SUPER_HEAD_ROLE_KEY,
    ensure_rbac_seed,
    set_admin_user_roles,
)
from app.core.config import get_settings
from app.infrastructure.persistence.distributor_branch_models import DistributorBranch, DistributorBranchStatus
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
async def test_get_admin_distributor_branch_returns_detail(db_session: AsyncSession) -> None:
    await _seed_test_branch_manager(db_session)
    await db_session.commit()

    branches = await list_admin_distributor_branches(db_session, state_filter=None)
    seeded_branch = next(row for row in branches if row["id"].startswith("br-test-"))

    detail = await get_admin_distributor_branch(
        db_session,
        branch_id=seeded_branch["id"],
        state_filter=None,
    )
    assert detail["id"] == seeded_branch["id"]
    assert detail["name"] == seeded_branch["name"]
    assert detail["created_at"]
    assert "active_partner_count" in detail

    with pytest.raises(AdminDistributorHierarchyError) as exc:
        await get_admin_distributor_branch(
            db_session,
            branch_id=seeded_branch["id"],
            state_filter="KA",
        )
    assert exc.value.code == "branch_not_found"


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
    assert branch["id"] == "mh001"
    assert branch["branch_code"] == "MH001"
    assert branch["status"] == "active"


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


@pytest.mark.asyncio
async def test_list_state_heads_includes_network_aggregates(db_session: AsyncSession) -> None:
    await ensure_rbac_seed(db_session)
    now = datetime.now(timezone.utc)
    admin_user = User(
        email="aggregate-state-head@test.example",
        password_hash=hash_password("12345678"),
        first_name="Agg",
        last_name="Head",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    super_head = User(
        email="aggregate-super-head@test.example",
        password_hash=hash_password("12345678"),
        first_name="Super",
        last_name="Head",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    db_session.add_all([admin_user, super_head])
    await db_session.flush()
    await set_admin_user_roles(db_session, user_id=admin_user.id, role_keys=[MITRA_STATE_HEAD_ROLE_KEY])
    await set_admin_user_roles(db_session, user_id=super_head.id, role_keys=[MITRA_SUPER_HEAD_ROLE_KEY])

    await create_admin_distributor_state_head(
        db_session,
        user_id=admin_user.id,
        state_code="MP",
        state_name="Madhya Pradesh",
    )
    await create_admin_distributor_branch(
        db_session,
        name="Indore HQ",
        city="Indore",
        state_code="MP",
        state_name="Madhya Pradesh",
        actor=admin_user,
    )

    items = await list_admin_distributor_state_heads(db_session, state_filter=None)
    match = next(row for row in items if row["email"] == "aggregate-state-head@test.example")
    assert match["state_code"] == "MP"
    assert match["branch_count"] == 1
    assert match["pending_branch_count"] == 1
    assert match["unassigned_branch_count"] == 1
    assert match["manager_count"] == 0
    assert match["partner_count"] == 0
    assert "aum_inr" in match
    assert "client_count" in match


@pytest.mark.asyncio
async def test_create_branch_rejects_out_of_scope_state_for_state_head(db_session: AsyncSession) -> None:
    await ensure_rbac_seed(db_session)
    now = datetime.now(timezone.utc)
    state_head = User(
        email="mh-state-head@test.example",
        password_hash=hash_password("12345678"),
        first_name="MH",
        last_name="Head",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    manager = User(
        email="branch-manager-scope@test.example",
        password_hash=hash_password("12345678"),
        first_name="Branch",
        last_name="Manager",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    db_session.add_all([state_head, manager])
    await db_session.flush()
    await set_admin_user_roles(db_session, user_id=state_head.id, role_keys=[MITRA_STATE_HEAD_ROLE_KEY])
    await set_admin_user_roles(db_session, user_id=manager.id, role_keys=[DISTRIBUTOR_MANAGER_ROLE_KEY])
    await create_admin_distributor_state_head(
        db_session,
        user_id=state_head.id,
        state_code="MH",
        state_name="Maharashtra",
    )

    with pytest.raises(AdminDistributorHierarchyError) as exc:
        await create_admin_distributor_branch(
            db_session,
            name="Bangalore Central",
            city="Bengaluru",
            state_code="KA",
            state_name="Karnataka",
            manager_user_id=manager.id,
            actor=state_head,
        )

    assert exc.value.code == "state_scope_violation"


@pytest.mark.asyncio
async def test_state_head_can_invite_mitra_manager(db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
    await ensure_rbac_seed(db_session)
    now = datetime.now(timezone.utc)
    state_head = User(
        email="invite-state-head@test.example",
        password_hash=hash_password("12345678"),
        first_name="Invite",
        last_name="Head",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    db_session.add(state_head)
    await db_session.flush()
    await set_admin_user_roles(db_session, user_id=state_head.id, role_keys=[MITRA_STATE_HEAD_ROLE_KEY])
    await create_admin_distributor_state_head(
        db_session,
        user_id=state_head.id,
        state_code="MH",
        state_name="Maharashtra",
    )

    async def fake_create_admin_invitation(db, *, actor, email, role_key, first_name=None, last_name=None, ip=None):
        assert actor.id == state_head.id
        assert email == "new-manager@test.example"
        assert role_key == DISTRIBUTOR_MANAGER_ROLE_KEY
        return {"email": email, "role_key": role_key}

    monkeypatch.setattr(
        "app.application.admin.admin_invitation_service.create_admin_invitation",
        fake_create_admin_invitation,
    )

    invitation = await invite_admin_mitra_manager(
        db_session,
        actor=state_head,
        email="new-manager@test.example",
        first_name="New",
        last_name="Manager",
    )
    assert invitation["email"] == "new-manager@test.example"


@pytest.mark.asyncio
async def test_state_head_branch_request_is_pending_until_super_head_approves(db_session: AsyncSession) -> None:
    await ensure_rbac_seed(db_session)
    now = datetime.now(timezone.utc)
    state_head = User(
        email="pending-branch-state-head@test.example",
        password_hash=hash_password("12345678"),
        first_name="Pending",
        last_name="Head",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    super_head = User(
        email="pending-branch-super-head@test.example",
        password_hash=hash_password("12345678"),
        first_name="Pending",
        last_name="Super",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    db_session.add_all([state_head, super_head])
    await db_session.flush()
    await set_admin_user_roles(db_session, user_id=state_head.id, role_keys=[MITRA_STATE_HEAD_ROLE_KEY])
    await set_admin_user_roles(db_session, user_id=super_head.id, role_keys=[MITRA_SUPER_HEAD_ROLE_KEY])
    await create_admin_distributor_state_head(
        db_session,
        user_id=state_head.id,
        state_code="MH",
        state_name="Maharashtra",
    )

    branch = await create_admin_distributor_branch(
        db_session,
        name="Nashik Central",
        city="Nashik",
        state_code="MH",
        state_name="Maharashtra",
        actor=state_head,
    )
    assert branch["status"] == "pending_approval"
    assert branch["branch_code"] == "MH001"
    assert branch["created_by_user_id"] == str(state_head.id)

    approved = await approve_admin_distributor_branch(
        db_session,
        branch_id=branch["id"],
        actor=super_head,
    )
    assert approved["status"] == "active"


@pytest.mark.asyncio
async def test_state_head_can_assign_manager_to_own_active_branch(db_session: AsyncSession) -> None:
    await ensure_rbac_seed(db_session)
    now = datetime.now(timezone.utc)
    state_head = User(
        email="assign-manager-state-head@test.example",
        password_hash=hash_password("12345678"),
        first_name="Assign",
        last_name="Head",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    super_head = User(
        email="assign-manager-super-head@test.example",
        password_hash=hash_password("12345678"),
        first_name="Assign",
        last_name="Super",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    manager = User(
        email="assign-manager-user@test.example",
        password_hash=hash_password("12345678"),
        first_name="Assign",
        last_name="Manager",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    db_session.add_all([state_head, super_head, manager])
    await db_session.flush()
    await set_admin_user_roles(db_session, user_id=state_head.id, role_keys=[MITRA_STATE_HEAD_ROLE_KEY])
    await set_admin_user_roles(db_session, user_id=super_head.id, role_keys=[MITRA_SUPER_HEAD_ROLE_KEY])
    await set_admin_user_roles(db_session, user_id=manager.id, role_keys=[DISTRIBUTOR_MANAGER_ROLE_KEY])
    await create_admin_distributor_state_head(
        db_session,
        user_id=state_head.id,
        state_code="MH",
        state_name="Maharashtra",
    )

    branch = await create_admin_distributor_branch(
        db_session,
        name="Thane East",
        city="Thane",
        state_code="MH",
        state_name="Maharashtra",
        actor=state_head,
    )
    await approve_admin_distributor_branch(db_session, branch_id=branch["id"], actor=super_head)

    assigned = await assign_admin_distributor_branch_manager(
        db_session,
        branch_id=branch["id"],
        manager_user_id=manager.id,
        actor=state_head,
    )
    assert assigned["manager_id"] == str(manager.id)


@pytest.mark.asyncio
async def test_assign_branch_manager_replaces_unavailable_manager(db_session: AsyncSession) -> None:
    await ensure_rbac_seed(db_session)
    now = datetime.now(timezone.utc)
    state_head = User(
        email=f"state-head-{uuid4()}@test.example",
        password_hash=hash_password("12345678"),
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    super_head = User(
        email=f"super-head-{uuid4()}@test.example",
        password_hash=hash_password("12345678"),
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    stale_manager = User(
        email=f"stale-manager-{uuid4()}@test.example",
        password_hash=hash_password("12345678"),
        role=UserRole.admin,
        status=UserStatus.deleted,
        email_verified_at=now,
    )
    replacement = User(
        email=f"replacement-manager-{uuid4()}@test.example",
        password_hash=hash_password("12345678"),
        first_name="New",
        last_name="Manager",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    db_session.add_all([state_head, super_head, stale_manager, replacement])
    await db_session.flush()
    await set_admin_user_roles(db_session, user_id=state_head.id, role_keys=[MITRA_STATE_HEAD_ROLE_KEY])
    await set_admin_user_roles(db_session, user_id=super_head.id, role_keys=[MITRA_SUPER_HEAD_ROLE_KEY])
    await set_admin_user_roles(db_session, user_id=replacement.id, role_keys=[DISTRIBUTOR_MANAGER_ROLE_KEY])
    await create_admin_distributor_state_head(
        db_session,
        user_id=state_head.id,
        state_code="MP",
        state_name="Madhya Pradesh",
    )

    branch = await create_admin_distributor_branch(
        db_session,
        name="Indore",
        city="Indore",
        state_code="MP",
        state_name="Madhya Pradesh",
        actor=state_head,
    )
    await approve_admin_distributor_branch(db_session, branch_id=branch["id"], actor=super_head)

    from app.infrastructure.persistence.distributor_branch_models import DistributorBranch

    branch_row = await db_session.get(DistributorBranch, branch["id"])
    assert branch_row is not None
    branch_row.manager_user_id = stale_manager.id
    await db_session.flush()

    assigned = await assign_admin_distributor_branch_manager(
        db_session,
        branch_id=branch["id"],
        manager_user_id=replacement.id,
        actor=super_head,
    )

    assert assigned["manager_id"] == str(replacement.id)
    assert assigned["manager_unavailable"] is False


@pytest.mark.asyncio
async def test_unassign_branch_manager_clears_assignment(db_session: AsyncSession) -> None:
    await ensure_rbac_seed(db_session)
    now = datetime.now(timezone.utc)
    super_head = User(
        email=f"super-head-unassign-{uuid4()}@test.example",
        password_hash=hash_password("12345678"),
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    manager = User(
        email=f"manager-unassign-{uuid4()}@test.example",
        password_hash=hash_password("12345678"),
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    db_session.add_all([super_head, manager])
    await db_session.flush()
    await set_admin_user_roles(db_session, user_id=super_head.id, role_keys=[MITRA_SUPER_HEAD_ROLE_KEY])
    await set_admin_user_roles(db_session, user_id=manager.id, role_keys=[DISTRIBUTOR_MANAGER_ROLE_KEY])

    branch = await create_admin_distributor_branch(
        db_session,
        name="Bhopal",
        city="Bhopal",
        state_code="MP",
        state_name="Madhya Pradesh",
        actor=super_head,
    )
    await approve_admin_distributor_branch(db_session, branch_id=branch["id"], actor=super_head)
    await assign_admin_distributor_branch_manager(
        db_session,
        branch_id=branch["id"],
        manager_user_id=manager.id,
        actor=super_head,
    )

    cleared = await unassign_admin_distributor_branch_manager(
        db_session,
        branch_id=branch["id"],
        actor=super_head,
    )

    assert cleared["manager_id"] is None
    assert cleared["manager_unavailable"] is False


@pytest.mark.asyncio
async def test_update_branch_details(db_session: AsyncSession) -> None:
    await ensure_rbac_seed(db_session)
    now = datetime.now(timezone.utc)
    super_head = User(
        email=f"super-head-update-{uuid4()}@test.example",
        password_hash=hash_password("12345678"),
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    db_session.add(super_head)
    await db_session.flush()
    await set_admin_user_roles(db_session, user_id=super_head.id, role_keys=[MITRA_SUPER_HEAD_ROLE_KEY])

    branch = await create_admin_distributor_branch(
        db_session,
        name="Indore",
        city="Indore",
        state_code="MP",
        state_name="Madhya Pradesh",
        actor=super_head,
    )
    await approve_admin_distributor_branch(db_session, branch_id=branch["id"], actor=super_head)

    updated = await update_admin_distributor_branch(
        db_session,
        branch_id=branch["id"],
        actor=super_head,
        name="Indore Central",
        city="Indore City",
    )

    assert updated["name"] == "Indore Central"
    assert updated["city"] == "Indore City"


@pytest.mark.asyncio
async def test_state_head_overview_uses_assignment_not_default_state(db_session: AsyncSession) -> None:
    await ensure_rbac_seed(db_session)
    now = datetime.now(timezone.utc)
    state_head = User(
        email="mp-state-head-overview@test.example",
        password_hash=hash_password("12345678"),
        first_name="MP",
        last_name="Head",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    db_session.add(state_head)
    await db_session.flush()
    await set_admin_user_roles(db_session, user_id=state_head.id, role_keys=[MITRA_STATE_HEAD_ROLE_KEY])
    await create_admin_distributor_state_head(
        db_session,
        user_id=state_head.id,
        state_code="MP",
        state_name="Madhya Pradesh",
    )

    overview = await get_admin_distributor_overview(
        db_session,
        state_filter="MP",
        actor=state_head,
    )

    assert overview["state_code"] == "MP"
    assert overview["state_name"] == "Madhya Pradesh"
    assert overview["state_assigned"] is True


@pytest.mark.asyncio
async def test_state_head_sees_only_own_mitra_manager_invitations(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    await ensure_rbac_seed(db_session)
    now = datetime.now(timezone.utc)
    state_head = User(
        email="invite-list-state-head@test.example",
        password_hash=hash_password("12345678"),
        first_name="Invite",
        last_name="Head",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    other_state_head = User(
        email="invite-list-other-head@test.example",
        password_hash=hash_password("12345678"),
        first_name="Other",
        last_name="Head",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    db_session.add_all([state_head, other_state_head])
    await db_session.flush()
    await set_admin_user_roles(db_session, user_id=state_head.id, role_keys=[MITRA_STATE_HEAD_ROLE_KEY])
    await set_admin_user_roles(db_session, user_id=other_state_head.id, role_keys=[MITRA_STATE_HEAD_ROLE_KEY])
    await create_admin_distributor_state_head(
        db_session,
        user_id=state_head.id,
        state_code="MP",
        state_name="Madhya Pradesh",
    )
    await create_admin_distributor_state_head(
        db_session,
        user_id=other_state_head.id,
        state_code="MH",
        state_name="Maharashtra",
    )

    async def fake_create_admin_invitation(db, *, actor, email, role_key, first_name=None, last_name=None, ip=None):
        from app.infrastructure.persistence.models import AdminInvitation, AdminInvitationStatus

        invitation = AdminInvitation(
            email=email,
            first_name=first_name,
            last_name=last_name,
            role_key=role_key,
            status=AdminInvitationStatus.pending,
            invited_by=actor.id,
            expires_at=now,
        )
        db.add(invitation)
        await db.flush()
        return {"id": str(invitation.id), "email": email, "role_key": role_key, "status": "pending"}

    monkeypatch.setattr(
        "app.application.admin.admin_invitation_service.create_admin_invitation",
        fake_create_admin_invitation,
    )

    await invite_admin_mitra_manager(
        db_session,
        actor=state_head,
        email="mp-manager@test.example",
    )
    await invite_admin_mitra_manager(
        db_session,
        actor=other_state_head,
        email="mh-manager@test.example",
    )

    items = await list_admin_mitra_manager_invitations(db_session, actor=state_head)
    assert len(items) == 1
    assert items[0]["email"] == "mp-manager@test.example"


@pytest.mark.asyncio
async def test_pause_and_resume_state_head_blocks_write_scope(db_session: AsyncSession) -> None:
    await ensure_rbac_seed(db_session)
    now = datetime.now(timezone.utc)
    state_head = User(
        email="pause-state-head@test.example",
        password_hash=hash_password("12345678"),
        first_name="Paused",
        last_name="Head",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    db_session.add(state_head)
    await db_session.flush()
    await set_admin_user_roles(db_session, user_id=state_head.id, role_keys=[MITRA_STATE_HEAD_ROLE_KEY, DISTRIBUTOR_MANAGER_ROLE_KEY])
    await create_admin_distributor_state_head(
        db_session,
        user_id=state_head.id,
        state_code="MP",
        state_name="Madhya Pradesh",
    )

    paused = await pause_admin_distributor_state_head(db_session, user_id=state_head.id)
    assert paused["status"] == "paused"
    with pytest.raises(AdminDistributorHierarchyError, match="paused"):
        await get_actor_hierarchy_state_scope(db_session, actor=state_head)

    resumed = await resume_admin_distributor_state_head(db_session, user_id=state_head.id)
    assert resumed["status"] == "active"
    scope = await get_actor_hierarchy_state_scope(db_session, actor=state_head)
    assert scope == ("MP", "Madhya Pradesh")


@pytest.mark.asyncio
async def test_unassign_state_head_keeps_branches_and_marks_state_vacant(db_session: AsyncSession) -> None:
    await ensure_rbac_seed(db_session)
    now = datetime.now(timezone.utc)
    state_head = User(
        email="unassign-state-head@test.example",
        password_hash=hash_password("12345678"),
        first_name="Leaving",
        last_name="Head",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    db_session.add(state_head)
    await db_session.flush()
    await set_admin_user_roles(db_session, user_id=state_head.id, role_keys=[MITRA_STATE_HEAD_ROLE_KEY, DISTRIBUTOR_MANAGER_ROLE_KEY])
    await create_admin_distributor_state_head(
        db_session,
        user_id=state_head.id,
        state_code="MP",
        state_name="Madhya Pradesh",
    )
    await create_admin_distributor_branch(
        db_session,
        name="Bhopal HQ",
        city="Bhopal",
        state_code="MP",
        state_name="Madhya Pradesh",
        actor=state_head,
    )

    result = await unassign_admin_distributor_state_head(db_session, user_id=state_head.id)
    assert result["unassigned"] is True
    assert result["state_code"] == "MP"

    heads = await list_admin_distributor_state_heads(db_session, state_filter=None)
    assert all(row["email"] != "unassign-state-head@test.example" for row in heads)

    vacant = await list_unassigned_hierarchy_states(db_session, state_filter=None)
    assert any(row["state_code"] == "MP" for row in vacant)

    branches = await list_admin_distributor_branches(db_session, state_filter="MP")
    assert len(branches) == 1
    assert branches[0]["name"] == "Bhopal HQ"


@pytest.mark.asyncio
async def test_replace_state_head_moves_assignment_not_the_network(db_session: AsyncSession) -> None:
    await ensure_rbac_seed(db_session)
    now = datetime.now(timezone.utc)
    current = User(
        email="old-state-head@test.example",
        password_hash=hash_password("12345678"),
        first_name="Old",
        last_name="Head",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    replacement = User(
        email="new-state-head@test.example",
        password_hash=hash_password("12345678"),
        first_name="New",
        last_name="Head",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    db_session.add_all([current, replacement])
    await db_session.flush()
    await set_admin_user_roles(db_session, user_id=current.id, role_keys=[MITRA_STATE_HEAD_ROLE_KEY, DISTRIBUTOR_MANAGER_ROLE_KEY])
    await set_admin_user_roles(db_session, user_id=replacement.id, role_keys=[DISTRIBUTOR_MANAGER_ROLE_KEY])
    await create_admin_distributor_state_head(
        db_session,
        user_id=current.id,
        state_code="MP",
        state_name="Madhya Pradesh",
    )
    await create_admin_distributor_branch(
        db_session,
        name="Indore West",
        city="Indore",
        state_code="MP",
        state_name="Madhya Pradesh",
        actor=current,
    )

    result = await replace_admin_distributor_state_head(
        db_session,
        current_user_id=current.id,
        replacement_user_id=replacement.id,
    )
    assert result["previous_user_id"] == str(current.id)
    assert result["state_head"]["email"] == "new-state-head@test.example"
    assert result["state_head"]["state_code"] == "MP"

    heads = await list_admin_distributor_state_heads(db_session, state_filter=None)
    emails = {row["email"] for row in heads if row["state_code"] == "MP"}
    assert emails == {"new-state-head@test.example"}

    branches = await list_admin_distributor_branches(db_session, state_filter="MP")
    assert len(branches) == 1
    assert branches[0]["name"] == "Indore West"

    vacant = await list_unassigned_hierarchy_states(db_session, state_filter=None)
    assert all(row["state_code"] != "MP" for row in vacant)
