from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.mfa_service import confirm_mfa_enrollment, generate_totp_secret
from app.application.auth.oauth_state_service import consume_oauth_state, create_oauth_state
from app.application.auth.service import AuthError, refresh_session, reset_password
from app.application.compliance.retention_service import ensure_retention_seed
from app.infrastructure.persistence.models import Session, User, UserRole, UserStatus
from app.infrastructure.security.passwords import hash_password
from app.infrastructure.security.tokens import generate_refresh_token, hash_token


def _now():
    from datetime import datetime, timezone

    return datetime.now(timezone.utc)


@pytest.mark.asyncio
async def test_refresh_token_reuse_revokes_family(db_session: AsyncSession) -> None:
    user = User(
        email=f"reuse-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    family_id = uuid4()
    old_refresh = generate_refresh_token()
    old_session = Session(
        user_id=user.id,
        refresh_token_hash=hash_token(old_refresh),
        token_family_id=family_id,
        expires_at=_now() + timedelta(days=30),
        revoked_at=_now(),
    )
    sibling_refresh = generate_refresh_token()
    sibling_session = Session(
        user_id=user.id,
        refresh_token_hash=hash_token(sibling_refresh),
        token_family_id=family_id,
        expires_at=_now() + timedelta(days=30),
    )
    db_session.add_all([old_session, sibling_session])
    await db_session.flush()

    with pytest.raises(AuthError) as exc:
        await refresh_session(db_session, refresh_token=old_refresh, ip="127.0.0.1")
    assert exc.value.code == "session_compromised"
    await db_session.flush()

    refreshed = await db_session.execute(select(Session).where(Session.id == sibling_session.id))
    assert refreshed.scalar_one().revoked_at is not None


@pytest.mark.asyncio
async def test_reset_password_requires_mfa_when_enrolled(db_session: AsyncSession) -> None:
    await ensure_retention_seed(db_session)
    user = User(
        email=f"reset-mfa-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
        mfa_enrolled_at=_now(),
    )
    db_session.add(user)
    await db_session.flush()

    secret = generate_totp_secret()
    import pyotp

    await confirm_mfa_enrollment(
        db_session,
        user=user,
        secret=secret,
        totp_code=pyotp.TOTP(secret).now(),
    )

    from app.infrastructure.otp.service import create_reset_token

    token = await create_reset_token(str(user.id))

    with pytest.raises(AuthError) as exc:
        await reset_password(
            db_session,
            token=token,
            new_password="NewPassword1!",
            ip="127.0.0.1",
        )
    assert exc.value.code == "mfa_required_for_reset"


@pytest.mark.asyncio
async def test_oauth_state_is_single_use(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = db_session
    store: dict[str, str] = {}

    class FakeRedis:
        async def setex(self, key: str, _ttl: int, value: str) -> None:
            store[key] = value

        async def get(self, key: str) -> str | None:
            return store.get(key)

        async def delete(self, key: str) -> None:
            store.pop(key, None)

    async def fake_get_redis(_db: int) -> FakeRedis:
        return FakeRedis()

    monkeypatch.setattr(
        "app.application.auth.oauth_service.get_redis",
        fake_get_redis,
    )

    state = await create_oauth_state("google_login")
    assert await consume_oauth_state(state, "google_login") is True
    assert await consume_oauth_state(state, "google_login") is False
