from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.notifications.push_device_service import (
    list_active_push_devices,
    register_push_device,
    revoke_push_device,
)
from app.infrastructure.persistence.models import User, UserRole, UserStatus
from app.infrastructure.persistence.notification_models import PushPlatform, UserPushDevice
from app.infrastructure.security.passwords import hash_password


@pytest.mark.asyncio
async def test_register_push_device_creates_row(db_session: AsyncSession) -> None:
    user = User(
        email=f"push-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    device = await register_push_device(
        db_session,
        user_id=user.id,
        platform=PushPlatform.android,
        fcm_token="fcm-token-abc",
        device_label="Pixel 8",
        app_version="1.0.0",
    )
    await db_session.commit()

    assert device.id is not None
    assert device.user_id == user.id
    assert device.platform == PushPlatform.android
    assert device.revoked_at is None

    active = await list_active_push_devices(db_session, user.id)
    assert len(active) == 1


@pytest.mark.asyncio
async def test_register_push_device_upserts_existing_token(db_session: AsyncSession) -> None:
    user_a = User(
        email=f"push-a-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
    )
    user_b = User(
        email=f"push-b-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add_all([user_a, user_b])
    await db_session.flush()

    first = await register_push_device(
        db_session,
        user_id=user_a.id,
        platform=PushPlatform.ios,
        fcm_token="shared-token",
    )
    await db_session.commit()

    second = await register_push_device(
        db_session,
        user_id=user_b.id,
        platform=PushPlatform.android,
        fcm_token="shared-token",
        device_label="New phone",
    )
    await db_session.commit()

    assert second.id == first.id
    assert second.user_id == user_b.id
    assert second.platform == PushPlatform.android
    assert second.device_label == "New phone"

    result = await db_session.execute(
        select(UserPushDevice).where(UserPushDevice.fcm_token == "shared-token")
    )
    assert len(result.scalars().all()) == 1


@pytest.mark.asyncio
async def test_revoke_push_device(db_session: AsyncSession) -> None:
    user = User(
        email=f"push-revoke-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    device = await register_push_device(
        db_session,
        user_id=user.id,
        platform=PushPlatform.web,
        fcm_token="web-token",
    )
    await db_session.commit()

    revoked = await revoke_push_device(db_session, user_id=user.id, device_id=device.id)
    await db_session.commit()

    assert revoked is True
    active = await list_active_push_devices(db_session, user.id)
    assert active == []
