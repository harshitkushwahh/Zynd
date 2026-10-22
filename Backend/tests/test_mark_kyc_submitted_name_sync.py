from __future__ import annotations

from uuid import uuid4

import pytest

from app.application.kyc.journey_state_service import mark_kyc_submitted_with_profile_sync
from app.infrastructure.persistence.models import KycJourneyState, KycOverallStatus, User, UserKycStatus


@pytest.mark.asyncio
async def test_mark_kyc_submitted_syncs_pan_name_to_user(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"under-review-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
        first_name="Nickname",
        last_name="Only",
    )
    status = UserKycStatus(user_id=user.id, overall_status=KycOverallStatus.in_progress)
    journey = KycJourneyState(
        user_id=user.id,
        pan_verification_status="verified",
        pan_draft_json={
            "panNumber": "ABCPA3753D",
            "firstName": "Amit",
            "lastName": "Hooda",
            "fullName": "Amit Hooda",
        },
    )
    db_session.add_all([user, status, journey])
    await db_session.flush()

    transitioned = await mark_kyc_submitted_with_profile_sync(
        db_session, user=user, status=status, journey=journey
    )

    assert transitioned is True
    assert status.overall_status == KycOverallStatus.submitted
    assert user.first_name == "Amit"
    assert user.last_name == "Hooda"
