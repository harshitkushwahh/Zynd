from __future__ import annotations

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.application.kyc.digilocker_service import start_digilocker
from app.application.kyc.errors import KycError
from app.application.kyc.journey_gate_service import (
    is_rekyc_modification,
    is_rekyc_readiness_code,
    require_digilocker_or_kra_skip,
)
from app.application.kyc.kyc_form_service import ensure_kyc_form
from app.application.kyc.pan_verification_service import verify_pan
from app.infrastructure.persistence.models import KycJourneyState, User, UserRole, UserStatus


def test_is_rekyc_readiness_code_matches_modification_codes() -> None:
    assert is_rekyc_readiness_code("kyc_incomplete") is True
    assert is_rekyc_readiness_code("KYC_LEGACY") is True
    assert is_rekyc_readiness_code("kyc_unavailable") is False
    assert is_rekyc_readiness_code(None) is False


def test_is_rekyc_modification_from_journey_readiness_code() -> None:
    journey = KycJourneyState(
        user_id=None,
        kyc_already_registered=False,
        readiness_code="kyc_incomplete",
    )
    assert is_rekyc_modification(journey) is True

    journey.readiness_code = None
    assert is_rekyc_modification(journey) is False


def test_require_digilocker_skipped_for_rekyc_modification() -> None:
    journey = KycJourneyState(
        user_id=None,
        kyc_already_registered=False,
        readiness_code="kyc_incomplete",
        external_kyc_status=None,
    )
    require_digilocker_or_kra_skip(journey)


def test_require_digilocker_still_required_for_new_investors() -> None:
    journey = KycJourneyState(
        user_id=None,
        kyc_already_registered=False,
        readiness_code="kyc_unavailable",
        external_kyc_status=None,
    )
    with pytest.raises(KycError) as exc:
        require_digilocker_or_kra_skip(journey)
    assert exc.value.code == "digilocker_required"


@pytest.mark.asyncio
async def test_ensure_kyc_form_uses_modify_for_kyc_incomplete(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"rekyc-{uuid4()}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    journey = KycJourneyState(
        user_id=user.id,
        kyc_already_registered=False,
        readiness_code="kyc_incomplete",
        pan_verification_status="verified",
        pan_draft_json={
            "panNumber": "RHOPS9606E",
            "firstName": "SANGITA",
            "lastName": "SEN",
            "fullName": "SANGITA SEN",
            "dateOfBirth": "1985-01-01",
        },
    )
    db_session.add(journey)
    await db_session.flush()

    with patch(
        "app.application.kyc.kyc_form_service.create_kyc_form",
        new=AsyncMock(
            return_value={
                "id": "kycf_test_modify",
                "status": "created",
                "type": "modify",
            }
        ),
    ) as create_mock, patch(
        "app.application.kyc.kyc_form_service.poll_kyc_form_until_created",
        new=AsyncMock(
            return_value={
                "id": "kycf_test_modify",
                "status": "created",
                "type": "modify",
            }
        ),
    ):
        form = await ensure_kyc_form(db_session, user=user, journey=journey)

    create_mock.assert_awaited_once()
    assert create_mock.await_args.kwargs["form_type"] == "modify"
    assert form["type"] == "modify"
    assert journey.kyc_form_type == "modify"


@pytest.mark.asyncio
async def test_verify_pan_skips_digilocker_for_kyc_incomplete(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"rekyc-pan-{uuid4()}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    with patch(
        "app.application.kyc.pan_verification_service.kyckart_pan_to_name_dob",
        new=AsyncMock(
            return_value={
                "fullName": "SANGITA SEN",
                "firstName": "SANGITA",
                "lastName": "SEN",
                "dateOfBirth": "1985-01-01",
                "panCategory": "individual",
            }
        ),
    ), patch(
        "app.application.kyc.pan_verification_service.poa_check_readiness",
        new=AsyncMock(
            return_value={
                "id": "pv_readiness_1",
                "readiness": {
                    "status": "failed",
                    "code": "kyc_incomplete",
                    "reason": "KYC record incomplete at KRA.",
                },
            }
        ),
    ), patch(
        "app.application.kyc.pan_verification_service.poa_validate_pan_name_dob",
        new=AsyncMock(
            return_value={
                "id": "pv_pan_1",
                "pan": {"status": "verified"},
                "name": {"status": "verified"},
                "date_of_birth": {"status": "verified"},
            }
        ),
    ):
        result = await verify_pan(db_session, user=user, pan_number="RHOPS9606E")

    assert result["success"] is True
    assert result["kycAlreadyRegistered"] is False
    assert result["requiresDigilocker"] is False
    assert result["readiness"]["code"] == "kyc_incomplete"


@pytest.mark.asyncio
async def test_start_digilocker_rejects_rekyc_modification(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"rekyc-dl-{uuid4()}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    journey = KycJourneyState(
        user_id=user.id,
        pan_verification_status="verified",
        kyc_already_registered=False,
        readiness_code="kyc_incomplete",
        pan_draft_json={"panNumber": "RHOPS9606E", "fullName": "SANGITA SEN", "dateOfBirth": "1985-01-01"},
    )
    db_session.add(journey)
    await db_session.flush()

    with pytest.raises(KycError) as exc:
        await start_digilocker(db_session, user=user)
    assert exc.value.code == "digilocker_not_required"
