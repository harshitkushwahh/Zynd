from __future__ import annotations

from uuid import uuid4

import pytest

from app.application.documents.profile_image_url_service import (
    build_profile_image_public_url,
    resolve_profile_image_urls_by_user_id,
)
from app.application.referral.referral_attribution_service import (
    advance_referral_kyc_verified,
    attribute_referral_signup,
)
from app.application.referral.referral_code_service import get_or_create_referral_code
from app.application.referral.referral_investment_service import record_referral_investment_activity
from app.application.referral.referral_leaderboard_service import (
    ReferralLeaderboardPeriod,
    display_name_for_user,
    get_referral_leaderboard,
    referee_display_name_for_user,
)
from app.infrastructure.persistence.models import DocumentStatus, DocumentStorageProvider, DocumentType, User, UserDocument
from app.infrastructure.persistence.referral_models import ReferralInvestmentProduct, ReferralSignupChannel


def test_display_name_for_user() -> None:
    user = User(
        id=uuid4(),
        email="test@example.com",
        phone="+919999999999",
        password_hash="hash",
        first_name="Harshit",
        last_name="Kushwah",
    )
    assert display_name_for_user(user) == "Harshit K."


def test_referee_display_name_for_user() -> None:
    user = User(
        id=uuid4(),
        email="test@example.com",
        phone="+919999999999",
        password_hash="hash",
        first_name="Sumarth",
        last_name="Kumar",
    )
    assert referee_display_name_for_user(user) == "Sumarth Kumar"


@pytest.mark.asyncio
async def test_get_referral_leaderboard_ranks_by_signups(db_session) -> None:
    referrer_a = User(
        id=uuid4(),
        email=f"referrer-a-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
        first_name="Alice",
        last_name="Alpha",
    )
    referrer_b = User(
        id=uuid4(),
        email=f"referrer-b-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
        first_name="Bob",
        last_name="Beta",
    )
    referee_one = User(
        id=uuid4(),
        email=f"referee-one-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    referee_two = User(
        id=uuid4(),
        email=f"referee-two-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add_all([referrer_a, referrer_b, referee_one, referee_two])
    await db_session.flush()

    code_a = await get_or_create_referral_code(db_session, user=referrer_a)
    code_b = await get_or_create_referral_code(db_session, user=referrer_b)

    await attribute_referral_signup(
        db_session,
        referee=referee_one,
        referral_code=code_a.code,
        channel=ReferralSignupChannel.email,
    )
    await attribute_referral_signup(
        db_session,
        referee=referee_two,
        referral_code=code_b.code,
        channel=ReferralSignupChannel.google,
    )
    await db_session.flush()

    entries, current_user = await get_referral_leaderboard(
        db_session,
        current_user_id=referrer_a.id,
        period=ReferralLeaderboardPeriod.all_time,
    )

    assert len(entries) == 2
    assert entries[0].referral_count >= entries[1].referral_count
    assert current_user.referral_count == 1
    assert current_user.rank == 1 or current_user.rank == 2


@pytest.mark.asyncio
async def test_get_referral_leaderboard_includes_earnings(db_session) -> None:
    referrer = User(
        id=uuid4(),
        email=f"referrer-earn-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
        first_name="Eve",
        last_name="Earn",
    )
    referee = User(
        id=uuid4(),
        email=f"referee-earn-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add_all([referrer, referee])
    await db_session.flush()

    code = await get_or_create_referral_code(db_session, user=referrer)
    await attribute_referral_signup(
        db_session,
        referee=referee,
        referral_code=code.code,
        channel=ReferralSignupChannel.email,
    )
    await advance_referral_kyc_verified(db_session, referee=referee)
    await record_referral_investment_activity(
        db_session,
        user=referee,
        product=ReferralInvestmentProduct.mutual_fund,
        amount_inr=10_000,
    )
    await db_session.flush()

    entries, current_user = await get_referral_leaderboard(
        db_session,
        current_user_id=referrer.id,
        period=ReferralLeaderboardPeriod.all_time,
    )

    assert len(entries) == 1
    assert entries[0].earnings_inr == 200
    assert current_user.earnings_inr == 200


@pytest.mark.asyncio
async def test_get_referral_leaderboard_includes_profile_image_urls(db_session) -> None:
    referrer = User(
        id=uuid4(),
        email=f"referrer-photo-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
        first_name="Sumarth",
        last_name="Kumar",
    )
    referee = User(
        id=uuid4(),
        email=f"referee-photo-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add_all([referrer, referee])
    await db_session.flush()

    profile_document = UserDocument(
        user_id=referrer.id,
        client_id="client@zynd",
        doc_type=DocumentType.profile_image,
        version=1,
        original_filename="avatar.png",
        mime_type="image/jpeg",
        size_bytes=128,
        sha256="abc123",
        storage_provider=DocumentStorageProvider.local,
        storage_bucket="zynd-public-assets",
        storage_key=f"public/avatars/{referrer.id}/v1.png",
        status=DocumentStatus.active,
    )
    db_session.add(profile_document)
    await db_session.flush()

    code = await get_or_create_referral_code(db_session, user=referrer)
    await attribute_referral_signup(
        db_session,
        referee=referee,
        referral_code=code.code,
        channel=ReferralSignupChannel.email,
    )
    await db_session.flush()

    entries, _ = await get_referral_leaderboard(
        db_session,
        current_user_id=uuid4(),
        period=ReferralLeaderboardPeriod.all_time,
    )

    assert len(entries) == 1
    assert entries[0].profile_image_url == build_profile_image_public_url(profile_document)
    assert entries[0].profile_image_url is not None
    assert str(profile_document.id) in entries[0].profile_image_url


@pytest.mark.asyncio
async def test_resolve_profile_image_urls_by_user_id_picks_latest_active(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"avatar-user-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()

    older = UserDocument(
        user_id=user.id,
        client_id="client@zynd",
        doc_type=DocumentType.profile_image,
        version=1,
        original_filename="avatar-v1.png",
        mime_type="image/jpeg",
        size_bytes=128,
        sha256="older",
        storage_provider=DocumentStorageProvider.local,
        storage_bucket="zynd-public-assets",
        storage_key=f"public/avatars/{user.id}/v1.png",
        status=DocumentStatus.active,
    )
    latest = UserDocument(
        user_id=user.id,
        client_id="client@zynd",
        doc_type=DocumentType.profile_image,
        version=2,
        original_filename="avatar-v2.png",
        mime_type="image/jpeg",
        size_bytes=256,
        sha256="latest",
        storage_provider=DocumentStorageProvider.local,
        storage_bucket="zynd-public-assets",
        storage_key=f"public/avatars/{user.id}/v2.png",
        status=DocumentStatus.active,
    )
    db_session.add_all([older, latest])
    await db_session.flush()

    urls = await resolve_profile_image_urls_by_user_id(db_session, [user.id])

    assert urls[user.id] == build_profile_image_public_url(latest)
