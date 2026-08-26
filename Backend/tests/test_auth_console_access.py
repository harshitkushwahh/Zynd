from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.rbac_service import (
    DISTRIBUTOR_MANAGER_ROLE_KEY,
    ensure_rbac_seed,
    set_admin_user_roles,
)
from app.application.auth.errors import AuthError
from app.application.auth.login_service import login_with_email
from app.infrastructure.persistence.models import User, UserRole, UserStatus
from app.infrastructure.security.passwords import hash_password


@pytest.mark.asyncio
async def test_mitra_manager_cannot_login_to_admin_client(db_session: AsyncSession) -> None:
    await ensure_rbac_seed(db_session)
    now = datetime.now(timezone.utc)
    user = User(
        email=f"manager-{uuid4()}@example.com",
        password_hash=hash_password("StrongPass123!"),
        first_name="Branch",
        last_name="Manager",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    db_session.add(user)
    await db_session.flush()
    await set_admin_user_roles(
        db_session,
        user_id=user.id,
        role_keys=[DISTRIBUTOR_MANAGER_ROLE_KEY],
    )

    with pytest.raises(AuthError) as exc:
        await login_with_email(
            db_session,
            email=user.email,
            password="StrongPass123!",
            turnstile_token=None,
            device_fingerprint="admin-console",
            user_agent="pytest",
            ip="127.0.0.1",
            auth_client="admin",
        )

    assert exc.value.code == "distributor_console_required"


@pytest.mark.asyncio
async def test_mitra_manager_can_login_to_distributor_client(db_session: AsyncSession) -> None:
    await ensure_rbac_seed(db_session)
    now = datetime.now(timezone.utc)
    user = User(
        email=f"manager-{uuid4()}@example.com",
        password_hash=hash_password("StrongPass123!"),
        first_name="Branch",
        last_name="Manager",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified_at=now,
    )
    db_session.add(user)
    await db_session.flush()
    await set_admin_user_roles(
        db_session,
        user_id=user.id,
        role_keys=[DISTRIBUTOR_MANAGER_ROLE_KEY],
    )

    result = await login_with_email(
        db_session,
        email=user.email,
        password="StrongPass123!",
        turnstile_token=None,
        device_fingerprint="distributor-console",
        user_agent="pytest",
        ip="127.0.0.1",
        auth_client="distributor",
    )

    assert result["next"] == "authenticated"
