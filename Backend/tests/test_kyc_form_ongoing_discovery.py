from __future__ import annotations

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.application.kyc.kyc_form_service import ensure_kyc_form
from app.application.kyc.errors import KycError
from app.infrastructure.persistence.models import KycJourneyState, User, UserRole, UserStatus


@pytest.mark.asyncio
async def test_ensure_kyc_form_does_not_spam_create_when_all_stubs_failed_ongoing(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"spam-{uuid4()}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    journey = KycJourneyState(
        user_id=user.id,
        kyc_already_registered=False,
        readiness_code="kyc_unavailable",
        pan_verification_status="verified",
        pan_draft_json={
            "panNumber": "ONJPK4703G",
            "firstName": "TEST",
            "lastName": "USER",
            "fullName": "TEST USER",
            "dateOfBirth": "1985-01-01",
        },
        kyc_partner_external_refs_json=[
            {
                "kind": "kyc_form",
                "external_id": "kycf_old_failed",
                "status": "failed",
                "pan": "ONJPK4703G",
            },
        ],
    )
    db_session.add(journey)
    await db_session.flush()

    failed = {
        "id": "kycf_old_failed",
        "status": "failed",
        "type": "fresh",
        "reason": "An ongoing KYC Form already exists for this PAN",
    }

    with patch(
        "app.application.kyc.kyc_form_service.fetch_kyc_form",
        new=AsyncMock(return_value=failed),
    ), patch(
        "app.application.kyc.kyc_form_service.create_kyc_form",
        new=AsyncMock(),
    ) as create_mock:
        with pytest.raises(KycError) as exc:
            await ensure_kyc_form(db_session, user=user, journey=journey)

    create_mock.assert_not_awaited()
    assert exc.value.code == "kyc_form_already_exists"
