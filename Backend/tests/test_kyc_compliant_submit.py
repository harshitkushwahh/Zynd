from __future__ import annotations

import pytest

from app.application.kyc.errors import KycError
from app.application.kyc.journey_gate_service import requires_full_kyc_submission
from app.application.kyc.journey_state_service import _step_index
from app.application.kyc.kyc_form_service import submit_compliant_kyc_journey, submit_kyc_form
from app.infrastructure.persistence.models import KycJourneyState, KycOverallStatus, User, UserKycStatus


def test_requires_full_kyc_submission_for_new_users() -> None:
    journey = KycJourneyState(user_id=None, kyc_already_registered=False)
    assert requires_full_kyc_submission(journey) is True


def test_requires_full_kyc_submission_for_kra_registered() -> None:
    journey = KycJourneyState(user_id=None, kyc_already_registered=True, readiness_code=None)
    assert requires_full_kyc_submission(journey) is False


def test_step_index_skips_signature_for_kra_registered() -> None:
    assert _step_index("bank", kyc_already_registered=True) == 5
    assert _step_index("bank", kyc_already_registered=False) == 5


@pytest.mark.asyncio
async def test_submit_compliant_kyc_marks_completed(db_session) -> None:
    from uuid import uuid4

    user = User(
        id=uuid4(),
        email=f"compliant-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
        first_name="Signup",
        last_name="Name",
    )
    db_session.add(user)
    await db_session.flush()

    journey = KycJourneyState(
        user_id=user.id,
        kyc_already_registered=True,
        pan_verification_status="verified",
        pan_draft_json={
            "panNumber": "ABCPA3753D",
            "firstName": "HARSHIT",
            "lastName": "KUSHWAH",
            "fullName": "HARSHIT KUSHWAH",
            "dateOfBirth": "1990-01-01",
        },
        personal_draft_json={"gender": "male"},
        last_completed_step="bank",
        bank_verification_status="verified",
        bank_draft_json={"accountNumber": "1234567890"},
    )
    status = UserKycStatus(user_id=user.id, overall_status=KycOverallStatus.phase2_complete)
    db_session.add(journey)
    db_session.add(status)
    await db_session.flush()

    result = await submit_kyc_form(db_session, user=user)

    assert result["nextAction"] == "completed"
    assert result["nameUpdated"] is True
    await db_session.refresh(status)
    await db_session.refresh(user)
    assert status.overall_status == KycOverallStatus.completed
    assert status.signature_step_status.value == "skipped"
    assert user.first_name == "HARSHIT"
    assert user.last_name == "KUSHWAH"


@pytest.mark.asyncio
async def test_submit_compliant_kyc_rejects_full_kyc_user(db_session) -> None:
    from uuid import uuid4

    user = User(
        id=uuid4(),
        email=f"fresh-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()

    journey = KycJourneyState(
        user_id=user.id,
        kyc_already_registered=False,
        pan_draft_json={"panNumber": "ABCPA3753D", "fullName": "Test User", "dateOfBirth": "1990-01-01"},
        personal_draft_json={"gender": "male"},
        last_completed_step="bank",
        bank_verification_status="verified",
        bank_draft_json={"accountNumber": "1234567890"},
    )
    status = UserKycStatus(user_id=user.id, overall_status=KycOverallStatus.phase2_complete)
    db_session.add(journey)
    db_session.add(status)
    await db_session.flush()

    with pytest.raises(KycError) as exc:
        await submit_compliant_kyc_journey(db_session, user=user)
    assert exc.value.code == "full_kyc_required"
