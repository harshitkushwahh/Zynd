from __future__ import annotations

import pytest
from sqlalchemy import select

from app.application.investor.investor_bank_account_crypto import read_account_number
from app.application.investor.investor_profile_seed_service import seed_investor_drafts_from_kyc
from app.infrastructure.persistence.investor_models import (
    InvestorAddress,
    InvestorBankAccount,
    InvestorBankVerificationStatus,
    InvestorEmailAddress,
    InvestorRelatedParty,
)
from app.infrastructure.persistence.models import KycJourneyState, User


@pytest.mark.asyncio
async def test_seed_investor_drafts_from_kyc(db_session) -> None:
    from uuid import uuid4

    user = User(
        id=uuid4(),
        email=f"seed-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()

    journey = KycJourneyState(
        user_id=user.id,
        contact_draft_json={
            "permanent": {
                "line1": "12 MG Road",
                "city": "Bengaluru",
                "state": "Karnataka",
                "pincode": "560001",
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
            "bankName": "HDFC Bank",
            "branch": "Jayanagar",
            "poaAccountType": "savings",
            "readinessVerified": True,
        },
        poa_bank_preverify_id="pv_test_123",
        bank_verification_status="verified",
        nominee_draft_json=[
            {
                "id": "nom-1",
                "core": {
                    "fullName": "Nominee One",
                    "relationship": "spouse",
                    "sharePercent": "100",
                    "dateOfBirth": "1990-01-01",
                },
                "identity": {"documentType": "pan", "documentNumber": "ABCDE1234F"},
            }
        ],
    )
    db_session.add(journey)
    await db_session.flush()

    profile = await seed_investor_drafts_from_kyc(db_session, user=user, journey=journey)

    assert profile.user_id == user.id
    emails = (await db_session.execute(select(InvestorEmailAddress))).scalars().all()
    assert len(emails) == 1
    addresses = (await db_session.execute(select(InvestorAddress))).scalars().all()
    assert len(addresses) == 1
    banks = (await db_session.execute(select(InvestorBankAccount))).scalars().all()
    assert len(banks) == 1
    assert banks[0].account_number_last4 == "9012"
    assert banks[0].poa_preverify_id == "pv_test_123"
    assert banks[0].pan_account_holder_name == "Test User"
    assert banks[0].verification_status == InvestorBankVerificationStatus.verified
    assert read_account_number(banks[0]) == "123456789012"
    assert banks[0].metadata_json == {
        "seededFrom": "kyc",
        "readinessVerified": True,
        "poaAccountType": "savings",
    }
    parties = (await db_session.execute(select(InvestorRelatedParty))).scalars().all()
    assert len(parties) == 1
    assert parties[0].party_relationship == "spouse"


@pytest.mark.asyncio
async def test_seed_investor_drafts_enriches_existing_bank_without_ciphertext(db_session) -> None:
    from uuid import uuid4

    from app.infrastructure.persistence.investor_models import (
        InvestorObjectSource,
        InvestorObjectSyncStatus,
        InvestorProfile,
        InvestorProvisionTrigger,
    )

    user = User(
        id=uuid4(),
        email=f"seed-enrich-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()

    profile = InvestorProfile(
        user_id=user.id,
        provision_trigger=InvestorProvisionTrigger.manual,
    )
    db_session.add(profile)
    await db_session.flush()

    journey = KycJourneyState(
        user_id=user.id,
        bank_draft_json={
            "accountNumber": "123456789012",
            "ifscCode": "HDFC0001234",
            "accountType": "Savings",
            "accountHolderName": "Test User",
            "panAccountHolderName": "Test User",
        },
        poa_bank_preverify_id="pv_existing",
        bank_verification_status="verified",
    )
    db_session.add(journey)

    existing_bank = InvestorBankAccount(
        investor_profile_id=user.id,
        is_primary=True,
        account_type="savings",
        account_number_last4="9012",
        ifsc_code="HDFC0001234",
        primary_account_holder_name="Test User",
        source=InvestorObjectSource.kyc,
        sync_status=InvestorObjectSyncStatus.draft,
    )
    db_session.add(existing_bank)
    await db_session.flush()

    await seed_investor_drafts_from_kyc(db_session, user=user, journey=journey)

    banks = (await db_session.execute(select(InvestorBankAccount))).scalars().all()
    assert len(banks) == 1
    assert banks[0].poa_preverify_id == "pv_existing"
    assert banks[0].verification_status == InvestorBankVerificationStatus.verified
    assert read_account_number(banks[0]) == "123456789012"
