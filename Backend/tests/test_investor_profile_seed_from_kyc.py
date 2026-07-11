from __future__ import annotations

import pytest
from sqlalchemy import select

from app.application.investor.investor_profile_seed_service import seed_investor_drafts_from_kyc
from app.infrastructure.persistence.investor_models import (
    InvestorAddress,
    InvestorBankAccount,
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
            "bankName": "HDFC Bank",
            "branch": "Jayanagar",
        },
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
    parties = (await db_session.execute(select(InvestorRelatedParty))).scalars().all()
    assert len(parties) == 1
    assert parties[0].party_relationship == "spouse"
