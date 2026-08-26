from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.rbac_service import (
    DISTRIBUTOR_PARTNER_ROLE_KEY,
    assign_role_to_admin_user,
    ensure_rbac_seed,
)
from app.application.auth.token_lifecycle_service import forgot_password
from app.application.auth.errors import AuthError
from app.application.distributor.partner_access_service import resolve_password_reset_target
from app.infrastructure.persistence.password_reset_token_store import create_reset_token
from app.core.config import get_settings
from app.infrastructure.persistence.distributor_partner_models import (
    DistributorPartner,
    DistributorPartnerStatus,
)
from app.infrastructure.persistence.models import User, UserRole, UserStatus


@pytest.mark.asyncio
async def test_forgot_password_uses_distributor_url_for_mitra_user(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    await ensure_rbac_seed(db_session)
    settings = get_settings().model_copy(
        update={
            "frontend_url": "http://localhost:7777",
            "distributor_frontend_url": "http://localhost:9900",
        }
    )
    get_settings.cache_clear()

    user = User(
        email="mitra.reset@zynd.com",
        first_name="Harshit",
        last_name="Kushwah",
        role=UserRole.admin,
        status=UserStatus.active,
        password_hash=None,
    )
    db_session.add(user)
    await db_session.flush()
    await assign_role_to_admin_user(db_session, user_id=user.id, role_key=DISTRIBUTOR_PARTNER_ROLE_KEY)
    db_session.add(
        DistributorPartner(
            user_id=user.id,
            status=DistributorPartnerStatus.pending_password,
        )
    )
    await db_session.flush()

    sent: dict[str, str] = {}

    async def capture_email(*, to_email: str, subject: str, body: str) -> None:
        sent["to_email"] = to_email
        sent["subject"] = subject
        sent["body"] = body

    monkeypatch.setattr(
        "app.application.auth.token_lifecycle_service.verify_turnstile",
        AsyncMock(return_value=True),
    )
    monkeypatch.setattr(
        "app.application.auth.token_lifecycle_service.check_rate_limit",
        AsyncMock(return_value=True),
    )
    monkeypatch.setattr(
        "app.application.auth.token_lifecycle_service.send_security_email",
        capture_email,
    )
    monkeypatch.setattr(
        "app.application.auth.token_lifecycle_service.get_settings",
        lambda: settings,
    )

    await forgot_password(
        db_session,
        email=user.email,
        turnstile_token="token",
        ip="127.0.0.1",
        client="distributor",
        header_client="distributor",
    )

    assert sent["to_email"] == user.email
    assert "Set your Zynd Mitra console password" in sent["subject"]
    assert "http://localhost:9900/reset-password?token=" in sent["body"]
    assert "http://localhost:7777/reset-password" not in sent["body"]

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_forgot_password_rejects_while_ho_review_pending(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    await ensure_rbac_seed(db_session)

    user = User(
        email="mitra.pending@zynd.com",
        first_name="Pending",
        last_name="Mitra",
        role=UserRole.admin,
        status=UserStatus.active,
        password_hash=None,
    )
    db_session.add(user)
    await db_session.flush()
    await assign_role_to_admin_user(db_session, user_id=user.id, role_key=DISTRIBUTOR_PARTNER_ROLE_KEY)
    db_session.add(
        DistributorPartner(
            user_id=user.id,
            status=DistributorPartnerStatus.pending_ho_review,
        )
    )
    await db_session.flush()

    sent = False

    async def capture_email(**_: object) -> None:
        nonlocal sent
        sent = True

    monkeypatch.setattr(
        "app.application.auth.token_lifecycle_service.verify_turnstile",
        AsyncMock(return_value=True),
    )
    monkeypatch.setattr(
        "app.application.auth.token_lifecycle_service.check_rate_limit",
        AsyncMock(return_value=True),
    )
    monkeypatch.setattr(
        "app.application.auth.token_lifecycle_service.send_security_email",
        capture_email,
    )

    with pytest.raises(AuthError) as exc:
        await forgot_password(
            db_session,
            email=user.email,
            turnstile_token="token",
            ip="127.0.0.1",
            client="distributor",
        )

    assert exc.value.code == "distributor_partner_pending_review"
    assert sent is False


@pytest.mark.asyncio
async def test_forgot_password_resends_when_active_reset_link_exists(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    await ensure_rbac_seed(db_session)
    settings = get_settings().model_copy(
        update={
            "frontend_url": "http://localhost:7777",
            "distributor_frontend_url": "http://localhost:9900",
        }
    )
    get_settings.cache_clear()

    user = User(
        email="mitra.active-link@zynd.com",
        first_name="Active",
        last_name="Link",
        role=UserRole.admin,
        status=UserStatus.active,
        password_hash=None,
    )
    db_session.add(user)
    await db_session.flush()
    await assign_role_to_admin_user(db_session, user_id=user.id, role_key=DISTRIBUTOR_PARTNER_ROLE_KEY)
    db_session.add(
        DistributorPartner(
            user_id=user.id,
            status=DistributorPartnerStatus.pending_password,
        )
    )
    await db_session.flush()

    existing_token = await create_reset_token(str(user.id))

    sent: dict[str, str] = {}

    async def capture_email(*, to_email: str, subject: str, body: str) -> None:
        sent["to_email"] = to_email
        sent["subject"] = subject
        sent["body"] = body

    monkeypatch.setattr(
        "app.application.auth.token_lifecycle_service.verify_turnstile",
        AsyncMock(return_value=True),
    )
    monkeypatch.setattr(
        "app.application.auth.token_lifecycle_service.check_rate_limit",
        AsyncMock(return_value=True),
    )
    monkeypatch.setattr(
        "app.application.auth.token_lifecycle_service.send_security_email",
        capture_email,
    )
    monkeypatch.setattr(
        "app.application.auth.token_lifecycle_service.get_settings",
        lambda: settings,
    )

    await forgot_password(
        db_session,
        email=user.email,
        turnstile_token="token",
        ip="127.0.0.1",
        client="distributor",
        header_client="distributor",
    )

    assert sent["to_email"] == user.email
    assert f"http://localhost:9900/reset-password?token={existing_token}" in sent["body"]
    assert "Set your Zynd Mitra console password" in sent["subject"]

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_forgot_password_rejects_unknown_email_for_distributor_client(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sent = False

    async def capture_email(**_: object) -> None:
        nonlocal sent
        sent = True

    monkeypatch.setattr(
        "app.application.auth.token_lifecycle_service.verify_turnstile",
        AsyncMock(return_value=True),
    )
    monkeypatch.setattr(
        "app.application.auth.token_lifecycle_service.check_rate_limit",
        AsyncMock(return_value=True),
    )
    monkeypatch.setattr(
        "app.application.auth.token_lifecycle_service.send_security_email",
        capture_email,
    )

    with pytest.raises(AuthError) as exc:
        await forgot_password(
            db_session,
            email="unknown@zynd.com",
            turnstile_token="token",
            ip="127.0.0.1",
            client="distributor",
            header_client="distributor",
        )

    assert exc.value.code == "distributor_account_not_found"
    assert sent is False


@pytest.mark.asyncio
async def test_forgot_password_rejects_non_mitra_user_for_distributor_client(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = User(
        email="admin.only@zynd.com",
        first_name="Admin",
        last_name="Only",
        role=UserRole.admin,
        status=UserStatus.active,
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()

    sent = False

    async def capture_email(**_: object) -> None:
        nonlocal sent
        sent = True

    monkeypatch.setattr(
        "app.application.auth.token_lifecycle_service.verify_turnstile",
        AsyncMock(return_value=True),
    )
    monkeypatch.setattr(
        "app.application.auth.token_lifecycle_service.check_rate_limit",
        AsyncMock(return_value=True),
    )
    monkeypatch.setattr(
        "app.application.auth.token_lifecycle_service.send_security_email",
        capture_email,
    )

    with pytest.raises(AuthError) as exc:
        await forgot_password(
            db_session,
            email=user.email,
            turnstile_token="token",
            ip="127.0.0.1",
            client="distributor",
            header_client="distributor",
        )

    assert exc.value.code == "distributor_account_not_found"
    assert sent is False


@pytest.mark.asyncio
async def test_resolve_password_reset_target_uses_partner_record(
    db_session: AsyncSession,
) -> None:
    settings = get_settings().model_copy(
        update={
            "frontend_url": "http://localhost:7777",
            "distributor_frontend_url": "http://localhost:9900",
        }
    )
    user = User(
        email="partner.only@zynd.com",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()
    db_session.add(
        DistributorPartner(
            user_id=user.id,
            status=DistributorPartnerStatus.pending_ho_review,
        )
    )
    await db_session.flush()

    base, label = await resolve_password_reset_target(
        db_session,
        settings,
        user=user,
        client=None,
        origin=None,
    )

    assert base == "http://localhost:9900"
    assert label == "Zynd Mitra console"

    get_settings.cache_clear()
