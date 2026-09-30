"""Build and apply Finprim MFIA folio_defaults from provisioned investor objects."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.mf.fp_oms_client import update_mf_investment_account
from app.infrastructure.persistence.investor_models import (
    InvestorAddress,
    InvestorBankAccount,
    InvestorBankVerificationStatus,
    InvestorEmailAddress,
    InvestorObjectSyncStatus,
    InvestorPhoneNumber,
    InvestorProfile,
    InvestorRelatedParty,
)
from app.infrastructure.persistence.mf_transaction_models import MfInvestmentAccount
from app.infrastructure.persistence.models import KycJourneyState

logger = logging.getLogger(__name__)


def _is_stub_fp_bank_id(external_id: str | None) -> bool:
    normalized = str(external_id or "").strip()
    return normalized.startswith("bac_stub_")


def _bank_is_folio_ready(row: InvestorBankAccount, *, fp_enabled: bool) -> bool:
    from app.application.investor.investor_bank_account_service import is_bank_account_disabled

    if row.sync_status != InvestorObjectSyncStatus.active or not row.external_bank_account_id:
        return False
    if is_bank_account_disabled(row):
        return False
    if not fp_enabled:
        return True
    if _is_stub_fp_bank_id(row.external_bank_account_id):
        return False
    return row.external_old_id is not None


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


def _primary_bank(banks: list[InvestorBankAccount], *, fp_enabled: bool) -> InvestorBankAccount | None:
    for row in banks:
        if row.is_primary and _bank_is_folio_ready(row, fp_enabled=fp_enabled):
            return row
    for row in banks:
        if _bank_is_folio_ready(row, fp_enabled=fp_enabled):
            return row
    return None


def _resolve_payout_bank(
    banks: list[InvestorBankAccount],
    *,
    fp_enabled: bool,
    preferred_bank_account_id: UUID | None = None,
) -> InvestorBankAccount | None:
    if preferred_bank_account_id is not None:
        preferred = next((row for row in banks if row.id == preferred_bank_account_id), None)
        if preferred and _bank_is_folio_ready(preferred, fp_enabled=fp_enabled):
            return preferred
    return _primary_bank(banks, fp_enabled=fp_enabled)


def build_folio_defaults(
    profile: InvestorProfile,
    *,
    fp_enabled: bool | None = None,
    preferred_bank_account_id: UUID | None = None,
) -> dict[str, Any]:
    if fp_enabled is None:
        fp_enabled = get_settings().resolved_fp_enabled

    folio_defaults: dict[str, Any] = {}

    email = _primary_email(profile.email_addresses)
    phone = _primary_phone(profile.phone_numbers)
    address = _primary_address(profile.addresses)
    bank = _resolve_payout_bank(
        profile.bank_accounts,
        fp_enabled=fp_enabled,
        preferred_bank_account_id=preferred_bank_account_id,
    )

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


def _is_payout_bank_not_found_error(exc: Exception) -> bool:
    if not isinstance(exc, FpClientError):
        return False
    message = str(exc.message or exc).lower()
    return "payout_bank_account" in message or (
        "bank_account" in message and "not found" in message
    )


async def _load_kyc_journey(session: AsyncSession, user_id) -> KycJourneyState | None:
    return await session.scalar(select(KycJourneyState).where(KycJourneyState.user_id == user_id))


async def _ensure_verified_banks_provisioned(
    session: AsyncSession,
    profile: InvestorProfile,
    *,
    fp_enabled: bool,
    preferred_bank_account_id: UUID | None = None,
) -> None:
    from app.application.investor.investor_bank_account_service import _provision_bank_account_if_ready

    if not fp_enabled or not profile.external_profile_id:
        return

    journey = await _load_kyc_journey(session, profile.user_id)
    if not journey:
        return

    banks = list(profile.bank_accounts)
    if preferred_bank_account_id is not None:
        banks.sort(key=lambda row: 0 if row.id == preferred_bank_account_id else 1)

    for bank in banks:
        if bank.verification_status != InvestorBankVerificationStatus.verified:
            continue
        if _bank_is_folio_ready(bank, fp_enabled=True):
            continue
        await _provision_bank_account_if_ready(
            session,
            profile=profile,
            bank_row=bank,
            journey=journey,
        )


async def _reset_and_reprovision_bank(
    session: AsyncSession,
    *,
    profile: InvestorProfile,
    bank: InvestorBankAccount,
    journey: KycJourneyState,
) -> None:
    from app.application.investor.investor_bank_account_service import _provision_bank_account_if_ready

    bank.external_bank_account_id = None
    bank.external_old_id = None
    bank.sync_status = InvestorObjectSyncStatus.pending_create
    bank.failure_code = None
    bank.failure_reason = None
    await session.flush()
    await _provision_bank_account_if_ready(
        session,
        profile=profile,
        bank_row=bank,
        journey=journey,
    )


async def _apply_folio_defaults(
    session: AsyncSession,
    *,
    user_id,
    mfia: MfInvestmentAccount,
    folio_defaults: dict[str, Any],
    metadata: dict[str, Any],
) -> bool:
    await update_mf_investment_account(
        fp_mfia_id=mfia.fp_mfia_id,
        body={"folio_defaults": folio_defaults},
    )
    mfia.metadata_ = {**metadata, "folio_defaults_set": True, "folio_defaults": folio_defaults}
    mfia.metadata_.pop("folio_defaults_last_error", None)
    await session.flush()
    return True


async def ensure_mfia_folio_defaults(
    session: AsyncSession,
    *,
    user_id,
    mfia: MfInvestmentAccount,
    preferred_bank_account_id: UUID | None = None,
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

    fp_enabled = get_settings().resolved_fp_enabled
    await _ensure_verified_banks_provisioned(
        session,
        profile,
        fp_enabled=fp_enabled,
        preferred_bank_account_id=preferred_bank_account_id,
    )

    folio_defaults = build_folio_defaults(
        profile,
        fp_enabled=fp_enabled,
        preferred_bank_account_id=preferred_bank_account_id,
    )
    if not folio_defaults.get("communication_email_address") or not folio_defaults.get("communication_mobile_number"):
        return False
    if not folio_defaults.get("communication_address") or not folio_defaults.get("payout_bank_account"):
        return False

    try:
        return await _apply_folio_defaults(
            session,
            user_id=user_id,
            mfia=mfia,
            folio_defaults=folio_defaults,
            metadata=metadata,
        )
    except FpClientError as exc:
        if not fp_enabled or not _is_payout_bank_not_found_error(exc):
            logger.exception("Failed to set MFIA folio_defaults user=%s mfia=%s", user_id, mfia.fp_mfia_id)
            mfia.metadata_ = {
                **metadata,
                "folio_defaults_last_error": str(exc.message or exc),
            }
            await session.flush()
            return False

        bank = _resolve_payout_bank(
            profile.bank_accounts,
            fp_enabled=True,
            preferred_bank_account_id=preferred_bank_account_id,
        )
        journey = await _load_kyc_journey(session, user_id)
        if not bank or not journey:
            logger.exception(
                "MFIA folio_defaults payout bank missing on Finprim and cannot reprovision user=%s mfia=%s",
                user_id,
                mfia.fp_mfia_id,
            )
            return False

        logger.warning(
            "Reprovisioning stale payout bank for MFIA folio_defaults user=%s mfia=%s bank=%s",
            user_id,
            mfia.fp_mfia_id,
            bank.id,
        )
        await _reset_and_reprovision_bank(session, profile=profile, bank=bank, journey=journey)
        folio_defaults = build_folio_defaults(
            profile,
            fp_enabled=True,
            preferred_bank_account_id=preferred_bank_account_id,
        )
        if not folio_defaults.get("payout_bank_account"):
            mfia.metadata_ = {
                **metadata,
                "folio_defaults_last_error": "payout_bank_account_unavailable_after_reprovision",
            }
            await session.flush()
            return False

        try:
            return await _apply_folio_defaults(
                session,
                user_id=user_id,
                mfia=mfia,
                folio_defaults=folio_defaults,
                metadata=metadata,
            )
        except Exception:
            logger.exception(
                "Failed to set MFIA folio_defaults after bank reprovision user=%s mfia=%s",
                user_id,
                mfia.fp_mfia_id,
            )
            return False
    except Exception:
        logger.exception("Failed to set MFIA folio_defaults user=%s mfia=%s", user_id, mfia.fp_mfia_id)
        return False


async def refresh_mfia_payout_bank_account(
    session: AsyncSession,
    *,
    user_id,
    bank: InvestorBankAccount,
) -> bool:
    fp_enabled = get_settings().resolved_fp_enabled
    if fp_enabled and not _bank_is_folio_ready(bank, fp_enabled=True):
        from app.application.investor.investor_bank_account_service import _provision_bank_account_if_ready

        profile = await session.get(InvestorProfile, user_id)
        journey = await _load_kyc_journey(session, user_id)
        if profile and journey:
            await _provision_bank_account_if_ready(
                session,
                profile=profile,
                bank_row=bank,
                journey=journey,
            )
    if not bank.external_bank_account_id or (fp_enabled and _is_stub_fp_bank_id(bank.external_bank_account_id)):
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
