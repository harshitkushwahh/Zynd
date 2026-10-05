from __future__ import annotations

from uuid import uuid4

import pytest

from app.application.kyc.journey_state_service import save_journey_state
from app.application.consent.consent_service import user_revocable_consent_active
from app.domain.consent.keys import KYC_NOMINATION_OPT_OUT
from app.infrastructure.persistence.models import User


@pytest.mark.asyncio
async def test_kyc_journey_opt_out_records_platform_consent(db_session) -> None:
    user = User(email=f"kyc-opt-{uuid4()}@example.com", first_name="Test", last_name="User")
    db_session.add(user)
    await db_session.flush()

    await save_journey_state(
        db_session,
        user=user,
        payload={
            "nomineeDraftJson": [],
            "recordNominationOptOut": True,
            "lastCompletedStep": "nominee",
            "consentContext": {"source": "test", "ip": "127.0.0.1"},
        },
    )

    assert await user_revocable_consent_active(
        db_session,
        user_id=user.id,
        definition_key=KYC_NOMINATION_OPT_OUT,
    )
