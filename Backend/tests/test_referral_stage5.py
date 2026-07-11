from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

import pytest

from app.application.referral.referral_attribution_service import (
    advance_referral_first_investment,
    advance_referral_kyc_verified,
    advance_referral_qualified,
    attribute_referral_signup,
    count_engaged_for_referrer,
    get_attribution_for_referee,
)
from app.application.referral.referral_code_service import get_or_create_referral_code
from app.application.referral.referral_engagement_service import (
    record_referral_aum_milestone,
    record_referral_engagement_investment,
)
from app.application.shared.datetime_utils import utcnow
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.referral_models import (
    ReferralEngagementMilestone,
    ReferralInvestmentProduct,
    ReferralSignupChannel,
    ReferralStage,
)


async def _qualified_referee_setup(db_session):
    referrer = User(
        id=uuid4(),
        email=f"referrer-eng-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    referee = User(
        id=uuid4(),
        email=f"referee-eng-{uuid4()}@example.com",
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
    await advance_referral_qualified(db_session, referee_user_id=referee.id)
    return referrer, referee


@pytest.mark.asyncio
async def test_record_referral_engagement_second_investment(db_session) -> None:
    referrer, referee = await _qualified_referee_setup(db_session)

    result = await record_referral_engagement_investment(
        db_session,
        user=referee,
        product=ReferralInvestmentProduct.mutual_fund,
        amount_inr=3000,
    )
    assert result.attribution is not None
    assert result.attribution.current_stage == ReferralStage.engaged
    assert result.attribution.engaged_at is not None
    assert len(result.events) == 1
    assert result.events[0].milestone_type == ReferralEngagementMilestone.second_investment
    assert await count_engaged_for_referrer(db_session, referrer_user_id=referrer.id) == 1


@pytest.mark.asyncio
async def test_record_referral_engagement_additional_product(db_session) -> None:
    referrer, referee = await _qualified_referee_setup(db_session)

    result = await record_referral_engagement_investment(
        db_session,
        user=referee,
        product=ReferralInvestmentProduct.fixed_deposit,
        amount_inr=8000,
    )
    assert result.attribution is not None
    assert result.attribution.current_stage == ReferralStage.engaged
    milestone_types = {event.milestone_type for event in result.events}
    assert ReferralEngagementMilestone.second_investment in milestone_types
    assert ReferralEngagementMilestone.additional_product in milestone_types
    assert await count_engaged_for_referrer(db_session, referrer_user_id=referrer.id) == 1


@pytest.mark.asyncio
async def test_record_referral_engagement_requires_qualified(db_session) -> None:
    referrer = User(
        id=uuid4(),
        email=f"referrer-not-qual-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    referee = User(
        id=uuid4(),
        email=f"referee-not-qual-{uuid4()}@example.com",
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

    result = await record_referral_engagement_investment(
        db_session,
        user=referee,
        product=ReferralInvestmentProduct.fixed_deposit,
        amount_inr=8000,
    )
    assert result.events == ()
    attribution = await get_attribution_for_referee(db_session, referee_user_id=referee.id)
    assert attribution is not None
    assert attribution.current_stage == ReferralStage.first_investment
    assert await count_engaged_for_referrer(db_session, referrer_user_id=referrer.id) == 0


@pytest.mark.asyncio
async def test_record_referral_aum_milestone(db_session) -> None:
    referrer, referee = await _qualified_referee_setup(db_session)

    result = await record_referral_aum_milestone(
        db_session,
        user=referee,
        total_aum_inr=150_000,
    )
    assert result.attribution is not None
    assert result.attribution.current_stage == ReferralStage.engaged
    assert len(result.events) == 1
    assert result.events[0].milestone_type == ReferralEngagementMilestone.aum_milestone
    assert result.events[0].total_aum_inr == 150_000
    assert await count_engaged_for_referrer(db_session, referrer_user_id=referrer.id) == 1


@pytest.mark.asyncio
async def test_record_referral_engagement_is_idempotent(db_session) -> None:
    _, referee = await _qualified_referee_setup(db_session)

    first = await record_referral_engagement_investment(
        db_session,
        user=referee,
        product=ReferralInvestmentProduct.mutual_fund,
        amount_inr=3000,
    )
    second = await record_referral_engagement_investment(
        db_session,
        user=referee,
        product=ReferralInvestmentProduct.mutual_fund,
        amount_inr=4000,
    )
    assert first.attribution is not None
    assert second.attribution is not None
    assert first.attribution.current_stage == ReferralStage.engaged
    assert second.events == ()
    assert len(first.events) == 1
