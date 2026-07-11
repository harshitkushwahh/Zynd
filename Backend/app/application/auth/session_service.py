from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.audit_service import write_session_revoked, write_sessions_revoked_all
from app.application.notifications.notification_service import schedule_user_notification
from app.application.notifications.types import NotificationType
from app.core.config import Settings, get_settings
from app.infrastructure.persistence.models import Session, User


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def get_active_sessions(db: AsyncSession, user_id: UUID) -> list[Session]:
    result = await db.execute(
        select(Session)
        .where(
            Session.user_id == user_id,
            Session.revoked_at.is_(None),
            Session.expires_at > _now(),
        )
        .order_by(Session.last_used_at.asc())
    )
    return list(result.scalars())


async def enforce_session_cap(
    db: AsyncSession,
    *,
    user_id: UUID,
    settings: Settings | None = None,
    ip: str | None = None,
    exclude_session_id: UUID | None = None,
) -> None:
    settings = settings or get_settings()
    active = await get_active_sessions(db, user_id)
    if exclude_session_id:
        active = [session for session in active if session.id != exclude_session_id]

    overflow = len(active) - settings.max_concurrent_sessions + 1
    if overflow <= 0:
        return

    for session in active[:overflow]:
        session.revoked_at = _now()
        await write_session_revoked(
            db,
            user_id=user_id,
            session_id=session.id,
            reason="cap_exceeded",
            ip=ip,
        )


async def revoke_all_sessions(
    db: AsyncSession,
    *,
    user_id: UUID,
    ip: str | None = None,
    except_session_id: UUID | None = None,
    reason: str = "security_event",
) -> int:
    active = await get_active_sessions(db, user_id)
    revoked = 0
    for session in active:
        if except_session_id and session.id == except_session_id:
            continue
        session.revoked_at = _now()
        revoked += 1
        await write_session_revoked(
            db,
            user_id=user_id,
            session_id=session.id,
            reason=reason,
            ip=ip,
        )

    if revoked:
        await write_sessions_revoked_all(
            db,
            user_id=user_id,
            count=revoked,
            reason=reason,
            ip=ip,
        )
    return revoked


async def list_user_sessions(
    db: AsyncSession,
    *,
    user_id: UUID,
    current_session_id: UUID | None = None,
) -> list[dict]:
    from sqlalchemy.orm import selectinload

    from app.infrastructure.persistence.models import Device

    result = await db.execute(
        select(Session)
        .where(
            Session.user_id == user_id,
            Session.revoked_at.is_(None),
            Session.expires_at > _now(),
        )
        .options(selectinload(Session.device))
        .order_by(Session.last_used_at.desc())
    )
    sessions = list(result.scalars())
    items: list[dict] = []
    for session in sessions:
        device: Device | None = session.device
        items.append(
            {
                "id": session.id,
                "is_current": session.id == current_session_id,
                "os": device.os if device else None,
                "browser": device.browser if device else None,
                "last_used_at": session.last_used_at,
                "created_at": session.created_at,
            }
        )
    return items


async def revoke_user_session(
    db: AsyncSession,
    *,
    user_id: UUID,
    session_id: UUID,
    ip: str | None,
) -> bool:
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(Session)
        .where(
            Session.id == session_id,
            Session.user_id == user_id,
            Session.revoked_at.is_(None),
        )
        .options(selectinload(Session.device))
    )
    session = result.scalar_one_or_none()
    if not session:
        return False
    session.revoked_at = _now()
    await write_session_revoked(
        db,
        user_id=user_id,
        session_id=session.id,
        reason="user_revoked",
        ip=ip,
    )

    user = await db.get(User, user_id)
    if user:
        device = session.device
        device_label = "Unknown device"
        if device:
            parts = [part for part in (device.os, device.browser) if part]
            device_label = " · ".join(parts) if parts else "Unknown device"
        schedule_user_notification(
            user_id=user.id,
            user_email=user.email,
            notification_type=NotificationType.AUTH_DEVICE_REVOKED,
            title="Device signed out",
            body=(
                f"A device session was signed out of your ZYND account.\n\n"
                f"Device: {device_label}\n\n"
                "If you didn't do this, review your active sessions in Settings."
            ),
            metadata={"session_id": str(session.id), "device_label": device_label},
            idempotency_key=f"auth.device.revoked:{session.id}",
            email_subject="A device was signed out of your ZYND account",
        )
    return True
