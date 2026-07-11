from __future__ import annotations

from uuid import uuid4

import pytest

from app.application.documents.profile_image_url_service import (
    build_profile_image_public_url,
    resolve_profile_image_urls_by_user_id,
)
from app.application.referral.referral_attribution_service import (
    attribute_referral_signup,
    count_signups_for_referrer,
    list_referrals_for_referrer,
    mask_referee_email,
)
from app.application.referral.referral_code_service import get_or_create_referral_code
from app.application.referral.referral_leaderboard_service import referee_display_name_for_user
from app.infrastructure.persistence.models import DocumentStatus, DocumentStorageProvider, DocumentType, User, UserDocument
from app.infrastructure.persistence.referral_models import ReferralSignupChannel


def test_mask_referee_email() -> None:
    assert mask_referee_email("kushwahkh@gmail.com") == "k***@gmail.com"
    assert mask_referee_email("a@zynd.com") == "a***@zynd.com"


@pytest.mark.asyncio
async def test_attribute_referral_signup_on_email_signup(db_session) -> None:
    referrer = User(
        id=uuid4(),
        email=f"referrer-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    referee = User(
        id=uuid4(),
        email=f"referee-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add_all([referrer, referee])
    await db_session.flush()

    referral_code = await get_or_create_referral_code(db_session, user=referrer)
    attribution = await attribute_referral_signup(
        db_session,
        referee=referee,
        referral_code=referral_code.code,
        channel=ReferralSignupChannel.email,
    )

    assert attribution is not None
    assert attribution.referrer_user_id == referrer.id
    assert attribution.referee_user_id == referee.id
    assert attribution.current_stage.value == "signed_up"
    assert await count_signups_for_referrer(db_session, referrer_user_id=referrer.id) == 1


@pytest.mark.asyncio
async def test_attribute_referral_signup_blocks_self_referral(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"self-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()

    referral_code = await get_or_create_referral_code(db_session, user=user)
    attribution = await attribute_referral_signup(
        db_session,
        referee=user,
        referral_code=referral_code.code,
        channel=ReferralSignupChannel.email,
    )

    assert attribution is None
    assert await count_signups_for_referrer(db_session, referrer_user_id=user.id) == 0


@pytest.mark.asyncio
async def test_attribute_referral_signup_is_idempotent_per_referee(db_session) -> None:
    referrer = User(
        id=uuid4(),
        email=f"referrer-idem-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    referee = User(
        id=uuid4(),
        email=f"referee-idem-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add_all([referrer, referee])
    await db_session.flush()

    referral_code = await get_or_create_referral_code(db_session, user=referrer)
    first = await attribute_referral_signup(
        db_session,
        referee=referee,
        referral_code=referral_code.code,
        channel=ReferralSignupChannel.google,
    )
    second = await attribute_referral_signup(
        db_session,
        referee=referee,
        referral_code=referral_code.code,
        channel=ReferralSignupChannel.google,
    )

    assert first is not None
    assert second is None
    assert await count_signups_for_referrer(db_session, referrer_user_id=referrer.id) == 1


@pytest.mark.asyncio
async def test_list_referrals_resolves_referee_profile_image_urls(db_session) -> None:
    referrer = User(
        id=uuid4(),
        email=f"referrer-photo-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    referee = User(
        id=uuid4(),
        email=f"referee-photo-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
        first_name="Sumarth",
        last_name="Kumar",
    )
    db_session.add_all([referrer, referee])
    await db_session.flush()

    profile_document = UserDocument(
        user_id=referee.id,
        client_id="client@zynd",
        doc_type=DocumentType.profile_image,
        version=1,
        original_filename="avatar.png",
        mime_type="image/jpeg",
        size_bytes=128,
        sha256="abc123",
        storage_provider=DocumentStorageProvider.local,
        storage_bucket="zynd-public-assets",
        storage_key=f"public/avatars/{referee.id}/v1.png",
        status=DocumentStatus.active,
    )
    db_session.add(profile_document)

    referral_code = await get_or_create_referral_code(db_session, user=referrer)
    await attribute_referral_signup(
        db_session,
        referee=referee,
        referral_code=referral_code.code,
        channel=ReferralSignupChannel.email,
    )
    await db_session.flush()

    rows = await list_referrals_for_referrer(db_session, referrer_user_id=referrer.id)
    referee_ids = [row_referee.id for _, row_referee in rows]
    profile_image_urls = await resolve_profile_image_urls_by_user_id(db_session, referee_ids)

    assert len(rows) == 1
    assert referee_display_name_for_user(referee) == "Sumarth Kumar"
    assert profile_image_urls.get(referee.id) == build_profile_image_public_url(profile_document)
