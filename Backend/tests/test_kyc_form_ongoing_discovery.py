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


@pytest.mark.asyncio
async def test_ensure_kyc_form_skips_create_after_archived_ongoing_conflict(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"skip-create-{uuid4()}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    journey = KycJourneyState(
        user_id=user.id,
        kyc_already_registered=False,
        readiness_code="kyc_onhold",
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
                "external_id": "kycf_stub_ed7948169d1e4184",
                "status": "archived",
                "archived": True,
                "archive_reason": "failed_after_create",
                "pan": "ONJPK4703G",
            },
        ],
    )
    db_session.add(journey)
    await db_session.flush()

    failed = {
        "id": "kycf_old_failed",
        "status": "failed",
        "type": "modify",
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
    assert "kyc_onhold" in exc.value.message.lower() or "on hold" in exc.value.message.lower()


@pytest.mark.asyncio
async def test_discover_rebinds_expired_kra_form_when_proof_fetched(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"expired-proof-{uuid4()}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    journey = KycJourneyState(
        user_id=user.id,
        kyc_already_registered=False,
        readiness_code="kyc_onhold",
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
                "external_id": "kycf_expired_proof",
                "status": "expired",
                "pan": "ONJPK4703G",
                "proof_status": "fetched",
            },
        ],
    )
    db_session.add(journey)
    await db_session.flush()

    expired_with_proof = {
        "id": "kycf_expired_proof",
        "status": "expired",
        "type": "modify",
        "proof_details": {"status": "fetched", "fetch_url": "https://s.finprim.com/proof"},
        "esign_details": {"status": "pending"},
    }

    with patch(
        "app.application.kyc.kyc_form_service.fetch_kyc_form",
        new=AsyncMock(return_value=expired_with_proof),
    ), patch(
        "app.application.kyc.kyc_form_service.create_kyc_form",
        new=AsyncMock(),
    ) as create_mock:
        form = await ensure_kyc_form(db_session, user=user, journey=journey)

    create_mock.assert_not_awaited()
    assert form["id"] == "kycf_expired_proof"
    assert journey.external_kyc_form_id == "kycf_expired_proof"


@pytest.mark.asyncio
async def test_ensure_kyc_form_rebinds_bound_fresh_expired_form_when_proof_fetched(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"bound-fresh-{uuid4()}@example.com",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    journey = KycJourneyState(
        user_id=user.id,
        kyc_already_registered=False,
        readiness_code="kyc_onhold",
        pan_verification_status="verified",
        external_kyc_form_id="kycf_be6ac80a41534b80911f9d276c698d21",
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
                "external_id": "kycf_be6ac80a41534b80911f9d276c698d21",
                "status": "expired",
                "pan": "ONJPK4703G",
                "proof_status": "fetched",
                "archived": True,
                "archive_reason": "failed_after_create",
            },
        ],
    )
    db_session.add(journey)
    await db_session.flush()

    expired_fresh = {
        "id": "kycf_be6ac80a41534b80911f9d276c698d21",
        "status": "expired",
        "type": "fresh",
        "proof_details": {"status": "fetched", "fetch_url": "https://s.finprim.com/proof"},
        "esign_details": {"status": "pending", "esign_url": "https://s.finprim.com/esign"},
    }

    with patch(
        "app.application.kyc.kyc_form_service.fetch_kyc_form",
        new=AsyncMock(return_value=expired_fresh),
    ), patch(
        "app.application.kyc.kyc_form_service.create_kyc_form",
        new=AsyncMock(),
    ) as create_mock:
        form = await ensure_kyc_form(db_session, user=user, journey=journey)

    create_mock.assert_not_awaited()
    assert form["id"] == "kycf_be6ac80a41534b80911f9d276c698d21"
    assert journey.external_kyc_form_id == "kycf_be6ac80a41534b80911f9d276c698d21"
