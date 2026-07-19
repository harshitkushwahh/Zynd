from __future__ import annotations

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.application.investor.investor_bank_account_crypto import read_account_number
from app.application.investor.investor_bank_account_errors import InvestorBankAccountError
from app.application.investor.investor_bank_account_service import (
    disable_bank_account,
    is_bank_account_disabled,
    list_user_bank_accounts,
    set_primary_bank_account,
    verify_and_add_bank_account,
)
from app.application.kyc.bank_verification_core import HybridBankVerificationOutcome
from app.infrastructure.persistence.investor_models import (
    InvestorBankAccount,
    InvestorBankVerificationStatus,
    InvestorObjectSource,
    InvestorObjectSyncStatus,
    InvestorProfile,
)
from app.infrastructure.persistence.models import KycJourneyState, User


def _verification_outcome(**overrides) -> HybridBankVerificationOutcome:
    base = {
        "poa_result": {"id": "pv_test"},
        "preverify_id": "pv_test",
        "bank_verified": True,
        "pan_verified": True,
        "readiness_verified": True,
        "requires_manual": False,
        "requires_proof_upload": False,
        "failure": None,
        "display_holder_name": "Test User",
        "pan_holder_name": "Test User",
        "bank_name": "HDFC Bank",
        "branch": "Jayanagar",
        "poa_account_type": "savings",
        "account_number": "123456789012",
        "ifsc_code": "HDFC0001234",
        "account_type_label": "Savings",
    }
    base.update(overrides)
    return HybridBankVerificationOutcome(**base)


