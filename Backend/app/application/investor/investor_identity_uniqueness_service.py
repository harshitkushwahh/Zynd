from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.investor.investor_bank_account_crypto import read_account_number
from app.infrastructure.persistence.investor_models import (
    InvestorBankAccount,
    InvestorBankVerificationStatus,
)
from app.infrastructure.persistence.models import KycJourneyState, User, UserStatus


class InvestorIdentityConflictError(Exception):
    def __init__(self, message: str, code: str, status_code: int = 409) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


def _account_last4(account_number: str) -> str:
    digits = account_number.strip()
    return digits[-4:] if len(digits) >= 4 else digits


async def find_user_id_by_pan(
    db: AsyncSession,
    *,
    pan_number: str,
    exclude_user_id: UUID | None = None,
) -> UUID | None:
    pan = pan_number.upper().strip()
    if len(pan) != 10:
        return None

    query = select(KycJourneyState.user_id).where(
        KycJourneyState.pan_draft_json["panNumber"].astext == pan
    )
    if exclude_user_id is not None:
        query = query.where(KycJourneyState.user_id != exclude_user_id)

    result = await db.execute(query.limit(1))
    return result.scalar_one_or_none()


async def assert_pan_not_used_by_other_user(
    db: AsyncSession,
    *,
    pan_number: str,
    user_id: UUID,
) -> None:
    owner_id = await find_user_id_by_pan(db, pan_number=pan_number, exclude_user_id=user_id)
    if owner_id is None:
        return
    raise InvestorIdentityConflictError(
        "This PAN is already linked to another Zynd investor account.",
        "pan_already_registered",
        409,
    )


async def find_user_id_by_bank_account(
    db: AsyncSession,
    *,
    account_number: str,
    ifsc_code: str,
    exclude_user_id: UUID | None = None,
) -> UUID | None:
    account_no = account_number.strip()
    ifsc = ifsc_code.strip().upper()
    if not account_no or len(ifsc) < 4:
        return None

    last4 = _account_last4(account_no)
    result = await db.execute(
        select(InvestorBankAccount).where(
            InvestorBankAccount.account_number_last4 == last4,
            InvestorBankAccount.ifsc_code == ifsc,
            InvestorBankAccount.verification_status == InvestorBankVerificationStatus.verified,
        )
    )
    rows = list(result.scalars())
    for row in rows:
        if exclude_user_id is not None and row.investor_profile_id == exclude_user_id:
            continue
        stored = read_account_number(row)
        if stored and stored.strip() == account_no:
            return row.investor_profile_id
    return None


async def assert_bank_not_used_by_other_user(
    db: AsyncSession,
    *,
    account_number: str,
    ifsc_code: str,
    user_id: UUID,
) -> None:
    owner_id = await find_user_id_by_bank_account(
        db,
        account_number=account_number,
        ifsc_code=ifsc_code,
        exclude_user_id=user_id,
    )
    if owner_id is None:
        return
    raise InvestorIdentityConflictError(
        "This bank account is already linked to another Zynd investor account.",
        "bank_already_registered",
        409,
    )


async def assert_email_available_for_new_investor(db: AsyncSession, email: str) -> None:
    normalized = email.lower().strip()
    result = await db.execute(
        select(User.id).where(User.email == normalized, User.status != UserStatus.deleted)
    )
    if result.scalar_one_or_none():
        raise InvestorIdentityConflictError(
            "An investor account with this email already exists on Zynd.",
            "email_already_registered",
            409,
        )


async def assert_phone_available_for_new_investor(db: AsyncSession, phone: str) -> None:
    result = await db.execute(
        select(User.id).where(User.phone == phone, User.status != UserStatus.deleted)
    )
    if result.scalar_one_or_none():
        raise InvestorIdentityConflictError(
            "This mobile number is already linked to another Zynd investor account.",
            "phone_already_registered",
            409,
        )
