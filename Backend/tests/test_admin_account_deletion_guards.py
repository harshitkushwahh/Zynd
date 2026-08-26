from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.rbac_service import ensure_rbac_seed, set_admin_user_roles
from app.application.admin.user_admin_service import cancel_admin_deletion_schedule
from app.application.auth.account_service import request_account_deletion
from app.application.auth.errors import AuthError
from app.application.compliance.deletion_executor_service import (
    execute_account_deletion,
    fetch_due_deletion_users,
    run_deletion_executor,
)
from app.application.compliance.retention_service import ensure_retention_seed
from app.infrastructure.persistence.models import User, UserRole, UserStatus


def _now() -> datetime:
    return datetime.now(timezone.utc)


@pytest.mark.asyncio
async def test_request_account_deletion_blocked_for_admin(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _noop_verify_step_up(*args, **kwargs) -> None:
        return None

    monkeypatch.setattr(
        "app.application.auth.account_service.verify_step_up",
        _noop_verify_step_up,
    )

    admin = User(
        email=f"admin-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(admin)
    await db_session.flush()

    with pytest.raises(AuthError) as exc:
        await request_account_deletion(
            db_session,
            user=admin,
            session_id=uuid4(),
            current_password="Password1!",
            totp_code=None,
            ip="127.0.0.1",
        )

    assert exc.value.code == "admin_deletion_blocked"
    assert admin.status == UserStatus.active


@pytest.mark.asyncio
async def test_fetch_due_deletion_users_excludes_admin_accounts(db_session: AsyncSession) -> None:
    due_customer = User(
        email=f"customer-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.user,
        status=UserStatus.deletion_pending,
        deletion_scheduled_at=_now() - timedelta(hours=1),
    )
    due_admin = User(
        email=f"admin-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.deletion_pending,
        deletion_scheduled_at=_now() - timedelta(hours=1),
    )
    db_session.add_all([due_customer, due_admin])
    await db_session.flush()

    due = await fetch_due_deletion_users(db_session)
    assert [user.id for user in due] == [due_customer.id]


@pytest.mark.asyncio
async def test_execute_account_deletion_rejects_admin_accounts(db_session: AsyncSession) -> None:
    await ensure_retention_seed(db_session)
    admin = User(
        email=f"admin-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.deletion_pending,
        deletion_scheduled_at=_now() - timedelta(minutes=5),
    )
    db_session.add(admin)
    await db_session.flush()

    with pytest.raises(ValueError, match="Only customer accounts"):
        await execute_account_deletion(db_session, user=admin)


@pytest.mark.asyncio
async def test_run_deletion_executor_skips_admin_accounts(db_session: AsyncSession) -> None:
    await ensure_retention_seed(db_session)
    admin = User(
        email=f"admin-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.deletion_pending,
        deletion_scheduled_at=_now() - timedelta(hours=1),
    )
    db_session.add(admin)
    await db_session.flush()

    result = await run_deletion_executor(db_session)
    assert result["executed"] == 0
    assert result["failed"] == 0
    assert admin.status == UserStatus.deletion_pending


@pytest.mark.asyncio
async def test_cancel_admin_deletion_schedule_restores_active_status(
    db_session: AsyncSession,
) -> None:
    actor = User(
        email=f"super-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    target = User(
        email=f"admin-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.deletion_pending,
        deletion_requested_at=_now() - timedelta(days=1),
        deletion_scheduled_at=_now() + timedelta(days=29),
    )
    db_session.add_all([actor, target])
    await db_session.flush()
    await ensure_rbac_seed(db_session)
    await set_admin_user_roles(db_session, user_id=actor.id, role_keys=["super_admin"])

    result = await cancel_admin_deletion_schedule(
        db_session,
        user=target,
        admin=actor,
        ip="127.0.0.1",
    )

    assert result["status"] == UserStatus.active.value
    assert target.status == UserStatus.active
    assert target.deletion_requested_at is None
    assert target.deletion_scheduled_at is None


@pytest.mark.asyncio
async def test_remove_admin_account_requires_suspended_status(
    db_session: AsyncSession,
) -> None:
    actor = User(
        email=f"super-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    target = User(
        email=f"admin-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add_all([actor, target])
    await db_session.flush()
    await ensure_rbac_seed(db_session)
    await set_admin_user_roles(db_session, user_id=actor.id, role_keys=["super_admin"])

    from app.application.admin.user_admin_service import remove_admin_account

    with pytest.raises(ValueError, match="Suspend the admin account"):
        await remove_admin_account(db_session, user=target, admin=actor)


@pytest.mark.asyncio
async def test_remove_admin_account_records_success_and_purges_access(
    db_session: AsyncSession,
) -> None:
    from sqlalchemy import select

    from app.application.admin.user_admin_service import hold_admin_account_access, remove_admin_account
    from app.infrastructure.persistence.distributor_branch_models import DistributorBranch
    from app.infrastructure.persistence.models import AuditEventType, AuditLog

    actor = User(
        email=f"super-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    target = User(
        email=f"admin-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add_all([actor, target])
    await db_session.flush()
    await ensure_rbac_seed(db_session)
    await set_admin_user_roles(db_session, user_id=actor.id, role_keys=["super_admin"])
    await set_admin_user_roles(db_session, user_id=target.id, role_keys=["mitra_manager"])

    original_email = target.email
    await hold_admin_account_access(db_session, user=target, admin=actor, ip="127.0.0.1")

    branch = DistributorBranch(
        id="mp001-test",
        branch_code="MP001",
        name="Indore",
        city="Indore",
        state_code="MP",
        state_name="Madhya Pradesh",
        manager_user_id=target.id,
    )
    db_session.add(branch)
    await db_session.flush()

    result = await remove_admin_account(
        db_session,
        user=target,
        admin=actor,
        ip="127.0.0.1",
    )

    assert result["status"] == UserStatus.deleted.value
    assert target.status == UserStatus.deleted
    assert target.deleted_at is not None
    assert target.email != original_email

    audit_result = await db_session.execute(
        select(AuditLog).where(
            AuditLog.user_id == target.id,
            AuditLog.event_type == AuditEventType.admin_account_removed,
        )
    )
    audit = audit_result.scalar_one()
    assert audit.metadata_["outcome"] == "removed_successfully"
    assert audit.metadata_["original_email"] == original_email
    await db_session.refresh(branch)
    assert branch.manager_user_id is None
