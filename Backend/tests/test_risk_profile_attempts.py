from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.risk_profile.attempt_service import (
    ensure_can_take_assessment,
    get_attempt_state,
    grant_additional_attempts,
    record_completed_attempt,
)
from app.application.risk_profile.constants import RISK_PROFILE_DEFAULT_ATTEMPTS
from app.application.risk_profile.errors import RiskProfileError
from app.infrastructure.persistence.models import User, UserRole, UserStatus


@pytest.mark.asyncio
async def test_attempt_state_locks_after_default_limit(db_session: AsyncSession) -> None:
    user = User(
        email=f"attempt-user-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    state = await get_attempt_state(db_session, user.id)
    assert state["granted_attempts"] == RISK_PROFILE_DEFAULT_ATTEMPTS
    assert state["attempts_remaining"] == RISK_PROFILE_DEFAULT_ATTEMPTS
    assert state["is_locked"] is False

    for _ in range(RISK_PROFILE_DEFAULT_ATTEMPTS):
        await record_completed_attempt(db_session, user.id)

    locked = await get_attempt_state(db_session, user.id)
    assert locked["completed_count"] == RISK_PROFILE_DEFAULT_ATTEMPTS
    assert locked["is_locked"] is True

    with pytest.raises(RiskProfileError) as exc:
        await ensure_can_take_assessment(db_session, user.id)
    assert exc.value.code == "risk_profile_locked"

    unlocked = await grant_additional_attempts(db_session, user_id=user.id, attempts=3)
    assert unlocked["granted_attempts"] == RISK_PROFILE_DEFAULT_ATTEMPTS + 3
    assert unlocked["is_locked"] is False
    assert unlocked["attempts_remaining"] == 3

    await ensure_can_take_assessment(db_session, user.id)
