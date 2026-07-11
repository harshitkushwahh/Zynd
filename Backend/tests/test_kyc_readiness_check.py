from __future__ import annotations

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.application.kyc.errors import KycError
from app.application.kyc.readiness_check_service import check_kra_readiness_status
from app.infrastructure.persistence.models import (
    KycJourneyState,
    KycOverallStatus,
    User,
    UserKycStatus,
    UserRole,
    UserStatus,
)


def _user() -> User:
    return User(
        id=uuid4(),
        email=f"kyc-readiness-{uuid4()}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
    )


@pytest.mark.asyncio
async def test_check_kra_readiness_requires_submitted_status(db_session) -> None:
    user = _user()
    db_session.add(user)
    await db_session.flush()

    journey = KycJourneyState(user_id=user.id, pan_draft_json={"panNumber": "ABCPA1234F"})
    status = UserKycStatus(user_id=user.id, overall_status=KycOverallStatus.phase2_complete)
    db_session.add(journey)
    db_session.add(status)
    await db_session.flush()

    with pytest.raises(KycError) as exc:
        await check_kra_readiness_status(db_session, user=user)
    assert exc.value.code == "kyc_not_submitted"


@pytest.mark.asyncio
async def test_check_kra_readiness_pending_keeps_submitted(db_session) -> None:
    user = _user()
    db_session.add(user)
    await db_session.flush()

    journey = KycJourneyState(
        user_id=user.id,
        pan_draft_json={"panNumber": "ABCPA1234F"},
        kyc_form_status="submitted",
        external_kyc_form_id="form_stub_1",
    )
    status = UserKycStatus(user_id=user.id, overall_status=KycOverallStatus.submitted)
    db_session.add(journey)
    db_session.add(status)
    await db_session.flush()

    with patch(
        "app.application.kyc.readiness_check_service.poa_check_readiness",
        new=AsyncMock(
            return_value={
                "id": "pv_pending_1",
                "readiness": {
                    "status": "failed",
                    "code": "kyc_unavailable",
                    "reason": "No KYC record available for this investor at KRA.",
                },
            }
        ),
    ):
        result = await check_kra_readiness_status(db_session, user=user)

    assert result["kraVerified"] is False
    assert result["overallStatus"] == "submitted"
    await db_session.refresh(journey)
    await db_session.refresh(status)
    assert status.overall_status == KycOverallStatus.submitted
    assert journey.readiness_code == "kyc_unavailable"
    assert journey.poa_readiness_preverify_id == "pv_pending_1"


@pytest.mark.asyncio
async def test_check_kra_readiness_verified_marks_completed(db_session) -> None:
    user = _user()
    db_session.add(user)
    await db_session.flush()

    journey = KycJourneyState(
        user_id=user.id,
        pan_draft_json={"panNumber": "ABCRA1234F"},
        kyc_form_status="submitted",
        external_kyc_form_id="form_stub_2",
    )
    status = UserKycStatus(user_id=user.id, overall_status=KycOverallStatus.submitted)
    db_session.add(journey)
    db_session.add(status)
    await db_session.flush()

    with patch(
        "app.application.kyc.readiness_check_service.poa_check_readiness",
        new=AsyncMock(
            return_value={
                "id": "pv_verified_1",
                "readiness": {"status": "verified", "code": None, "reason": None},
            }
        ),
    ):
        result = await check_kra_readiness_status(db_session, user=user)

    assert result["kraVerified"] is True
    assert result["overallStatus"] == "completed"
    await db_session.refresh(status)
    assert status.overall_status == KycOverallStatus.completed


@pytest.mark.asyncio
async def test_check_kra_readiness_completed_short_circuits(db_session) -> None:
    user = _user()
    db_session.add(user)
    await db_session.flush()

    journey = KycJourneyState(
        user_id=user.id,
        pan_draft_json={"panNumber": "ABCRA1234F"},
        readiness_code=None,
        readiness_reason=None,
    )
    status = UserKycStatus(user_id=user.id, overall_status=KycOverallStatus.completed)
    db_session.add(journey)
    db_session.add(status)
    await db_session.flush()

    with patch(
        "app.application.kyc.readiness_check_service.poa_check_readiness",
        new=AsyncMock(),
    ) as mock_readiness:
        result = await check_kra_readiness_status(db_session, user=user)

    mock_readiness.assert_not_called()
    assert result["kraVerified"] is True
    assert result["overallStatus"] == "completed"
