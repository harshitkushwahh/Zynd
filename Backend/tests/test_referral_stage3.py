from __future__ import annotations

from uuid import uuid4

import pytest

from app.application.referral.referral_attribution_service import (
    advance_referral_first_investment,
    advance_referral_kyc_verified,
    attribute_referral_signup,
    count_first_investment_for_referrer,
    count_kyc_verified_for_referrer,
)
from app.application.referral.referral_code_service import get_or_create_referral_code
from app.application.referral.referral_investment_service import record_referral_first_investment
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.referral_models import (
    ReferralInvestmentProduct,
    ReferralSignupChannel,
    ReferralStage,
)


@pytest.mark.asyncio
async def test_advance_referral_first_investment(db_session) -> None:
    referrer = User(
        id=uuid4(),
        email=f"referrer-inv-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    referee = User(
        id=uuid4(),
        email=f"referee-inv-{uuid4()}@example.com",
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

    updated = await advance_referral_first_investment(
        db_session,
        referee=referee,
        product=ReferralInvestmentProduct.mutual_fund,
        amount_inr=5000,
    )
    assert updated is not None
    assert updated.current_stage == ReferralStage.first_investment
    assert updated.first_investment_at is not None
    assert updated.first_investment_product == ReferralInvestmentProduct.mutual_fund
    assert updated.first_investment_amount_inr == 5000
    assert await count_first_investment_for_referrer(db_session, referrer_user_id=referrer.id) == 1
    assert await count_kyc_verified_for_referrer(db_session, referrer_user_id=referrer.id) == 1


@pytest.mark.asyncio
async def test_advance_referral_first_investment_requires_kyc(db_session) -> None:
    referrer = User(
        id=uuid4(),
        email=f"referrer-no-kyc-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    referee = User(
        id=uuid4(),
        email=f"referee-no-kyc-{uuid4()}@example.com",
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

    result = await record_referral_first_investment(
        db_session,
        user=referee,
        product=ReferralInvestmentProduct.fixed_deposit,
        amount_inr=10_000,
    )
    assert result is None
    assert await count_first_investment_for_referrer(db_session, referrer_user_id=referrer.id) == 0


@pytest.mark.asyncio
async def test_advance_referral_first_investment_enforces_minimum_amount(db_session) -> None:
    referrer = User(
        id=uuid4(),
        email=f"referrer-min-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    referee = User(
        id=uuid4(),
        email=f"referee-min-{uuid4()}@example.com",
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

    result = await record_referral_first_investment(
        db_session,
        user=referee,
        product=ReferralInvestmentProduct.mutual_fund,
        amount_inr=100,
    )
    assert result is None
