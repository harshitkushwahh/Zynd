from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.infrastructure.persistence.models import Session, User, UserRole, UserStatus
from app.infrastructure.security.passwords import hash_password
from app.infrastructure.security.tokens import create_access_token
from app.main import app


@pytest.mark.asyncio
async def test_notification_preferences_route(db_session) -> None:
    user = User(
        email=f"prefs-api-{uuid4()}@example.com",
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

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/api/v1/notifications/preferences",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body["preferences"]) == 4
    categories = {item["category"] for item in body["preferences"]}
    assert categories == {"security", "kyc", "referral", "account"}
