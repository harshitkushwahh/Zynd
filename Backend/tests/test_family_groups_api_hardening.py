from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.infrastructure.persistence.models import Session, User, UserRole, UserStatus
from app.infrastructure.security.passwords import hash_password
from app.infrastructure.security.tokens import create_access_token
from app.main import app


async def _auth_headers(db_session) -> dict[str, str]:
    user = User(
        email=f"family-api-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    session = Session(
        user_id=user.id,
        refresh_token_hash="x" * 64,
        token_family_id=user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
    db_session.add(session)
    await db_session.commit()

    token = create_access_token(user_id=user.id, role=user.role.value, session_id=session.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_family_group_badges_requires_auth(db_session) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        unauthenticated = await client.get("/api/v1/family-groups/badges")
        assert unauthenticated.status_code == 401

        headers = await _auth_headers(db_session)
        authenticated = await client.get("/api/v1/family-groups/badges", headers=headers)

    assert authenticated.status_code == 200, authenticated.text
    body = authenticated.json()
    assert len(body["items"]) >= 1
