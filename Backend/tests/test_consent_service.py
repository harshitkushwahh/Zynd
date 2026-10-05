from __future__ import annotations

from uuid import uuid4

import pytest

from app.application.consent.consent_service import (
    ConsentAcceptContext,
    get_required_consents,
    record_acceptance,
    record_revocation,
    user_has_active_acceptance,
    user_revocable_consent_active,
)
from app.domain.consent.keys import KYC_NOMINATION_OPT_OUT, PLATFORM_SIGNUP_LEGAL
from app.infrastructure.persistence.models import User


@pytest.mark.asyncio
async def test_signup_and_nominee_consent_flow(db_session) -> None:
    user = User(email=f"consent-{uuid4()}@example.com", first_name="Test", last_name="User")
    db_session.add(user)
    await db_session.flush()

    ctx = ConsentAcceptContext(source="test", ip="127.0.0.1")
    await record_acceptance(db_session, user=user, definition_key=PLATFORM_SIGNUP_LEGAL, context=ctx)
    assert await user_has_active_acceptance(
        db_session,
        user_id=user.id,
        definition_key=PLATFORM_SIGNUP_LEGAL,
    )

    await record_acceptance(db_session, user=user, definition_key=KYC_NOMINATION_OPT_OUT, context=ctx)
    assert await user_revocable_consent_active(
        db_session,
        user_id=user.id,
        definition_key=KYC_NOMINATION_OPT_OUT,
    )

    await record_revocation(db_session, user=user, definition_key=KYC_NOMINATION_OPT_OUT, context=ctx)
    assert not await user_revocable_consent_active(
        db_session,
        user_id=user.id,
        definition_key=KYC_NOMINATION_OPT_OUT,
    )


@pytest.mark.asyncio
async def test_login_required_consents_only_signup_legal_bundle(db_session) -> None:
    user = User(email=f"login-consent-{uuid4()}@example.com", first_name="Test", last_name="User")
    db_session.add(user)
    await db_session.flush()

    required = await get_required_consents(db_session, user_id=user.id, context="login")
    keys = {item["consent_key"] for item in required}
    assert keys <= {PLATFORM_SIGNUP_LEGAL}
