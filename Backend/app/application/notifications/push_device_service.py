from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.shared.datetime_utils import utcnow
from app.infrastructure.persistence.notification_models import PushPlatform, UserPushDevice


async def list_active_push_devices(db: AsyncSession, user_id: UUID) -> list[UserPushDevice]:
    result = await db.execute(
        select(UserPushDevice).where(
            UserPushDevice.user_id == user_id,
            UserPushDevice.revoked_at.is_(None),
        )
    )
    return list(result.scalars())


async def list_user_push_devices(db: AsyncSession, user_id: UUID) -> list[UserPushDevice]:
    result = await db.execute(
        select(UserPushDevice)
        .where(UserPushDevice.user_id == user_id)
        .order_by(UserPushDevice.updated_at.desc())
    )
    return list(result.scalars())


async def register_push_device(
    db: AsyncSession,
    *,
    user_id: UUID,
    platform: PushPlatform,
    fcm_token: str,
    device_label: str | None = None,
    app_version: str | None = None,
) -> UserPushDevice:
    token = fcm_token.strip()
    now = utcnow()

    result = await db.execute(select(UserPushDevice).where(UserPushDevice.fcm_token == token))
    existing = result.scalar_one_or_none()

    if existing is not None:
        existing.user_id = user_id
        existing.platform = platform
        existing.device_label = device_label
        existing.app_version = app_version
        existing.last_seen_at = now
        existing.revoked_at = None
        existing.updated_at = now
        await db.flush()
        return existing

    device = UserPushDevice(
        user_id=user_id,
        platform=platform,
        fcm_token=token,
        device_label=device_label,
        app_version=app_version,
        last_seen_at=now,
    )
    db.add(device)
    await db.flush()
    return device


async def revoke_push_device(
    db: AsyncSession,
    *,
    user_id: UUID,
    device_id: UUID,
) -> bool:
    result = await db.execute(
        select(UserPushDevice).where(
            UserPushDevice.id == device_id,
            UserPushDevice.user_id == user_id,
            UserPushDevice.revoked_at.is_(None),
        )
    )
    device = result.scalar_one_or_none()
    if device is None:
        return False

    now = utcnow()
    device.revoked_at = now
    device.updated_at = now
    await db.flush()
    return True


async def revoke_push_devices_by_tokens(
    db: AsyncSession,
    *,
    tokens: list[str],
) -> int:
    if not tokens:
        return 0

    now = utcnow()
    result = await db.execute(
        select(UserPushDevice).where(
            UserPushDevice.fcm_token.in_(tokens),
            UserPushDevice.revoked_at.is_(None),
        )
    )
    devices = list(result.scalars())
    for device in devices:
        device.revoked_at = now
        device.updated_at = now
    if devices:
        await db.flush()
    return len(devices)
