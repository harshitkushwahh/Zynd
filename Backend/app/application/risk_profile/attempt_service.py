from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.user_admin_service import _display_name
from app.application.documents.profile_image_url_service import resolve_profile_image_urls_by_user_id
from app.application.risk_profile.constants import RISK_PROFILE_DEFAULT_ATTEMPTS
from app.application.risk_profile.errors import RiskProfileError
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.risk_profile_models import UserRiskProfileAttemptState


def _attempts_remaining(state: UserRiskProfileAttemptState) -> int:
    return max(0, state.granted_attempts - state.completed_count)


def _is_locked(state: UserRiskProfileAttemptState) -> bool:
    return _attempts_remaining(state) <= 0


def serialize_attempt_state(state: UserRiskProfileAttemptState) -> dict[str, Any]:
    remaining = _attempts_remaining(state)
    return {
        "completed_count": state.completed_count,
        "granted_attempts": state.granted_attempts,
        "attempts_remaining": remaining,
        "is_locked": remaining <= 0,
        "locked_at": state.locked_at.isoformat() if state.locked_at else None,
        "updated_at": state.updated_at.isoformat() if state.updated_at else None,
    }


async def get_or_create_attempt_state(db: AsyncSession, user_id: UUID) -> UserRiskProfileAttemptState:
    result = await db.execute(
        select(UserRiskProfileAttemptState).where(UserRiskProfileAttemptState.user_id == user_id)
    )
    row = result.scalar_one_or_none()
    if row:
        return row

    row = UserRiskProfileAttemptState(
        user_id=user_id,
        completed_count=0,
        granted_attempts=RISK_PROFILE_DEFAULT_ATTEMPTS,
    )
    db.add(row)
    await db.flush()
    await db.refresh(row)
    return row


async def get_attempt_state(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    state = await get_or_create_attempt_state(db, user_id)
    return serialize_attempt_state(state)


async def ensure_can_take_assessment(db: AsyncSession, user_id: UUID) -> UserRiskProfileAttemptState:
    state = await get_or_create_attempt_state(db, user_id)
    if _is_locked(state):
        raise RiskProfileError(
            "risk_profile_locked",
            "You have used all available risk profile attempts. Contact an administrator to unlock more.",
            status_code=403,
        )
    return state


async def record_completed_attempt(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    state = await get_or_create_attempt_state(db, user_id)
    if _is_locked(state):
        raise RiskProfileError(
            "risk_profile_locked",
            "You have used all available risk profile attempts. Contact an administrator to unlock more.",
            status_code=403,
        )

    state.completed_count += 1
    if _is_locked(state):
        state.locked_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(state)
    return serialize_attempt_state(state)


async def grant_additional_attempts(
    db: AsyncSession,
    *,
    user_id: UUID,
    attempts: int,
) -> dict[str, Any]:
    if attempts < 1:
        raise RiskProfileError("invalid_attempt_grant", "At least one attempt must be granted.")

    state = await get_or_create_attempt_state(db, user_id)
    state.granted_attempts += attempts
    if _attempts_remaining(state) > 0:
        state.locked_at = None
    await db.flush()
    await db.refresh(state)
    return serialize_attempt_state(state)


async def list_locked_users(
    db: AsyncSession,
    *,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    query = (
        select(UserRiskProfileAttemptState, User)
        .join(User, User.id == UserRiskProfileAttemptState.user_id)
        .where(UserRiskProfileAttemptState.completed_count >= UserRiskProfileAttemptState.granted_attempts)
        .order_by(
            UserRiskProfileAttemptState.locked_at.desc().nullslast(),
            UserRiskProfileAttemptState.updated_at.desc(),
        )
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(query)
    rows = result.all()
    user_ids = [state.user_id for state, _ in rows]
    profile_image_urls = await resolve_profile_image_urls_by_user_id(db, user_ids)
    items = []
    for state, user in rows:
        items.append(
            serialize_attempt_state(state)
            | {
                "user_id": str(state.user_id),
                "client_id": user.client_id,
                "email": user.email,
                "display_name": _display_name(user),
                "profile_image_url": profile_image_urls.get(state.user_id),
            }
        )
    return {
        "items": items,
        "limit": limit,
        "offset": offset,
    }
