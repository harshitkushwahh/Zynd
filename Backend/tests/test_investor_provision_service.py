from __future__ import annotations

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.application.investor.investor_profile_seed_service import seed_investor_drafts_from_kyc
from app.application.investor.investor_provision_service import provision_investor_profile
from app.infrastructure.persistence.investor_models import (
    InvestorBankAccount,
    InvestorProfileStatus,
    InvestorProvisionTrigger,
    InvestorObjectSyncStatus,
)
from app.infrastructure.persistence.models import KycJourneyState, User


@pytest.mark.asyncio
async def test_provision_investor_profile_marks_active(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"provision-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()

    journey = KycJourneyState(
        user_id=user.id,
        pan_draft_json={
            "panNumber": "ABCDE1234F",
            "dateOfBirth": "1990-05-01",
            "firstName": "Test",
            "lastName": "User",
        },
        personal_draft_json={
            "gender": "male",
            "occupation": "professional",
            "incomeSlab": "above_1lakh_upto_5lakh",
            "pepExposed": "not_applicable",
            "placeOfBirth": "Delhi",
        },
        contact_draft_json={
            "permanent": {
                "line1": "1 Test Street",
                "city": "Delhi",
                "state": "Delhi",
                "pincode": "110001",
                "country": "India",
            },
            "sameAsPermanent": True,
        },
        bank_draft_json={
            "accountNumber": "123456789012",
            "ifscCode": "HDFC0001234",
            "accountType": "Savings",
            "accountHolderName": "Test User",
            "panAccountHolderName": "Test User",
        },
    )
    db_session.add(journey)
    await db_session.flush()

    profile = await seed_investor_drafts_from_kyc(db_session, user=user, journey=journey)
    profile.provision_trigger = InvestorProvisionTrigger.mf_order
    await db_session.flush()

    fp_results = {
        "profile": {"id": "invp_test_001", "old_id": 101, "raw": {"id": "invp_test_001", "old_id": 101}},
        "bank": {"id": "bac_test_001", "old_id": 55, "raw": {"id": "bac_test_001", "old_id": 55}},
        "address": {"id": "addr_test_001", "raw": {"id": "addr_test_001"}},
        "email": {"id": "email_test_001", "raw": {"id": "email_test_001"}},
        "phone": {"id": "phone_test_001", "raw": {"id": "phone_test_001"}},
    }

    with (
        patch("app.application.investor.investor_provision_service.get_settings") as mock_settings,
        patch(
            "app.application.investor.investor_provision_service.create_investor_profile",
            new=AsyncMock(return_value=fp_results["profile"]),
        ),
        patch(
            "app.application.investor.investor_provision_service.create_bank_account",
            new=AsyncMock(return_value=fp_results["bank"]),
        ),
        patch(
            "app.application.investor.investor_provision_service.create_address",
            new=AsyncMock(return_value=fp_results["address"]),
        ),
        patch(
            "app.application.investor.investor_provision_service.create_email_address",
            new=AsyncMock(return_value=fp_results["email"]),
        ),
        patch(
            "app.application.investor.investor_provision_service.create_phone_number",
            new=AsyncMock(return_value=fp_results["phone"]),
        ),
    ):
        mock_settings.return_value.resolved_fp_enabled = True
        changed = await provision_investor_profile(db_session, user_id=user.id)

    assert changed is True
    await db_session.refresh(profile)
    assert profile.status == InvestorProfileStatus.active
    assert profile.external_profile_id == "invp_test_001"
    assert profile.external_old_id == 101

    bank = (
        await db_session.execute(select(InvestorBankAccount).where(InvestorBankAccount.investor_profile_id == user.id))
    ).scalar_one()
    assert bank.sync_status == InvestorObjectSyncStatus.active
    assert bank.external_bank_account_id == "bac_test_001"
    assert bank.external_old_id == 55
