from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.notifications.notification_service import get_notification, insert_in_app_notification
from app.infrastructure.persistence.models import User, UserRole, UserStatus
from app.infrastructure.persistence.notification_models import NotificationCategory
from app.infrastructure.security.passwords import hash_password


@pytest.mark.asyncio
async def test_get_notification_by_user(db_session: AsyncSession) -> None:
    user = User(
        email=f"notif-get-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    created = await insert_in_app_notification(
        db_session,
        user_id=user.id,
        category=NotificationCategory.security,
        notification_type="auth.login.succeeded",
        title="Signed in",
        body="New sign-in detected.",
    )
    assert created is not None
    await db_session.commit()

    row = await get_notification(db_session, user_id=user.id, notification_id=created.id)
    assert row is not None
    assert row.title == "Signed in"

    missing = await get_notification(db_session, user_id=user.id, notification_id=uuid4())
    assert missing is None
