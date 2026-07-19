from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.admin_invitation_service import (
    accept_admin_invitation,
    create_admin_invitation,
    list_admin_invitations,
    validate_admin_invite_token,
)
from app.application.admin.rbac_service import ensure_rbac_seed, list_user_role_keys
from app.application.auth.errors import AuthError
from app.infrastructure.persistence.admin_invite_token_store import create_admin_invite_token
from app.infrastructure.persistence.models import (
    AdminInvitationStatus,
    User,
    UserRole,
    UserStatus,
)


@pytest.mark.asyncio
async def test_create_and_accept_admin_invitation(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _noop_email(**kwargs):  # noqa: ANN003
        return None

    monkeypatch.setattr(
        "app.application.admin.admin_invitation_service.send_security_email",
        _noop_email,
    )
    actor = User(
        email=f"actor-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(actor)
    await db_session.flush()
    await ensure_rbac_seed(db_session)

    invitation = await create_admin_invitation(
        db_session,
        actor=actor,
        email=f"invite-{uuid4()}@example.com",
        role_key="support_agent",
        first_name="Taylor",
        last_name="Ops",
        ip="127.0.0.1",
    )
    assert invitation["status"] == AdminInvitationStatus.pending.value
    assert invitation["role_name"] == "Support Agent"

    token = await create_admin_invite_token(str(invitation["id"]))
    preview = await validate_admin_invite_token(db_session, token=token)
    assert preview["email"] == invitation["email"]
    assert preview["role_key"] == "support_agent"

    result = await accept_admin_invitation(
        db_session,
        token=token,
        first_name="Taylor",
        last_name="Ops",
        password="StrongPass123!",
        device_fingerprint="admin-console",
        user_agent="pytest",
        ip="127.0.0.1",
    )
    assert result["next"] == "authenticated"
    assert result["user"].role == UserRole.admin

    role_keys = await list_user_role_keys(db_session, result["user"].id)
    assert role_keys == ["support_agent"]

    items = await list_admin_invitations(db_session)
    accepted = next(item for item in items if item["id"] == invitation["id"])
    assert accepted["status"] == AdminInvitationStatus.accepted.value


@pytest.mark.asyncio
async def test_accept_admin_invitation_rejects_used_token(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _noop_email(**kwargs):  # noqa: ANN003
        return None

    monkeypatch.setattr(
        "app.application.admin.admin_invitation_service.send_security_email",
        _noop_email,
    )
    actor = User(
        email=f"actor-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(actor)
    await db_session.flush()
    await ensure_rbac_seed(db_session)

    invitation = await create_admin_invitation(
        db_session,
        actor=actor,
        email=f"invite-{uuid4()}@example.com",
        role_key="support_agent",
        ip="127.0.0.1",
    )
    token = await create_admin_invite_token(str(invitation["id"]))

    await accept_admin_invitation(
        db_session,
        token=token,
        first_name="Taylor",
        last_name=None,
        password="StrongPass123!",
        device_fingerprint="admin-console",
        user_agent="pytest",
        ip="127.0.0.1",
    )

    items = await list_admin_invitations(db_session)
    accepted = next(item for item in items if item["id"] == invitation["id"])
    assert accepted["status"] == AdminInvitationStatus.accepted.value

    with pytest.raises(AuthError) as exc:
        await validate_admin_invite_token(db_session, token=token)
    assert exc.value.code in {"invalid_invite_token", "invite_already_used"}
