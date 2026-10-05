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
async def test_ensure_kyc_form_creates_new_when_stored_form_failed(db_session) -> None:
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
        readiness_code="kyc_unavailable",
        pan_verification_status="verified",
        external_kyc_form_id="kycf_failed_bound",
        kyc_form_status="failed",
        kyc_form_type="fresh",
        kyc_form_failure_reason="previous attempt failed",
        pan_draft_json={
            "panNumber": "ONJPK4703G",
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
        "type": "fresh",
        "reason": "previous attempt failed",
    }

    with patch(
        "app.application.kyc.kyc_form_service.fetch_kyc_form",
        new=AsyncMock(return_value=failed_form),
    ) as fetch_mock, patch(
        "app.application.kyc.kyc_form_service.create_kyc_form",
        new=AsyncMock(
            return_value={
                "id": "kycf_fresh_esign",
                "status": "under_review",
                "type": "fresh",
            }
        ),
    ) as create_mock, patch(
        "app.application.kyc.kyc_form_service.poll_kyc_form_until_created",
        new=AsyncMock(
            return_value={
                "id": "kycf_fresh_esign",
                "status": "created",
                "type": "fresh",
            }
        ),
    ):
        form = await ensure_kyc_form(db_session, user=user, journey=journey)

    fetch_mock.assert_awaited_once_with("kycf_failed_bound")
    create_mock.assert_awaited_once()
    assert create_mock.await_args.kwargs["form_type"] == "fresh"
    assert form["id"] == "kycf_fresh_esign"
    assert journey.external_kyc_form_id == "kycf_fresh_esign"
    assert journey.kyc_form_status == "created"


@pytest.mark.asyncio
async def test_ensure_kyc_form_creates_new_when_stored_form_expired(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"expired-bound-{uuid4()}@example.com",
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
        external_kyc_form_id="kycf_expired_bound",
        kyc_form_status="expired",
        kyc_form_type="fresh",
        pan_draft_json={
            "panNumber": "ONJPK4703G",
            "firstName": "TEST",
            "lastName": "USER",
            "fullName": "TEST USER",
            "dateOfBirth": "1985-01-01",
        },
    )
    db_session.add(journey)
    await db_session.flush()

    expired_form = {
        "id": "kycf_expired_bound",
        "status": "expired",
        "type": "fresh",
        "reason": "form expired",
    }

    with patch(
        "app.application.kyc.kyc_form_service.fetch_kyc_form",
        new=AsyncMock(return_value=expired_form),
    ) as fetch_mock, patch(
        "app.application.kyc.kyc_form_service.create_kyc_form",
        new=AsyncMock(
            return_value={
                "id": "kycf_fresh_retry",
                "status": "under_review",
                "type": "fresh",
            }
        ),
    ) as create_mock, patch(
        "app.application.kyc.kyc_form_service.poll_kyc_form_until_created",
        new=AsyncMock(
            return_value={
                "id": "kycf_fresh_retry",
                "status": "created",
                "type": "fresh",
            }
        ),
    ):
        form = await ensure_kyc_form(db_session, user=user, journey=journey)

    fetch_mock.assert_awaited_once_with("kycf_expired_bound")
    create_mock.assert_awaited_once()
    assert create_mock.await_args.kwargs["form_type"] == "fresh"
    assert form["id"] == "kycf_fresh_retry"
    assert journey.external_kyc_form_id == "kycf_fresh_retry"


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

    ongoing_form = {
        "id": "kycf_ongoing_ok",
        "status": "created",
        "type": "modify",
    }

    with patch(
        "app.application.kyc.kyc_form_service.create_kyc_form",
        new=AsyncMock(
            side_effect=FpClientError(
                "An ongoing KYC Form already exists for this PAN kycf_ongoing_ok",
                status_code=400,
                response_data={"message": "already exists kycf_ongoing_ok"},
            )
        ),
    ), patch(
        "app.application.kyc.kyc_form_service.fetch_kyc_form",
        new=AsyncMock(return_value=ongoing_form),
    ) as fetch_mock, patch(
        "app.application.kyc.kyc_form_service.poll_kyc_form_until_created",
        new=AsyncMock(),
    ):
        form = await ensure_kyc_form(db_session, user=user, journey=journey)

    fetch_mock.assert_awaited_with("kycf_ongoing_ok")
    assert form["id"] == "kycf_ongoing_ok"
    assert journey.external_kyc_form_id == "kycf_ongoing_ok"


