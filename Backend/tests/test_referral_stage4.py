from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

import pytest

from app.application.referral.referral_attribution_service import (
    advance_referral_first_investment,
    advance_referral_kyc_verified,
    advance_referral_qualified,
    attribute_referral_signup,
    count_qualified_for_referrer,
    get_attribution_for_referee,
    mark_first_investment_reversed,
)
from app.application.referral.referral_code_service import get_or_create_referral_code
from app.application.referral.referral_qualification_service import run_referral_qualification_batch
from app.application.shared.datetime_utils import utcnow
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.referral_models import (
    ReferralInvestmentProduct,
    ReferralSignupChannel,
    ReferralStage,
)


async def _qualified_referee_setup(db_session):
    referrer = User(
        id=uuid4(),
        email=f"referrer-qual-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    referee = User(
        id=uuid4(),
        email=f"referee-qual-{uuid4()}@example.com",
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
    await advance_referral_kyc_verified(db_session, referee=referee)
    await advance_referral_first_investment(
        db_session,
        referee=referee,
        product=ReferralInvestmentProduct.mutual_fund,
        amount_inr=5000,
    )
    attribution = await get_attribution_for_referee(db_session, referee_user_id=referee.id)
    assert attribution is not None
    attribution.first_investment_at = utcnow() - timedelta(days=31)
    await db_session.flush()
    return referrer, referee, attribution


@pytest.mark.asyncio
async def test_advance_referral_qualified_after_hold(db_session) -> None:
    referrer, referee, _ = await _qualified_referee_setup(db_session)

    updated = await advance_referral_qualified(db_session, referee_user_id=referee.id)
    assert updated is not None
    assert updated.current_stage == ReferralStage.qualified
    assert updated.qualified_at is not None
    assert await count_qualified_for_referrer(db_session, referrer_user_id=referrer.id) == 1


@pytest.mark.asyncio
async def test_advance_referral_qualified_before_hold(db_session) -> None:
    referrer = User(
        id=uuid4(),
        email=f"referrer-hold-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    referee = User(
        id=uuid4(),
        email=f"referee-hold-{uuid4()}@example.com",
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
    await advance_referral_kyc_verified(db_session, referee=referee)
    await advance_referral_first_investment(
        db_session,
        referee=referee,
        product=ReferralInvestmentProduct.fixed_deposit,
        amount_inr=10_000,
    )

    result = await advance_referral_qualified(db_session, referee_user_id=referee.id)
    assert result is None
    assert await count_qualified_for_referrer(db_session, referrer_user_id=referrer.id) == 0


@pytest.mark.asyncio
async def test_advance_referral_qualified_blocked_after_reversal(db_session) -> None:
    referrer, referee, attribution = await _qualified_referee_setup(db_session)

    await mark_first_investment_reversed(db_session, referee_user_id=referee.id)
    result = await advance_referral_qualified(db_session, referee_user_id=referee.id)
    assert result is None
    assert attribution.current_stage == ReferralStage.first_investment
    assert await count_qualified_for_referrer(db_session, referrer_user_id=referrer.id) == 0


@pytest.mark.asyncio
async def test_run_referral_qualification_batch(db_session) -> None:
    referrer, referee, _ = await _qualified_referee_setup(db_session)

    result = await run_referral_qualification_batch(db_session, limit=10)
    assert result["processed"] >= 1
    assert result["qualified"] == 1
    assert await count_qualified_for_referrer(db_session, referrer_user_id=referrer.id) == 1

    again = await advance_referral_qualified(db_session, referee_user_id=referee.id)
    assert again is not None
    assert again.current_stage == ReferralStage.qualified
