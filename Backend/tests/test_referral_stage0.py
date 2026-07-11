from __future__ import annotations

from uuid import uuid4

import pytest

from app.application.referral.referral_click_service import record_referral_click
from app.application.referral.referral_code_service import get_or_create_referral_code
from app.application.referral.referral_errors import ReferralError
from app.infrastructure.persistence.models import User


@pytest.mark.asyncio
async def test_get_or_create_referral_code_is_stable(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"referrer-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()

    first = await get_or_create_referral_code(db_session, user=user)
    second = await get_or_create_referral_code(db_session, user=user)

    assert first.id == second.id
    assert len(first.code) == 8
    assert first.code == first.code.upper()


@pytest.mark.asyncio
async def test_record_referral_click_increments_for_referrer(db_session) -> None:
    referrer = User(
        id=uuid4(),
        email=f"referrer-click-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(referrer)
    await db_session.flush()

    referral_code = await get_or_create_referral_code(db_session, user=referrer)
    await record_referral_click(
        db_session,
        code=referral_code.code,
        ip="127.0.0.1",
        user_agent="pytest-agent",
    )
    await db_session.flush()

    with pytest.raises(ReferralError):
        await record_referral_click(
            db_session,
            code="BADCODE1",
            ip="127.0.0.1",
            user_agent="pytest-agent",
        )
