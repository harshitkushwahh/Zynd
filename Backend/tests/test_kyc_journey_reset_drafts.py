from __future__ import annotations

from uuid import uuid4

import pytest

from app.application.kyc.journey_state_service import reset_kyc_journey_drafts, save_journey_state
from app.infrastructure.persistence.models import KycStepStatus, User


@pytest.mark.asyncio
async def test_reset_kyc_journey_drafts_clears_all_progress(db_session) -> None:
    user = User(email=f"reset-{uuid4()}@example.com", first_name="Test", last_name="User")
    db_session.add(user)
    await db_session.flush()

    await save_journey_state(
        db_session,
        user=user,
        payload={
            "panDraftJson": {
                "panNumber": "ABCDE1234F",
                "fullName": "Test User",
                "dateOfBirth": "1990-01-01",
            },
            "panVerificationStatus": "verified",
            "contactDraftJson": {"line1": "1 Main St", "city": "Mumbai", "state": "Maharashtra", "pincode": "400001"},
            "bankDraftJson": {"ifscCode": "HDFC0000001", "accountNumber": "1234567890"},
            "bankVerificationStatus": "verified",
            "lastCompletedStep": "bank",
        },
    )

    journey, status = await reset_kyc_journey_drafts(db_session, user=user)

    assert journey.last_completed_step is None
    assert journey.pan_draft_json is None
    assert journey.contact_draft_json is None
    assert journey.bank_draft_json is None
    assert journey.bank_verification_status is None
    assert journey.pan_verification_status is None
    assert status.pan_step_status == KycStepStatus.pending
    assert status.bank_step_status == KycStepStatus.pending
    assert status.review_step_status == KycStepStatus.pending
