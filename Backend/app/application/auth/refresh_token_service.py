from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.messaging.auth_events import schedule_refresh_reuse_detected
from app.infrastructure.persistence.models import AuditEventType, AuditLog, Session, User


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def handle_refresh_token_reuse(
    db: AsyncSession,
    *,
    user_id: UUID,
    family_id: UUID,
    ip: str | None,
    reused_session_id: UUID | None = None,
) -> int:
    """Revoke all sessions in the compromised token family and alert the user."""
    result = await db.execute(
        select(Session).where(
            Session.user_id == user_id,
            Session.token_family_id == family_id,
            Session.revoked_at.is_(None),
            Session.expires_at > _now(),
        )
    )
    active_sessions = list(result.scalars())
    revoked = 0
    for session in active_sessions:
        session.revoked_at = _now()
        revoked += 1
        db.add(
            AuditLog(
                user_id=user_id,
                event_type=AuditEventType.session_revoked,
                ip_address=ip,
                metadata_={
                    "session_id": str(session.id),
                    "reason": "refresh_token_reuse",
                    "family_id": str(family_id),
                },
            )
        )

    db.add(
        AuditLog(
            user_id=user_id,
            event_type=AuditEventType.refresh_token_reuse_detected,
            ip_address=ip,
            metadata_={
                "family_id": str(family_id),
                "reused_session_id": str(reused_session_id) if reused_session_id else None,
                "revoked_count": revoked,
            },
        )
    )

    if revoked:
        db.add(
            AuditLog(
                user_id=user_id,
                event_type=AuditEventType.sessions_revoked_all,
                ip_address=ip,
                metadata_={"count": revoked, "reason": "refresh_token_reuse"},
            )
        )

    user = await db.get(User, user_id)
    if user and user.email and not user.email.startswith("deleted+"):
        schedule_refresh_reuse_detected(user_id=user_id, email=user.email)

    await db.flush()
    return revoked
