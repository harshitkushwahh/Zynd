"""Build and apply Finprim MFIA folio_defaults from provisioned investor objects."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.mf.fp_oms_client import update_mf_investment_account
from app.infrastructure.persistence.investor_models import (
    InvestorAddress,
    InvestorBankAccount,
    InvestorEmailAddress,
    InvestorObjectSyncStatus,
    InvestorPhoneNumber,
    InvestorProfile,
    InvestorRelatedParty,
)
from app.infrastructure.persistence.mf_transaction_models import MfInvestmentAccount

logger = logging.getLogger(__name__)


def _primary_email(emails: list[InvestorEmailAddress]) -> InvestorEmailAddress | None:
    for row in emails:
        if row.is_primary and row.external_email_id and row.sync_status == InvestorObjectSyncStatus.active:
            return row
    for row in emails:
        if row.external_email_id and row.sync_status == InvestorObjectSyncStatus.active:
            return row
    return None


def _primary_phone(phones: list[InvestorPhoneNumber]) -> InvestorPhoneNumber | None:
    for row in phones:
        if row.is_primary and row.external_phone_id and row.sync_status == InvestorObjectSyncStatus.active:
            return row
    for row in phones:
        if row.external_phone_id and row.sync_status == InvestorObjectSyncStatus.active:
            return row
    return None


def _primary_address(addresses: list[InvestorAddress]) -> InvestorAddress | None:
    for row in addresses:
        if row.is_primary and row.external_address_id and row.sync_status == InvestorObjectSyncStatus.active:
            return row
    for row in addresses:
        if row.nature != "correspondence" and row.external_address_id and row.sync_status == InvestorObjectSyncStatus.active:
            return row
    return None


def _primary_bank(banks: list[InvestorBankAccount]) -> InvestorBankAccount | None:
    for row in banks:
        if row.is_primary and row.external_bank_account_id and row.sync_status == InvestorObjectSyncStatus.active:
            return row
    for row in banks:
        if row.external_bank_account_id and row.sync_status == InvestorObjectSyncStatus.active:
            return row
    return None


def build_folio_defaults(profile: InvestorProfile) -> dict[str, Any]:
    folio_defaults: dict[str, Any] = {}

    email = _primary_email(profile.email_addresses)
    phone = _primary_phone(profile.phone_numbers)
    address = _primary_address(profile.addresses)
    bank = _primary_bank(profile.bank_accounts)

    if email:
        folio_defaults["communication_email_address"] = email.external_email_id
    if phone:
        folio_defaults["communication_mobile_number"] = phone.external_phone_id
    if address:
        folio_defaults["communication_address"] = address.external_address_id
    if bank:
        folio_defaults["payout_bank_account"] = bank.external_bank_account_id

    nominees = [
        party
        for party in profile.related_parties
        if party.external_related_party_id and party.sync_status == InvestorObjectSyncStatus.active
    ]
    nominees.sort(key=lambda row: row.created_at)
    for index, party in enumerate(nominees[:3], start=1):
        folio_defaults[f"nominee{index}"] = party.external_related_party_id
        if party.share_percent is not None:
            folio_defaults[f"nominee{index}_allocation_percentage"] = int(party.share_percent)

    return folio_defaults


async def ensure_mfia_folio_defaults(
    session: AsyncSession,
    *,
    user_id,
    mfia: MfInvestmentAccount,
) -> bool:
    if not mfia.fp_mfia_id:
        return False

    metadata = mfia.metadata_ or {}
    if metadata.get("folio_defaults_set"):
        return True

    profile = await session.scalar(
        select(InvestorProfile)
        .where(InvestorProfile.user_id == user_id)
        .options(
            selectinload(InvestorProfile.email_addresses),
            selectinload(InvestorProfile.phone_numbers),
            selectinload(InvestorProfile.addresses),
            selectinload(InvestorProfile.bank_accounts),
            selectinload(InvestorProfile.related_parties),
        )
    )
    if not profile:
        return False

    folio_defaults = build_folio_defaults(profile)
    if not folio_defaults.get("communication_email_address") or not folio_defaults.get("communication_mobile_number"):
        return False
    if not folio_defaults.get("communication_address") or not folio_defaults.get("payout_bank_account"):
        return False

    try:
        await update_mf_investment_account(
            fp_mfia_id=mfia.fp_mfia_id,
            body={"folio_defaults": folio_defaults},
        )
    except Exception:
        logger.exception("Failed to set MFIA folio_defaults user=%s mfia=%s", user_id, mfia.fp_mfia_id)
        return False
    mfia.metadata_ = {**metadata, "folio_defaults_set": True, "folio_defaults": folio_defaults}
    await session.flush()
    return True


async def refresh_mfia_payout_bank_account(
    session: AsyncSession,
    *,
    user_id,
    bank: InvestorBankAccount,
) -> bool:
    if not bank.external_bank_account_id:
        return False

    mfia = await session.scalar(
        select(MfInvestmentAccount).where(MfInvestmentAccount.user_id == user_id)
    )
    if not mfia or not mfia.fp_mfia_id:
        return False

    folio_defaults = {"payout_bank_account": bank.external_bank_account_id}
    try:
        await update_mf_investment_account(
            fp_mfia_id=mfia.fp_mfia_id,
            body={"folio_defaults": folio_defaults},
        )
    except Exception:
        logger.exception(
            "Failed to refresh MFIA payout bank user=%s mfia=%s bank=%s",
            user_id,
            mfia.fp_mfia_id,
            bank.id,
        )
        return False

    metadata = mfia.metadata_ or {}
    existing_defaults = metadata.get("folio_defaults")
    merged_defaults = existing_defaults if isinstance(existing_defaults, dict) else {}
    merged_defaults["payout_bank_account"] = bank.external_bank_account_id
    mfia.metadata_ = {**metadata, "folio_defaults": merged_defaults}
    await session.flush()
    return True
