from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.dev_support_seed_service import (
    DEV_SUPPORT_AGENT_EMAIL,
    DEV_SUPPORT_PASSWORD,
    ensure_dev_support_seed,
)
from app.application.admin.rbac_service import list_user_role_keys
from app.application.auth.login_service import login_with_email
from app.infrastructure.persistence.models import User
from sqlalchemy import select


@pytest.mark.asyncio
async def test_dev_support_seed_creates_support_agent(db_session: AsyncSession) -> None:
    result = await ensure_dev_support_seed(db_session, force=True)
    assert result["skipped"] is False

    user_result = await db_session.execute(select(User).where(User.email == DEV_SUPPORT_AGENT_EMAIL))
    user = user_result.scalar_one()
    role_keys = await list_user_role_keys(db_session, user.id)
    assert "support_agent" in role_keys

    login = await login_with_email(
        db_session,
        email=DEV_SUPPORT_AGENT_EMAIL,
        password=DEV_SUPPORT_PASSWORD,
        turnstile_token=None,
        device_fingerprint="support-console",
        user_agent="pytest",
        ip="127.0.0.1",
        auth_client="support",
    )
    assert login["next"] == "authenticated"
