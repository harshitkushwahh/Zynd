from __future__ import annotations

from uuid import uuid4

import pytest

from app.application.referral.referral_attribution_service import (
    advance_referral_kyc_verified,
    attribute_referral_signup,
    count_kyc_verified_for_referrer,
)
from app.application.referral.referral_code_service import get_or_create_referral_code
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.referral_models import ReferralSignupChannel, ReferralStage


@pytest.mark.asyncio
async def test_advance_referral_kyc_verified(db_session) -> None:
    referrer = User(
        id=uuid4(),
        email=f"referrer-kyc-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    referee = User(
        id=uuid4(),
        email=f"referee-kyc-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add_all([referrer, referee])
    await db_session.flush()

    referral_code = await get_or_create_referral_code(db_session, user=referrer)
    await attribute_referral_signup(
        db_session,
        referee=referee,
        referral_code=referral_code.code,
        channel=ReferralSignupChannel.email,
    )

    updated = await advance_referral_kyc_verified(db_session, referee=referee)
    assert updated is not None
    assert updated.current_stage == ReferralStage.kyc_verified
    assert updated.kyc_verified_at is not None
    assert await count_kyc_verified_for_referrer(db_session, referrer_user_id=referrer.id) == 1

    again = await advance_referral_kyc_verified(db_session, referee=referee)
    assert again is not None
    assert again.current_stage == ReferralStage.kyc_verified
    assert await count_kyc_verified_for_referrer(db_session, referrer_user_id=referrer.id) == 1


@pytest.mark.asyncio
async def test_advance_referral_kyc_verified_without_attribution(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"no-ref-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()

    result = await advance_referral_kyc_verified(db_session, referee=user)
    assert result is None