@pytest.mark.asyncio
async def test_ensure_kyc_form_clears_bound_failed_modify_ongoing_stub(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"modify-stub-{uuid4()}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    journey = KycJourneyState(
        user_id=user.id,
        kyc_already_registered=True,
        readiness_code="kyc_incomplete",
        pan_verification_status="verified",
        external_kyc_form_id="kycf_failed_stub",
        kyc_form_status="failed",
        kyc_form_type="modify",
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

    failed_stub = {
        "id": "kycf_failed_stub",
        "status": "failed",
        "type": "modify",
        "reason": "An ongoing KYC Form already exists for this PAN",
    }
    ongoing_form = {
        "id": "kycf_real_ongoing",
        "status": "under_review",
        "type": "modify",
    }

    journey.kyc_partner_external_refs_json = [
        {
            "kind": "kyc_form",
            "external_id": "kycf_failed_stub",
            "status": "failed",
            "pan": "EPBPS6369E",
        },
        {
            "kind": "kyc_form",
            "external_id": "kycf_real_ongoing",
            "status": "under_review",
            "pan": "EPBPS6369E",
        },
    ]

    with patch(
        "app.application.kyc.kyc_form_service.fetch_kyc_form",
        new=AsyncMock(
            side_effect=[
                failed_stub,
                ongoing_form,
            ]
        ),
    ), patch(
        "app.application.kyc.kyc_form_service.create_kyc_form",
        new=AsyncMock(),
    ) as create_mock, patch(
        "app.application.kyc.kyc_form_service.poll_kyc_form_until_created",
        new=AsyncMock(),
    ):
        form = await ensure_kyc_form(db_session, user=user, journey=journey)

    create_mock.assert_not_awaited()
    assert form["id"] == "kycf_real_ongoing"
    assert journey.external_kyc_form_id == "kycf_real_ongoing"


def _new_to_kyc_journey(user: User, **overrides: object) -> KycJourneyState:
    payload = {
        "user_id": user.id,
        "kyc_already_registered": False,
        "readiness_code": "kyc_unavailable",
        "pan_verification_status": "verified",
        "pan_draft_json": {
            "panNumber": "ONJPK4703G",
            "firstName": "TEST",
            "lastName": "USER",
            "fullName": "TEST USER",
            "dateOfBirth": "1985-01-01",
        },
    }
    payload.update(overrides)
    return KycJourneyState(**payload)


@pytest.mark.asyncio
async def test_ensure_kyc_form_rebinds_live_form_when_fresh_stub_hits_ongoing(
    db_session,
) -> None:
    user = User(
        id=uuid4(),
        email=f"fresh-exists-{uuid4()}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    journey = _new_to_kyc_journey(user)
    journey.kyc_partner_external_refs_json = [
        {
            "kind": "kyc_form",
            "external_id": "kycf_live_ongoing",
            "status": "failed",
            "pan": "ONJPK4703G",
            "form_type": "fresh",
        },
    ]
    db_session.add(journey)
    await db_session.flush()

    live_form = {
        "id": "kycf_live_ongoing",
        "status": "created",
        "type": "fresh",
        "proof_details": {"status": "pending", "fetch_url": "https://s.finprim.com/proof"},
    }

    with patch(
        "app.application.kyc.kyc_form_service.create_kyc_form",
        new=AsyncMock(
            return_value={"id": "kycf_fresh_fail", "status": "under_review", "type": "fresh"},
        ),
    ) as create_mock, patch(
        "app.application.kyc.kyc_form_service.poll_kyc_form_until_created",
        new=AsyncMock(
            return_value={
                "id": "kycf_fresh_fail",
                "status": "failed",
                "type": "fresh",
                "reason": "An ongoing KYC Form already exists for this PAN",
            },
        ),
    ), patch(
        "app.application.kyc.kyc_form_service.fetch_kyc_form",
        new=AsyncMock(return_value=live_form),
    ):
        form = await ensure_kyc_form(db_session, user=user, journey=journey)

    create_mock.assert_awaited_once()
    assert form["id"] == "kycf_live_ongoing"
    assert journey.external_kyc_form_id == "kycf_live_ongoing"


@pytest.mark.asyncio
async def test_ensure_kyc_form_retries_modify_when_fresh_poll_fails_ineligible(
    db_session,
) -> None:
    user = User(
        id=uuid4(),
        email=f"fresh-ineligible-{uuid4()}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    journey = _new_to_kyc_journey(user)
    db_session.add(journey)
    await db_session.flush()

    with patch(
        "app.application.kyc.kyc_form_service.create_kyc_form",
        new=AsyncMock(
            side_effect=[
                {"id": "kycf_fresh_fail", "status": "under_review", "type": "fresh"},
                {"id": "kycf_modify_ok", "status": "under_review", "type": "modify"},
            ]
        ),
    ) as create_mock, patch(
        "app.application.kyc.kyc_form_service.poll_kyc_form_until_created",
        new=AsyncMock(
            side_effect=[
                {
                    "id": "kycf_fresh_fail",
                    "status": "failed",
                    "type": "fresh",
                    "reason": "ineligible_for_fresh_kyc",
                },
                {
                    "id": "kycf_modify_ok",
                    "status": "created",
                    "type": "modify",
                },
            ]
        ),
    ):
        form = await ensure_kyc_form(db_session, user=user, journey=journey)

    assert create_mock.await_count == 2
    assert create_mock.await_args_list[1].kwargs["form_type"] == "modify"
    assert form["id"] == "kycf_modify_ok"
