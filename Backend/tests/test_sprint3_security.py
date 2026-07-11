from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.account_service import mfa_enroll_confirm
from app.application.auth.mfa_service import generate_totp_secret
from app.application.auth.session_service import get_active_sessions
from app.core.config import Settings
from app.infrastructure.persistence.models import Device, Session, User, UserRole, UserStatus
from app.infrastructure.security.pending_auth import store_pending_auth
from app.infrastructure.security.tokens import hash_token
import pyotp


def _now() -> datetime:
    return datetime.now(timezone.utc)


@pytest.mark.asyncio
async def test_mfa_enroll_confirm_revokes_other_sessions(db_session: AsyncSession) -> None:
    user = User(
        email=f"mfa-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    device = Device(
        user_id=user.id,
        fingerprint_hash=f"fp-{uuid4()}",
        os="macOS",
        browser="Safari",
    )
    db_session.add(device)
    await db_session.flush()

    current_session = Session(
        user_id=user.id,
        device_id=device.id,
        refresh_token_hash=hash_token("current"),
        expires_at=_now() + timedelta(days=30),
    )
    other_session = Session(
        user_id=user.id,
        device_id=device.id,
        refresh_token_hash=hash_token("other"),
        expires_at=_now() + timedelta(days=30),
    )
    db_session.add_all([current_session, other_session])
    await db_session.flush()

    secret = generate_totp_secret()
    enroll_token = f"enroll-{uuid4()}"
    settings = Settings()
    await store_pending_auth(
        "mfa_enroll",
        enroll_token,
        {"user_id": str(user.id), "secret": secret},
        settings.mfa_pending_ttl_seconds,
    )

    totp_code = pyotp.TOTP(secret).now()
    await mfa_enroll_confirm(
        db_session,
        user=user,
        enroll_token=enroll_token,
        totp_code=totp_code,
        ip="127.0.0.1",
        session_id=current_session.id,
    )
    await db_session.flush()

    active = await get_active_sessions(db_session, user.id)
    assert len(active) == 1
    assert active[0].id == current_session.id
    assert other_session.revoked_at is not None
