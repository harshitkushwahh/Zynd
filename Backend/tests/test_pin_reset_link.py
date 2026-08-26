from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.errors import AuthError
from app.application.auth.pin_service import (
    reset_pin_with_link,
    send_pin_reset_link,
    validate_pin_reset_link,
)
from app.infrastructure.persistence.models import User, UserRole, UserStatus


def _user(**kwargs) -> User:
    now = datetime.now(timezone.utc)
    user = User(
        email="mitra@example.com",
        role=UserRole.admin,
        status=UserStatus.active,
        country_code="IN",
        email_verified_at=now,
        phone_verified_at=now,
        phone="9876543210",
        password_hash="hashed",
        pin_hash="pin-hash",
        mfa_enrolled_at=now,
    )
    for key, value in kwargs.items():
        setattr(user, key, value)
    return user


@pytest.mark.asyncio
async def test_send_pin_reset_link_emails_distributor_url(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _user()
    db_session.add(user)
    await db_session.flush()

    sent: dict[str, str] = {}

    async def fake_send_security_email(*, to_email: str, subject: str, body: str) -> None:
        sent["to_email"] = to_email
        sent["subject"] = subject
        sent["body"] = body

    monkeypatch.setattr(
        "app.application.auth.pin_service.send_security_email",
        fake_send_security_email,
    )
    monkeypatch.setattr(
        "app.application.auth.pin_service.create_pin_reset_token",
        AsyncMock(return_value="test-pin-reset-token"),
    )
    monkeypatch.setattr("app.application.auth.pin_service.check_rate_limit", AsyncMock(return_value=True))
    monkeypatch.setattr("app.application.auth.pin_service.smtp_configured", lambda: True)

    result = await send_pin_reset_link(db_session, user=user, ip="127.0.0.1")

    assert result["ok"] is True
    assert result["masked_email"].endswith("@example.com")
    assert result["email_delivered"] is True
    assert "dev_reset_url" not in result
    assert "http://localhost:9900/reset-pin?token=test-pin-reset-token" in sent["body"]


@pytest.mark.asyncio
async def test_send_pin_reset_link_allows_setup_when_pin_missing(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _user(pin_hash=None)
    db_session.add(user)
    await db_session.flush()

    sent: dict[str, str] = {}

    async def fake_send_security_email(*, to_email: str, subject: str, body: str) -> None:
        sent["subject"] = subject

    monkeypatch.setattr(
        "app.application.auth.pin_service.send_security_email",
        fake_send_security_email,
    )
    monkeypatch.setattr(
        "app.application.auth.pin_service.create_pin_reset_token",
        AsyncMock(return_value="setup-token"),
    )
    monkeypatch.setattr("app.application.auth.pin_service.check_rate_limit", AsyncMock(return_value=True))
    monkeypatch.setattr("app.application.auth.pin_service.smtp_configured", lambda: False)
    monkeypatch.setattr(
        "app.application.auth.pin_service.get_settings",
        lambda: type("S", (), {"debug": True, "distributor_frontend_url": "http://localhost:9900"})(),
    )

    result = await send_pin_reset_link(db_session, user=user, ip="127.0.0.1")

    assert result["ok"] is True
    assert result["email_delivered"] is False
    assert result["dev_reset_url"] == "http://localhost:9900/reset-pin?token=setup-token"
    assert sent["subject"] == "Set your Zynd Mitra console PIN"


@pytest.mark.asyncio
async def test_send_pin_reset_link_omits_dev_url_when_smtp_configured(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _user()
    db_session.add(user)
    await db_session.flush()

    monkeypatch.setattr(
        "app.application.auth.pin_service.send_security_email",
        AsyncMock(),
    )
    monkeypatch.setattr(
        "app.application.auth.pin_service.create_pin_reset_token",
        AsyncMock(return_value="prod-token"),
    )
    monkeypatch.setattr("app.application.auth.pin_service.check_rate_limit", AsyncMock(return_value=True))
    monkeypatch.setattr("app.application.auth.pin_service.smtp_configured", lambda: True)
    monkeypatch.setattr(
        "app.application.auth.pin_service.get_settings",
        lambda: type("S", (), {"debug": True, "distributor_frontend_url": "http://localhost:9900"})(),
    )

    result = await send_pin_reset_link(db_session, user=user, ip="127.0.0.1")

    assert result["email_delivered"] is True
    assert "dev_reset_url" not in result


@pytest.mark.asyncio
async def test_get_pin_unlock_status_reports_redis_ttl(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from uuid import uuid4

    from app.application.auth.pin_service import get_pin_unlock_status

    user_id = uuid4()
    session_id = uuid4()

    class FakeRedis:
        def __init__(self) -> None:
            self.ttl_value = -2

        async def ttl(self, key: str) -> int:  # noqa: ARG002
            return self.ttl_value

    fake_redis = FakeRedis()
    monkeypatch.setattr(
        "app.application.auth.pin_service.get_redis",
        AsyncMock(return_value=fake_redis),
    )

    locked = await get_pin_unlock_status(user_id, session_id)
    assert locked == {"unlocked": False, "expires_in": 0}

    fake_redis.ttl_value = 1800
    unlocked = await get_pin_unlock_status(user_id, session_id)
    assert unlocked == {"unlocked": True, "expires_in": 1800}


@pytest.mark.asyncio
async def test_validate_pin_reset_link_rejects_missing_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.application.auth.pin_service.peek_pin_reset_token",
        AsyncMock(return_value=None),
    )

    with pytest.raises(AuthError) as exc:
        await validate_pin_reset_link("missing-token")

    assert exc.value.code == "invalid_pin_reset_token"


@pytest.mark.asyncio
async def test_reset_pin_with_link_requires_valid_step_up(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = _user()
    db_session.add(user)
    await db_session.flush()

    monkeypatch.setattr(
        "app.application.auth.pin_service.consume_pin_reset_token",
        AsyncMock(return_value=str(user.id)),
    )

    async def fake_get_user_by_id(db: AsyncSession, user_id):  # noqa: ANN001
        return user

    monkeypatch.setattr(
        "app.application.auth.user_service.get_user_by_id",
        fake_get_user_by_id,
    )
    monkeypatch.setattr(
        "app.application.auth.pin_service._verify_step_up_for_pin_setup",
        AsyncMock(side_effect=AuthError("Invalid password.", "invalid_credentials", 401)),
    )

    with pytest.raises(AuthError) as exc:
        await reset_pin_with_link(
            db_session,
            token="token",
            current_password="wrong-password",
            totp_code="123456",
            pin="5678",
            confirm_pin="5678",
            ip="127.0.0.1",
        )

    assert exc.value.code == "invalid_credentials"
