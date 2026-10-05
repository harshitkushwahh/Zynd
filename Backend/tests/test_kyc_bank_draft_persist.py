from __future__ import annotations

from uuid import uuid4

import pytest

from app.application.kyc.journey_state_service import save_journey_state
from app.infrastructure.persistence.models import User


@pytest.mark.asyncio
async def test_save_journey_preserves_account_number_when_client_sends_redacted_draft(db_session) -> None:
    user = User(email=f"bank-{uuid4()}@example.com", first_name="Test", last_name="User")
    db_session.add(user)
    await db_session.flush()

    await save_journey_state(
        db_session,
        user=user,
        payload={
            "bankDraftJson": {
                "accountNumber": "73773738281234",
                "ifscCode": "KKBK0005915",
                "accountType": "Savings",
                "bankName": "Kotak Mahindra Bank",
            },
        },
    )

    journey, _ = await save_journey_state(
        db_session,
        user=user,
        payload={
            "bankDraftJson": {
                "accountNumber": "",
                "accountNumberLast4": "1234",
                "ifscCode": "KKBK0005915",
                "accountType": "Savings",
                "bankName": "Kotak Mahindra Bank",
                "verificationStatus": "verified",
            },
            "lastCompletedStep": "bank",
        },
    )

    assert journey.bank_draft_json is not None
    assert journey.bank_draft_json["accountNumber"] == "73773738281234"
