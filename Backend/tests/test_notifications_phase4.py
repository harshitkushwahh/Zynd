from __future__ import annotations

from uuid import uuid4

from datetime import timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.messaging.scheduled_events import begin_event_batch, take_scheduled_events
from app.application.notifications.types import NotificationType
from app.application.referral.referral_attribution_service import (
    advance_referral_first_investment,
    advance_referral_kyc_verified,
    advance_referral_qualified,
    attribute_referral_signup,
)
from app.application.referral.referral_code_service import get_or_create_referral_code
from app.application.referral.referral_engagement_service import advance_referral_engaged
from app.application.shared.datetime_utils import utcnow
from app.infrastructure.persistence.models import User, UserRole, UserStatus
from app.infrastructure.persistence.referral_models import (
    ReferralAttribution,
    ReferralInvestmentProduct,
    ReferralSignupChannel,
    ReferralStage,
)
from app.infrastructure.security.passwords import hash_password


async def _create_user(db: AsyncSession, prefix: str) -> User:
    user = User(
        email=f"{prefix}-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db.add(user)
    await db.flush()
    return user


@pytest.mark.asyncio
async def test_referral_signup_notifies_referrer(db_session: AsyncSession) -> None:
    begin_event_batch()
    referrer = await _create_user(db_session, "referrer")
    referee = await _create_user(db_session, "referee")
    code = await get_or_create_referral_code(db_session, user=referrer)

    await attribute_referral_signup(
        db_session,
        referee=referee,
        referral_code=code.code,
        channel=ReferralSignupChannel.email,
    )

    events = take_scheduled_events()
    assert len(events) == 1
    assert events[0][1].payload["notification_type"] == NotificationType.REFERRAL_USER_SIGNED_UP.value


@pytest.mark.asyncio
async def test_referral_kyc_verified_notifies_referrer(db_session: AsyncSession) -> None:
    begin_event_batch()
    referrer = await _create_user(db_session, "referrer-kyc")
    referee = await _create_user(db_session, "referee-kyc")
    attribution = ReferralAttribution(
        referrer_user_id=referrer.id,
        referee_user_id=referee.id,
        referral_code="TESTCODE",
        signup_channel=ReferralSignupChannel.email,
        current_stage=ReferralStage.signed_up,
    )
    db_session.add(attribution)
    await db_session.flush()

    await advance_referral_kyc_verified(db_session, referee=referee)

    events = take_scheduled_events()
    assert len(events) == 1
    assert events[0][1].payload["notification_type"] == NotificationType.REFERRAL_KYC_VERIFIED.value


@pytest.mark.asyncio
async def test_referral_first_investment_notifies_referrer(db_session: AsyncSession) -> None:
    begin_event_batch()
    referrer = await _create_user(db_session, "referrer-inv")
    referee = await _create_user(db_session, "referee-inv")
    attribution = ReferralAttribution(
        referrer_user_id=referrer.id,
        referee_user_id=referee.id,
        referral_code="INVITE01",
        signup_channel=ReferralSignupChannel.email,
        current_stage=ReferralStage.kyc_verified,
    )
    db_session.add(attribution)
    await db_session.flush()

    await advance_referral_first_investment(
        db_session,
        referee=referee,
        product=ReferralInvestmentProduct.mutual_fund,
        amount_inr=5000,
    )

    events = take_scheduled_events()
    assert len(events) == 1
    assert events[0][1].payload["notification_type"] == NotificationType.REFERRAL_FIRST_INVESTMENT.value


@pytest.mark.asyncio
async def test_referral_qualified_notifies_referrer(db_session: AsyncSession) -> None:
    begin_event_batch()
    referrer = await _create_user(db_session, "referrer-qual")
    referee = await _create_user(db_session, "referee-qual")
    now = utcnow()
    invested_at = now - timedelta(days=31)
    attribution = ReferralAttribution(
        referrer_user_id=referrer.id,
        referee_user_id=referee.id,
        referral_code="QUAL1234",
        signup_channel=ReferralSignupChannel.email,
        current_stage=ReferralStage.first_investment,
        first_investment_at=invested_at,
    )
    db_session.add(attribution)
    await db_session.flush()

    await advance_referral_qualified(db_session, referee_user_id=referee.id, now=now)

    events = take_scheduled_events()
    assert len(events) == 1
    assert events[0][1].payload["notification_type"] == NotificationType.REFERRAL_QUALIFIED.value


@pytest.mark.asyncio
async def test_referral_engaged_notifies_referrer(db_session: AsyncSession) -> None:
    begin_event_batch()
    referrer = await _create_user(db_session, "referrer-eng")
    referee = await _create_user(db_session, "referee-eng")
    attribution = ReferralAttribution(
        referrer_user_id=referrer.id,
        referee_user_id=referee.id,
        referral_code="ENGAGED01",
        signup_channel=ReferralSignupChannel.email,
        current_stage=ReferralStage.qualified,
    )
    db_session.add(attribution)
    await db_session.flush()

    await advance_referral_engaged(db_session, attribution=attribution)

    events = take_scheduled_events()
    assert len(events) == 1
    assert events[0][1].payload["notification_type"] == NotificationType.REFERRAL_ENGAGED.value
