from __future__ import annotations

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.application.kyc.errors import KycError
from app.application.kyc.kyc_form_service import ensure_kyc_form
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.persistence.models import KycJourneyState, User, UserRole, UserStatus


@pytest.mark.asyncio
async def test_ensure_kyc_form_reuses_stored_journey_form_id(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"reuse-journey-{uuid4()}@example.com",
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
        external_kyc_form_id="kycf_existing_reuse",
        pan_draft_json={
            "panNumber": "EPBPS6369E",
            "firstName": "TEST",
            "lastName": "USER",
            "fullName": "TEST USER",
            "dateOfBirth": "1985-01-01",
        },
    )
    db_session.add(journey)
    await db_session.flush()

    existing_form = {
        "id": "kycf_existing_reuse",
        "status": "created",
        "type": "modify",
        "pan": "EPBPS6369E",
    }

    with patch(
        "app.application.kyc.kyc_form_service.fetch_kyc_form",
        new=AsyncMock(return_value=existing_form),
    ) as fetch_mock, patch(
        "app.application.kyc.kyc_form_service.create_kyc_form",
        new=AsyncMock(),
    ) as create_mock:
        form = await ensure_kyc_form(db_session, user=user, journey=journey)

    create_mock.assert_not_awaited()
    fetch_mock.assert_awaited_once_with("kycf_existing_reuse")
    assert form["id"] == "kycf_existing_reuse"
    assert journey.external_kyc_form_id == "kycf_existing_reuse"


@pytest.mark.asyncio
async def test_ensure_kyc_form_creates_when_no_existing_form(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"create-new-{uuid4()}@example.com",
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
                "status": "under_review",
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
    assert form["id"] == "kycf_test_modify"
    assert journey.external_kyc_form_id == "kycf_test_modify"


@pytest.mark.asyncio
async def test_ensure_kyc_form_persists_form_id_before_poll(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"early-persist-{uuid4()}@example.com",
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
            "panNumber": "RHOPS9606E",
            "firstName": "SANGITA",
            "lastName": "SEN",
            "fullName": "SANGITA SEN",
            "dateOfBirth": "1985-01-01",
        },
    )
    db_session.add(journey)
    await db_session.flush()

    async def poll_side_effect(form_id: str) -> dict:
        assert journey.external_kyc_form_id == "kycf_early_persist"
        return {
            "id": form_id,
            "status": "failed",
            "type": "fresh",
            "reason": "ineligible_for_kyc_modification",
        }

    with patch(
        "app.application.kyc.kyc_form_service.create_kyc_form",
        new=AsyncMock(
            return_value={
                "id": "kycf_early_persist",
                "status": "under_review",
                "type": "fresh",
            }
        ),
    ), patch(
        "app.application.kyc.kyc_form_service.poll_kyc_form_until_created",
        new=AsyncMock(side_effect=poll_side_effect),
    ):
        with pytest.raises(KycError) as exc:
            await ensure_kyc_form(db_session, user=user, journey=journey)

    assert exc.value.code == "kyc_form_create_failed"
    assert journey.external_kyc_form_id == "kycf_early_persist"
    assert journey.kyc_form_failure_reason == "ineligible_for_kyc_modification"


@pytest.mark.asyncio
async def test_ensure_kyc_form_recovers_from_already_exists_error(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"recover-{uuid4()}@example.com",
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
            "panNumber": "EPBPS6369E",
            "firstName": "TEST",
            "lastName": "USER",
            "fullName": "TEST USER",
            "dateOfBirth": "1985-01-01",
        },
    )
    db_session.add(journey)
    await db_session.flush()

    existing_form = {
        "id": "kycf_from_error",
        "status": "created",
        "type": "modify",
    }

    with patch(
        "app.application.kyc.kyc_form_service.create_kyc_form",
        new=AsyncMock(
            side_effect=FpClientError(
                "An ongoing KYC Form already exists for this PAN kycf_from_error",
                status_code=400,
                response_data={"message": "already exists kycf_from_error"},
            )
        ),
    ), patch(
        "app.application.kyc.kyc_form_service.fetch_kyc_form",
        new=AsyncMock(return_value=existing_form),
    ) as fetch_mock, patch(
        "app.application.kyc.kyc_form_service.poll_kyc_form_until_created",
        new=AsyncMock(),
    ) as poll_mock:
        form = await ensure_kyc_form(db_session, user=user, journey=journey)

    fetch_mock.assert_awaited_once_with("kycf_from_error")
    poll_mock.assert_not_awaited()
    assert form["id"] == "kycf_from_error"
    assert journey.external_kyc_form_id == "kycf_from_error"


