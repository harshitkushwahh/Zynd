from __future__ import annotations

import pytest

from app.application.investor.investor_profile_service import (
    ensure_pending_investor_profile_for_payment,
    mark_investor_profile_active,
)
from app.infrastructure.persistence.investor_models import (
    InvestorProfileStatus,
    InvestorProvisionTrigger,
)
from app.infrastructure.persistence.models import User


@pytest.mark.asyncio
async def test_get_or_create_pending_investor_profile(db_session) -> None:
    from uuid import uuid4

    user = User(
        id=uuid4(),
        email=f"investor-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()

    profile = await ensure_pending_investor_profile_for_payment(db_session, user_id=user.id)

    assert profile.user_id == user.id
    assert profile.status == InvestorProfileStatus.pending
    assert profile.provision_trigger == InvestorProvisionTrigger.payment
    assert profile.external_profile_id is None

    again = await ensure_pending_investor_profile_for_payment(db_session, user_id=user.id)
    assert again.user_id == profile.user_id


@pytest.mark.asyncio
async def test_mark_investor_profile_active(db_session) -> None:
    from uuid import uuid4

    user = User(
        id=uuid4(),
        email=f"investor-active-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()

    profile = await ensure_pending_investor_profile_for_payment(db_session, user_id=user.id)
    updated = await mark_investor_profile_active(
        db_session,
        profile,
        external_profile_id="invp_test_profile_001",
        external_old_id=42,
    )

    assert updated.status == InvestorProfileStatus.active
    assert updated.external_profile_id == "invp_test_profile_001"
    assert updated.external_old_id == 42
    assert updated.provisioned_at is not None