@pytest.mark.asyncio
async def test_verify_and_add_bank_account_creates_primary_row(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"bank-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()

    db_session.add(
        KycJourneyState(
            user_id=user.id,
            pan_draft_json={"panNumber": "ABCDE1234F", "fullName": "Test User"},
        )
    )
    db_session.add(InvestorProfile(user_id=user.id))
    await db_session.flush()

    with patch(
        "app.application.investor.investor_bank_account_service.run_hybrid_bank_verification",
        new=AsyncMock(return_value=_verification_outcome()),
    ), patch(
        "app.application.investor.investor_bank_account_service._provision_bank_account_if_ready",
        new=AsyncMock(),
    ):
        result = await verify_and_add_bank_account(
            db_session,
            user=user,
            account_number="123456789012",
            account_type="Savings",
            ifsc_code="HDFC0001234",
        )

    assert result["bank_verified"] is True
    assert result["is_primary"] is True
    banks = (await db_session.execute(select(InvestorBankAccount))).scalars().all()
    assert len(banks) == 1
    assert banks[0].verification_status == InvestorBankVerificationStatus.verified
    assert read_account_number(banks[0]) == "123456789012"


@pytest.mark.asyncio
async def test_verify_and_add_bank_account_rejects_duplicate_verified(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"bank-dup-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()
    db_session.add(
        KycJourneyState(
            user_id=user.id,
            pan_draft_json={"panNumber": "ABCDE1234F", "fullName": "Test User"},
        )
    )
    db_session.add(InvestorProfile(user_id=user.id))
    db_session.add(
        InvestorBankAccount(
            investor_profile_id=user.id,
            is_primary=True,
            account_type="savings",
            account_number_last4="9012",
            ifsc_code="HDFC0001234",
            primary_account_holder_name="Test User",
            verification_status=InvestorBankVerificationStatus.verified,
            source=InvestorObjectSource.kyc,
            sync_status=InvestorObjectSyncStatus.draft,
        )
    )
    await db_session.flush()

    with pytest.raises(InvestorBankAccountError) as exc:
        await verify_and_add_bank_account(
            db_session,
            user=user,
            account_number="123456789012",
            account_type="Savings",
            ifsc_code="HDFC0001234",
        )
    assert exc.value.code == "bank_account_exists"


@pytest.mark.asyncio
async def test_list_user_bank_accounts_returns_masked_rows(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"bank-list-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()
    db_session.add(
        KycJourneyState(
            user_id=user.id,
            pan_draft_json={"panNumber": "ABCDE1234F", "fullName": "Test User"},
        )
    )
    db_session.add(
        InvestorBankAccount(
            investor_profile_id=user.id,
            is_primary=True,
            account_type="savings",
            account_number_last4="9012",
            ifsc_code="HDFC0001234",
            primary_account_holder_name="Test User",
            verification_status=InvestorBankVerificationStatus.verified,
            source=InvestorObjectSource.kyc,
            sync_status=InvestorObjectSyncStatus.draft,
        )
    )
    await db_session.flush()

    rows = await list_user_bank_accounts(db_session, user_id=user.id)
    assert len(rows) == 1
    assert rows[0]["account_number_masked"] == "•••• 9012"
    assert rows[0]["is_primary"] is True


@pytest.mark.asyncio
async def test_set_primary_bank_account_switches_primary(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"bank-primary-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()
    db_session.add(
        KycJourneyState(
            user_id=user.id,
            pan_draft_json={"panNumber": "ABCDE1234F", "fullName": "Test User"},
        )
    )

    first = InvestorBankAccount(
        investor_profile_id=user.id,
        is_primary=True,
        account_type="savings",
        account_number_last4="9012",
        ifsc_code="HDFC0001234",
        primary_account_holder_name="Test User",
        verification_status=InvestorBankVerificationStatus.verified,
        source=InvestorObjectSource.kyc,
        sync_status=InvestorObjectSyncStatus.active,
        external_bank_account_id="bac_1",
    )
    second = InvestorBankAccount(
        investor_profile_id=user.id,
        is_primary=False,
        account_type="savings",
        account_number_last4="4321",
        ifsc_code="ICIC0001234",
        primary_account_holder_name="Test User",
        verification_status=InvestorBankVerificationStatus.verified,
        source=InvestorObjectSource.user,
        sync_status=InvestorObjectSyncStatus.active,
        external_bank_account_id="bac_2",
    )
    db_session.add_all([first, second])
    await db_session.flush()

    with patch(
        "app.application.investor.investor_bank_account_service.refresh_mfia_payout_bank_account",
        new=AsyncMock(return_value=True),
    ):
        result = await set_primary_bank_account(
            db_session,
            user_id=user.id,
            bank_account_id=second.id,
        )

    assert result["is_primary"] is True
    refreshed_first = await db_session.get(InvestorBankAccount, first.id)
    refreshed_second = await db_session.get(InvestorBankAccount, second.id)
    assert refreshed_first is not None and refreshed_first.is_primary is False
    assert refreshed_second is not None and refreshed_second.is_primary is True


@pytest.mark.asyncio
async def test_disable_bank_account_hides_from_list(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"bank-disable-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()
    db_session.add(
        KycJourneyState(
            user_id=user.id,
            pan_draft_json={"panNumber": "ABCDE1234F", "fullName": "Test User"},
        )
    )
    primary = InvestorBankAccount(
        investor_profile_id=user.id,
        is_primary=True,
        account_type="savings",
        account_number_last4="9012",
        ifsc_code="HDFC0001234",
        primary_account_holder_name="Test User",
        verification_status=InvestorBankVerificationStatus.verified,
        source=InvestorObjectSource.kyc,
        sync_status=InvestorObjectSyncStatus.active,
        external_bank_account_id="bac_primary",
        external_old_id=1,
    )
    secondary = InvestorBankAccount(
        investor_profile_id=user.id,
        is_primary=False,
        account_type="savings",
        account_number_last4="4321",
        ifsc_code="ICIC0001234",
        primary_account_holder_name="Test User",
        verification_status=InvestorBankVerificationStatus.verified,
        source=InvestorObjectSource.user,
        sync_status=InvestorObjectSyncStatus.active,
        external_bank_account_id="bac_secondary",
        external_old_id=2,
    )
    db_session.add_all([primary, secondary])
    await db_session.flush()

    await disable_bank_account(db_session, user_id=user.id, bank_account_id=secondary.id)

    rows = await list_user_bank_accounts(db_session, user_id=user.id)
    assert len(rows) == 1
    assert rows[0]["account_number_last4"] == "9012"
    refreshed = await db_session.get(InvestorBankAccount, secondary.id)
    assert refreshed is not None
    assert is_bank_account_disabled(refreshed)


@pytest.mark.asyncio
async def test_disable_bank_account_rejects_primary(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"bank-disable-primary-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()
    db_session.add(
        KycJourneyState(
            user_id=user.id,
            pan_draft_json={"panNumber": "ABCDE1234F", "fullName": "Test User"},
        )
    )
    primary = InvestorBankAccount(
        investor_profile_id=user.id,
        is_primary=True,
        account_type="savings",
        account_number_last4="9012",
        ifsc_code="HDFC0001234",
        primary_account_holder_name="Test User",
        verification_status=InvestorBankVerificationStatus.verified,
        source=InvestorObjectSource.kyc,
        sync_status=InvestorObjectSyncStatus.active,
    )
    db_session.add(primary)
    await db_session.flush()

    with pytest.raises(InvestorBankAccountError) as exc:
        await disable_bank_account(db_session, user_id=user.id, bank_account_id=primary.id)

    assert exc.value.code == "cannot_disable_primary"
