from __future__ import annotations

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.application.investor.investor_nominee_sync_service import sync_nominees_from_kyc_draft
from app.application.investor.investor_provision_mapper import build_early_investor_profile_payload
from app.application.kyc.pan_verification_service import confirm_pan_names
from app.infrastructure.persistence.investor_models import (
    InvestorProfile,
    InvestorProfileStatus,
    InvestorRelatedParty,
)
from app.infrastructure.persistence.models import KycJourneyState, User


def test_build_early_investor_profile_payload_uses_pan_defaults() -> None:
    user = User(id=uuid4(), email="early@example.com", phone="+919876543210", password_hash="hash")
    journey = KycJourneyState(
        user_id=user.id,
        pan_verification_status="verified",
        pan_draft_json={
            "panNumber": "ABCDE1234F",
            "dateOfBirth": "1990-05-01",
            "firstName": "Asha",
            "lastName": "Patel",
            "fullName": "Asha Patel",
        },
    )
    payload = build_early_investor_profile_payload(user=user, journey=journey)
    assert payload["pan"] == "ABCDE1234F"
    assert payload["name"] == "Asha Patel"
    assert payload["gender"] == "male"
    assert payload["occupation"] == "others"


@pytest.mark.asyncio
async def test_confirm_pan_names_creates_local_investor_profile(db_session) -> None:
    user = User(email="pan-early@example.com", first_name="Test", last_name="User")
    db_session.add(user)
    await db_session.flush()

    journey = KycJourneyState(
        user_id=user.id,
        pan_verification_status="verified",
        pan_draft_json={
            "panNumber": "EPBPS6369E",
            "firstName": "POOJA",
            "lastName": "DHAMELIYA",
            "middleName": "",
            "fullName": "POOJA DHAMELIYA",
            "dateOfBirth": "1990-02-19",
            "panCategory": "individual",
        },
        poa_pan_preverify_id="pv_existing",
    )
    db_session.add(journey)
    await db_session.flush()

    with patch("app.application.investor.investor_early_provision_service.get_settings") as settings_mock:
        settings_mock.return_value.resolved_fp_enabled = False
        result = await confirm_pan_names(
            db_session,
            user=user,
            first_name="POOJA",
            middle_name="",
            last_name="DHAMELIYA",
        )

    assert result["success"] is True
    profile = await db_session.scalar(select(InvestorProfile).where(InvestorProfile.user_id == user.id))
    assert profile is not None
    assert profile.external_profile_id is not None
    assert profile.status == InvestorProfileStatus.active


@pytest.mark.asyncio
async def test_sync_nominees_from_kyc_draft_creates_related_party_rows(db_session) -> None:
    user = User(email=f"nominee-{uuid4()}@example.com", first_name="Test", last_name="User")
    db_session.add(user)
    await db_session.flush()

    journey = KycJourneyState(
        user_id=user.id,
        pan_verification_status="verified",
        pan_draft_json={
            "panNumber": "ABCDE1234F",
            "firstName": "Test",
            "lastName": "User",
            "fullName": "Test User",
            "dateOfBirth": "1990-01-01",
        },
        nominee_draft_json=[
            {
                "id": "nom-1",
                "core": {
                    "fullName": "Nominee One",
                    "relationship": "spouse",
                    "sharePercent": "100",
                    "dateOfBirth": "1992-03-04",
                },
                "identity": {"documentType": "pan", "documentNumber": "ABCPA3753D"},
                "contact": {"email": "nominee@example.com", "mobile": "9876543210"},
                "address": {
                    "line1": "12 MG Road",
                    "city": "Bengaluru",
                    "pincode": "560001",
                    "country": "in",
                },
            }
        ],
    )
    db_session.add(journey)
    await db_session.flush()

    create_party = AsyncMock(return_value={"id": "relp_test_001", "raw": {"id": "relp_test_001"}})
    patch_party = AsyncMock(return_value={"id": "relp_test_001", "raw": {"id": "relp_test_001"}})

    with (
        patch("app.application.investor.investor_nominee_sync_service.get_settings") as settings_mock,
        patch(
            "app.application.investor.investor_early_provision_service.create_investor_profile",
            new=AsyncMock(return_value={"id": "invp_test_001", "old_id": 1}),
        ),
        patch("app.application.investor.investor_early_provision_service.get_settings") as early_settings,
        patch("app.application.investor.investor_nominee_sync_service.create_related_party", new=create_party),
        patch("app.application.investor.investor_nominee_sync_service.patch_related_party", new=patch_party),
    ):
        settings_mock.return_value.resolved_fp_enabled = True
        early_settings.return_value.resolved_fp_enabled = True
        profile = await sync_nominees_from_kyc_draft(db_session, user=user, journey=journey)

    assert profile.external_profile_id == "invp_test_001"
    parties = list((await db_session.execute(select(InvestorRelatedParty))).scalars())
    assert len(parties) == 1
    assert parties[0].external_related_party_id == "relp_test_001"
    create_party.assert_awaited_once()
    patch_party.assert_awaited_once()
