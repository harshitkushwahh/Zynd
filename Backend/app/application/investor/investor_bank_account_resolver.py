"""Resolve verified investor bank accounts for MF payments and mandates."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.investor.investor_bank_account_service import is_bank_account_disabled
from app.application.mf.mf_order_errors import MfOrderError
from app.infrastructure.persistence.investor_models import (
    InvestorBankAccount,
    InvestorBankVerificationStatus,
    InvestorObjectSyncStatus,
)


async def resolve_payment_bank_account(
    session: AsyncSession,
    *,
    user_id: UUID,
    bank_account_id: UUID | None = None,
) -> InvestorBankAccount:
    if bank_account_id is not None:
        bank = await session.scalar(
            select(InvestorBankAccount).where(
                InvestorBankAccount.id == bank_account_id,
                InvestorBankAccount.investor_profile_id == user_id,
            )
        )
        if not bank:
            raise MfOrderError(
                code="bank_account_not_found",
                message="Bank account not found.",
                status_code=404,
            )
        if is_bank_account_disabled(bank):
            raise MfOrderError(
                code="bank_account_not_found",
                message="Bank account not found.",
                status_code=404,
            )
        if bank.verification_status != InvestorBankVerificationStatus.verified:
            raise MfOrderError(
                code="bank_not_verified",
                message="Select a verified bank account for this payment.",
                status_code=400,
            )
        if bank.sync_status != InvestorObjectSyncStatus.active or bank.external_old_id is None:
            raise MfOrderError(
                code="bank_not_ready",
                message="Selected bank account is not ready for payments yet.",
                status_code=409,
            )
        return bank

    bank = await session.scalar(
        select(InvestorBankAccount).where(
            InvestorBankAccount.investor_profile_id == user_id,
            InvestorBankAccount.is_primary.is_(True),
            InvestorBankAccount.verification_status == InvestorBankVerificationStatus.verified,
            InvestorBankAccount.sync_status == InvestorObjectSyncStatus.active,
            InvestorBankAccount.external_old_id.is_not(None),
        )
    )
    if not bank:
        bank = await session.scalar(
            select(InvestorBankAccount).where(
                InvestorBankAccount.investor_profile_id == user_id,
                InvestorBankAccount.verification_status == InvestorBankVerificationStatus.verified,
                InvestorBankAccount.sync_status == InvestorObjectSyncStatus.active,
                InvestorBankAccount.external_old_id.is_not(None),
            )
            .order_by(InvestorBankAccount.is_primary.desc(), InvestorBankAccount.created_at.asc())
        )
    if not bank or bank.external_old_id is None or is_bank_account_disabled(bank):
        raise MfOrderError(
            code="bank_not_ready",
            message="Add and verify a bank account before investing.",
            status_code=409,
        )
    return bank


def bank_account_metadata_snapshot(bank: InvestorBankAccount) -> dict[str, str]:
    return {
        "investor_bank_account_id": str(bank.id),
        "payout_bank_account_masked": f"•••• {bank.account_number_last4}",
        "payout_bank_ifsc_code": bank.ifsc_code,
        "payout_bank_name": bank.bank_name or "",
    }


async def load_bank_account_by_old_id(
    session: AsyncSession,
    *,
    user_id: UUID,
    bank_account_old_id: int,
) -> InvestorBankAccount | None:
    return await session.scalar(
        select(InvestorBankAccount).where(
            InvestorBankAccount.investor_profile_id == user_id,
            InvestorBankAccount.external_old_id == bank_account_old_id,
        )
    )


async def load_mandate_bank_account(
    session: AsyncSession,
    *,
    user_id: UUID,
    mandate,
) -> InvestorBankAccount | None:
    if mandate.investor_bank_account_id is not None:
        bank = await session.get(InvestorBankAccount, mandate.investor_bank_account_id)
        if (
            bank is not None
            and bank.investor_profile_id == user_id
            and not is_bank_account_disabled(bank)
        ):
            return bank

    return await load_bank_account_by_old_id(
        session,
        user_id=user_id,
        bank_account_old_id=mandate.bank_account_old_id,
    )


__all__ = [
    "bank_account_metadata_snapshot",
    "load_bank_account_by_old_id",
    "load_mandate_bank_account",
    "resolve_payment_bank_account",
]