@pytest.mark.asyncio
async def test_ensure_kyc_form_already_exists_without_recoverable_id(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"no-id-{uuid4()}@example.com",
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
            "panNumber": "EPBPS6369E",
            "firstName": "TEST",
            "lastName": "USER",
            "fullName": "TEST USER",
            "dateOfBirth": "1985-01-01",
        },
    )
    db_session.add(journey)
    await db_session.flush()

    with patch(
        "app.application.kyc.kyc_form_service.create_kyc_form",
        new=AsyncMock(
            side_effect=FpClientError(
                "An ongoing KYC Form already exists for this PAN",
                status_code=400,
                response_data={"message": "already exists"},
            )
        ),
    ):
        with pytest.raises(KycError) as exc:
            await ensure_kyc_form(db_session, user=user, journey=journey)

    assert exc.value.code == "kyc_form_already_exists"


@pytest.mark.asyncio
async def test_ensure_kyc_form_does_not_create_when_stored_form_failed(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"failed-bound-{uuid4()}@example.com",
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
        external_kyc_form_id="kycf_failed_bound",
        pan_draft_json={
            "panNumber": "EPBPS6369E",
            "firstName": "TEST",
            "lastName": "USER",
            "fullName": "TEST USER",
            "dateOfBirth": "1985-01-01",
        },
    )
    db_session.add(journey)
    await db_session.flush()

    failed_form = {
        "id": "kycf_failed_bound",
        "status": "failed",
        "type": "modify",
        "reason": "ineligible_for_kyc_modification",
    }

    with patch(
        "app.application.kyc.kyc_form_service.fetch_kyc_form",
        new=AsyncMock(return_value=failed_form),
    ) as fetch_mock, patch(
        "app.application.kyc.kyc_form_service.create_kyc_form",
        new=AsyncMock(),
    ) as create_mock:
        with pytest.raises(KycError) as exc:
            await ensure_kyc_form(db_session, user=user, journey=journey)

    fetch_mock.assert_awaited_once_with("kycf_failed_bound")
    create_mock.assert_not_awaited()
    assert exc.value.code == "kyc_form_create_failed"
    assert journey.external_kyc_form_id == "kycf_failed_bound"
    assert journey.kyc_form_failure_reason == "ineligible_for_kyc_modification"


@pytest.mark.asyncio
async def test_ensure_kyc_form_binds_already_exists_failed_form(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"exists-failed-{uuid4()}@example.com",
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
            "panNumber": "EPBPS6369E",
            "firstName": "TEST",
            "lastName": "USER",
            "fullName": "TEST USER",
            "dateOfBirth": "1985-01-01",
        },
    )
    db_session.add(journey)
    await db_session.flush()

    failed_form = {
        "id": "kycf_from_error",
        "status": "failed",
        "type": "modify",
        "reason": "ineligible_for_kyc_modification",
    }

    with patch(
        "app.application.kyc.kyc_form_service.create_kyc_form",
        new=AsyncMock(
            side_effect=FpClientError(
                "An ongoing KYC Form already exists for this PAN kycf_from_error",
                status_code=400,
                response_data={"message": "already exists kycf_from_error"},
            )
        ),
    ), patch(
        "app.application.kyc.kyc_form_service.fetch_kyc_form",
        new=AsyncMock(return_value=failed_form),
    ) as fetch_mock:
        with pytest.raises(KycError) as exc:
            await ensure_kyc_form(db_session, user=user, journey=journey)

    fetch_mock.assert_awaited_once_with("kycf_from_error")
    assert exc.value.code == "kyc_form_create_failed"
    assert journey.external_kyc_form_id == "kycf_from_error"
