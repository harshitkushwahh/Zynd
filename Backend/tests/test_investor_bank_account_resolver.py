from __future__ import annotations

from uuid import uuid4

import pytest

from app.application.investor.investor_bank_account_resolver import (
    bank_account_metadata_snapshot,
    resolve_payment_bank_account,
)
from app.application.mf.mf_order_errors import MfOrderError
from app.infrastructure.persistence.investor_models import (
    InvestorBankAccount,
    InvestorBankVerificationStatus,
    InvestorObjectSource,
    InvestorObjectSyncStatus,
    InvestorProfile,
)
from app.infrastructure.persistence.models import User


async def _seed_user(db_session) -> User:
    user = User(
        id=uuid4(),
        email=f"resolver-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()
    db_session.add(InvestorProfile(user_id=user.id))
    await db_session.flush()
    return user


def _bank_row(
    *,
    user_id,
    is_primary: bool = False,
    verified: bool = True,
    external_old_id: int | None = 101,
    external_bank_account_id: str | None = None,
) -> InvestorBankAccount:
    return InvestorBankAccount(
        investor_profile_id=user_id,
        account_number_last4="1234" if external_old_id == 101 else "5678",
        ifsc_code="HDFC0001234" if external_old_id == 101 else "HDFC0005678",
        account_type="savings",
        primary_account_holder_name="Test User",
        bank_name="HDFC Bank",
        is_primary=is_primary,
        source=InvestorObjectSource.kyc,
        verification_status=(
            InvestorBankVerificationStatus.verified
            if verified
            else InvestorBankVerificationStatus.pending
        ),
        sync_status=InvestorObjectSyncStatus.active,
        external_old_id=external_old_id,
        external_bank_account_id=external_bank_account_id
        or (f"bac_test_{external_old_id}" if external_old_id else None),
    )


@pytest.mark.asyncio
async def test_resolve_payment_bank_account_uses_primary(db_session) -> None:
    user = await _seed_user(db_session)
    secondary = _bank_row(user_id=user.id, is_primary=False, external_old_id=102)
    primary = _bank_row(user_id=user.id, is_primary=True, external_old_id=101)
    db_session.add_all([secondary, primary])
    await db_session.flush()

    resolved = await resolve_payment_bank_account(db_session, user_id=user.id)

    assert resolved.id == primary.id


@pytest.mark.asyncio
async def test_resolve_payment_bank_account_explicit_id(db_session) -> None:
    user = await _seed_user(db_session)
    primary = _bank_row(user_id=user.id, is_primary=True, external_old_id=101)
    secondary = _bank_row(user_id=user.id, is_primary=False, external_old_id=102)
    db_session.add_all([primary, secondary])
    await db_session.flush()

    resolved = await resolve_payment_bank_account(
        db_session,
        user_id=user.id,
        bank_account_id=secondary.id,
    )

    assert resolved.id == secondary.id


@pytest.mark.asyncio
async def test_resolve_payment_bank_account_rejects_unverified(db_session) -> None:
    user = await _seed_user(db_session)
    pending = _bank_row(user_id=user.id, verified=False)
    db_session.add(pending)
    await db_session.flush()

    with pytest.raises(MfOrderError) as exc:
        await resolve_payment_bank_account(
            db_session,
            user_id=user.id,
            bank_account_id=pending.id,
        )

    assert exc.value.code == "bank_not_verified"


@pytest.mark.asyncio
async def test_resolve_payment_bank_account_rejects_disabled(db_session) -> None:
    user = await _seed_user(db_session)
    disabled = _bank_row(user_id=user.id, is_primary=False, external_old_id=102)
    disabled.metadata_json = {"disabled": True}
    db_session.add(disabled)
    await db_session.flush()

    with pytest.raises(MfOrderError) as exc:
        await resolve_payment_bank_account(
            db_session,
            user_id=user.id,
            bank_account_id=disabled.id,
        )

    assert exc.value.code == "bank_account_not_found"


@pytest.mark.asyncio
async def test_bank_account_metadata_snapshot_masks_account() -> None:
    bank = _bank_row(user_id=uuid4(), is_primary=True)
    bank.id = uuid4()

    snapshot = bank_account_metadata_snapshot(bank)

    assert snapshot["investor_bank_account_id"] == str(bank.id)
    assert snapshot["payout_bank_account_masked"] == "•••• 1234"
    assert snapshot["payout_bank_ifsc_code"] == "HDFC0001234"
    assert snapshot["payout_bank_name"] == "HDFC Bank"
