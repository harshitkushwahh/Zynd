from __future__ import annotations

from uuid import uuid4

import pyotp
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.admin_invitation_service import (
    admin_invite_onboarding_mfa_confirm,
    admin_invite_onboarding_mfa_start,
    complete_admin_invite_onboarding,
    create_admin_invitation,
    list_admin_invitations,
    start_admin_invite_onboarding,
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


async def _complete_invite_onboarding(
    db_session: AsyncSession,
    *,
    invite_token: str,
    onboarding_token: str,
    mfa_secret: str,
    enroll_token: str,
    device_fingerprint: str = "distributor-console",
) -> User:
    totp = pyotp.TOTP(mfa_secret)
    await admin_invite_onboarding_mfa_confirm(
        db_session,
        onboarding_token=onboarding_token,
        enroll_token=enroll_token,
        totp_code=totp.now(),
    )
    result = await complete_admin_invite_onboarding(
        db_session,
        onboarding_token=onboarding_token,
        pin="2468",
        confirm_pin="2468",
        totp_code=totp.now(),
        device_fingerprint=device_fingerprint,
        user_agent="pytest",
        ip="127.0.0.1",
    )
    assert result["next"] == "authenticated"
    return result["user"]


@pytest.mark.asyncio
async def test_mitra_manager_invite_email_uses_distributor_url(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, str] = {}

    async def _capture_email(**kwargs):  # noqa: ANN003
        captured["body"] = kwargs.get("body", "")
        captured["subject"] = kwargs.get("subject", "")
        return None

    monkeypatch.setattr(
        "app.application.admin.admin_invitation_service.send_security_email",
        _capture_email,
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

    await create_admin_invitation(
        db_session,
        actor=actor,
        email=f"manager-{uuid4()}@example.com",
        role_key="mitra_manager",
        first_name="Branch",
        last_name="Manager",
        ip="127.0.0.1",
    )

    assert "Zynd Mitra console" in captured["subject"]
    assert "localhost:9900/accept-invite" in captured["body"]


@pytest.mark.asyncio
async def test_create_and_complete_admin_invitation_onboarding(
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
        role_key="mitra_manager",
        first_name="Taylor",
        last_name="Ops",
        ip="127.0.0.1",
    )
    assert invitation["status"] == AdminInvitationStatus.pending.value

    invite_token = await create_admin_invite_token(str(invitation["id"]))
    preview = await validate_admin_invite_token(db_session, token=invite_token)
    assert preview["email"] == invitation["email"]
    assert preview["target_console"] == "distributor"

    onboarding = await start_admin_invite_onboarding(
        db_session,
        token=invite_token,
        first_name="Taylor",
        last_name="Ops",
        password="StrongPass123!",
    )
    assert onboarding["next"] == "onboarding"
    assert onboarding["onboarding_token"]

    users_before = await db_session.execute(
        select(User).where(User.email == invitation["email"])
    )
    assert users_before.scalar_one_or_none() is None

    mfa_start = await admin_invite_onboarding_mfa_start(
        db_session,
        onboarding_token=onboarding["onboarding_token"],
    )
    user = await _complete_invite_onboarding(
        db_session,
        invite_token=invite_token,
        onboarding_token=onboarding["onboarding_token"],
        mfa_secret=mfa_start["manual_secret"],
        enroll_token=mfa_start["enroll_token"],
    )
    assert user.role == UserRole.admin
    assert user.mfa_enrolled_at is not None
    assert user.pin_hash is not None

    role_keys = await list_user_role_keys(db_session, user.id)
    assert role_keys == ["mitra_manager"]

    items = await list_admin_invitations(db_session)
    accepted = next(item for item in items if item["id"] == invitation["id"])
    assert accepted["status"] == AdminInvitationStatus.accepted.value


@pytest.mark.asyncio
async def test_start_onboarding_does_not_consume_invite_token(
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
        role_key="mitra_manager",
        ip="127.0.0.1",
    )
    invite_token = await create_admin_invite_token(str(invitation["id"]))

    await start_admin_invite_onboarding(
        db_session,
        token=invite_token,
        first_name="Taylor",
        last_name=None,
        password="StrongPass123!",
    )

    preview = await validate_admin_invite_token(db_session, token=invite_token)
    assert preview["email"] == invitation["email"]

    items = await list_admin_invitations(db_session)
    pending = next(item for item in items if item["id"] == invitation["id"])
    assert pending["status"] == AdminInvitationStatus.pending.value


@pytest.mark.asyncio
async def test_complete_admin_invitation_rejects_used_token(
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
        role_key="mitra_manager",
        ip="127.0.0.1",
    )
    invite_token = await create_admin_invite_token(str(invitation["id"]))
    onboarding = await start_admin_invite_onboarding(
        db_session,
        token=invite_token,
        first_name="Taylor",
        last_name=None,
        password="StrongPass123!",
    )
    mfa_start = await admin_invite_onboarding_mfa_start(
        db_session,
        onboarding_token=onboarding["onboarding_token"],
    )
    await _complete_invite_onboarding(
        db_session,
        invite_token=invite_token,
        onboarding_token=onboarding["onboarding_token"],
        mfa_secret=mfa_start["manual_secret"],
        enroll_token=mfa_start["enroll_token"],
    )

    with pytest.raises(AuthError) as exc:
        await validate_admin_invite_token(db_session, token=invite_token)
    assert exc.value.code in {"invalid_invite_token", "invite_already_used"}


@pytest.mark.asyncio
async def test_start_admin_invite_onboarding_rejects_weak_password(
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
        role_key="mitra_manager",
        ip="127.0.0.1",
    )
    invite_token = await create_admin_invite_token(str(invitation["id"]))

    with pytest.raises(AuthError) as exc:
        await start_admin_invite_onboarding(
            db_session,
            token=invite_token,
            first_name="Taylor",
            last_name=None,
            password="weakpass",
        )
    assert exc.value.code == "invalid_password"
