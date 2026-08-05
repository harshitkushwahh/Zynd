"""Seed local investor profile drafts from completed KYC journey data."""

from __future__ import annotations

from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.investor.investor_bank_account_crypto import encrypt_account_number
from app.application.investor.investor_bank_account_service import _find_existing_bank_account
from app.infrastructure.persistence.investor_models import (
    InvestorAddress,
    InvestorBankAccount,
    InvestorBankVerificationStatus,
    InvestorEmailAddress,
    InvestorObjectSource,
    InvestorObjectSyncStatus,
    InvestorPhoneNumber,
    InvestorProfile,
    InvestorProvisionTrigger,
)
from app.infrastructure.persistence.models import KycJourneyState, User
from app.application.investor.investor_nominee_mapper import upsert_nominee_drafts_to_local
from app.infrastructure.persistence.repositories.investor_profile_repository import (
    get_or_create_pending_investor_profile,
)

ACCOUNT_TYPE_MAP = {
    "Savings": "savings",
    "Current": "current",
    "NRE": "nre_savings",
    "NRO": "nro_savings",
    "savings": "savings",
    "current": "current",
    "nre_savings": "nre_savings",
    "nro_savings": "nro_savings",
}


def _str(value: Any) -> str:
    return str(value or "").strip()


def _account_last4(account_number: str) -> str:
    digits = account_number.strip()
    return digits[-4:] if len(digits) >= 4 else digits


def _map_address_fields(raw: dict[str, Any] | None) -> dict[str, Any] | None:
    if not raw:
        return None
    line1 = _str(raw.get("line1") or raw.get("line_1"))
    if not line1:
        return None
    country = _str(raw.get("country") or "IN")
    if country.lower() in {"india", "in"}:
        country = "IN"
    return {
        "line1": line1[:255],
        "line2": _str(raw.get("line2") or raw.get("line_2"))[:255] or None,
        "line3": _str(raw.get("line3") or raw.get("line_3"))[:255] or None,
        "city": _str(raw.get("city"))[:120] or None,
        "state": _str(raw.get("state"))[:120] or None,
        "postal_code": _str(raw.get("pincode") or raw.get("postal_code"))[:16],
        "country": country[:8] or "IN",
    }


def _map_verification_status(raw: Any) -> InvestorBankVerificationStatus:
    normalized = _str(raw).lower()
    if normalized == "verified":
        return InvestorBankVerificationStatus.verified
    if normalized == "manual_required":
        return InvestorBankVerificationStatus.manual_required
    if normalized == "failed":
        return InvestorBankVerificationStatus.failed
    return InvestorBankVerificationStatus.pending


def _build_bank_metadata(*, bank: dict[str, Any]) -> dict[str, Any]:
    metadata: dict[str, Any] = {"seededFrom": "kyc"}
    readiness = bank.get("readinessVerified")
    if readiness is not None:
        metadata["readinessVerified"] = bool(readiness)
    poa_account_type = _str(bank.get("poaAccountType"))
    if poa_account_type:
        metadata["poaAccountType"] = poa_account_type
    return metadata


def _apply_bank_verification_fields(
    row: InvestorBankAccount,
    *,
    journey: KycJourneyState,
    bank: dict[str, Any],
    account_number: str,
    holder: str,
) -> None:
    ciphertext, key_version = encrypt_account_number(account_number)
    pan_holder = _str(bank.get("panAccountHolderName")) or holder

    row.poa_preverify_id = _str(journey.poa_bank_preverify_id) or None
    row.pan_account_holder_name = pan_holder[:120] or None
    row.verification_status = _map_verification_status(journey.bank_verification_status)
    row.verification_failure_json = journey.bank_verification_failure_json
    row.account_number_ciphertext = ciphertext
    row.account_number_key_version = key_version
    row.metadata_json = _build_bank_metadata(bank=bank)
    if not row.cancelled_cheque_file_id:
        row.cancelled_cheque_file_id = _str(journey.poa_bank_proof_file_id) or None


async def seed_investor_drafts_from_kyc(
    db: AsyncSession,
    *,
    user: User,
    journey: KycJourneyState,
) -> InvestorProfile:
    """Copy KYC journey drafts into investor_* tables (local Cybrilla v2 mirror)."""
    profile = await get_or_create_pending_investor_profile(
        db,
        user_id=user.id,
        provision_trigger=InvestorProvisionTrigger.manual,
    )
    profile.metadata_json = {
        **(profile.metadata_json or {}),
        "seeded_from": "kyc_completion",
    }

    await _seed_email(db, profile, user)
    await _seed_phone(db, profile, user)
    await _seed_addresses(db, profile, journey)
    await _seed_bank(db, profile, journey)
    await _seed_nominees(db, profile, journey)
    await db.flush()
    return profile


async def _seed_email(db: AsyncSession, profile: InvestorProfile, user: User) -> None:
    existing = await db.execute(
        select(InvestorEmailAddress).where(InvestorEmailAddress.investor_profile_id == profile.user_id)
    )
    if existing.scalars().first():
        return
    db.add(
        InvestorEmailAddress(
            investor_profile_id=profile.user_id,
            email=user.email.lower(),
            is_primary=True,
            source=InvestorObjectSource.user,
            sync_status=InvestorObjectSyncStatus.draft,
            belongs_to="self",
        )
    )


async def _seed_phone(db: AsyncSession, profile: InvestorProfile, user: User) -> None:
    if not user.phone:
        return
    existing = await db.execute(
        select(InvestorPhoneNumber).where(InvestorPhoneNumber.investor_profile_id == profile.user_id)
    )
    if existing.scalars().first():
        return
    phone = user.phone.strip()
    isd = "+91"
    number = phone
    if phone.startswith("+91"):
        number = phone[3:].lstrip()
    elif phone.startswith("+"):
        number = phone.lstrip("+")
    db.add(
        InvestorPhoneNumber(
            investor_profile_id=profile.user_id,
            isd=isd,
            number=number[:20],
            is_primary=True,
            source=InvestorObjectSource.user,
            sync_status=InvestorObjectSyncStatus.draft,
            belongs_to="self",
        )
    )


async def _seed_addresses(db: AsyncSession, profile: InvestorProfile, journey: KycJourneyState) -> None:
    contact = journey.contact_draft_json if isinstance(journey.contact_draft_json, dict) else {}
    permanent = _map_address_fields(contact.get("permanent") if isinstance(contact.get("permanent"), dict) else None)
    if not permanent:
        return

    await db.execute(delete(InvestorAddress).where(InvestorAddress.investor_profile_id == profile.user_id))

    db.add(
        InvestorAddress(
            investor_profile_id=profile.user_id,
            is_primary=True,
            nature="residential",
            source=InvestorObjectSource.kyc,
            sync_status=InvestorObjectSyncStatus.draft,
            **permanent,
        )
    )

    if not contact.get("sameAsPermanent"):
        correspondence = _map_address_fields(
            contact.get("correspondence") if isinstance(contact.get("correspondence"), dict) else None
        )
        if correspondence and correspondence.get("line1") != permanent.get("line1"):
            db.add(
                InvestorAddress(
                    investor_profile_id=profile.user_id,
                    is_primary=False,
                    nature="correspondence",
                    source=InvestorObjectSource.kyc,
                    sync_status=InvestorObjectSyncStatus.draft,
                    **correspondence,
                )
            )


async def _seed_bank(db: AsyncSession, profile: InvestorProfile, journey: KycJourneyState) -> None:
    bank = journey.bank_draft_json if isinstance(journey.bank_draft_json, dict) else {}
    account_number = _str(bank.get("accountNumber"))
    ifsc = _str(bank.get("ifscCode")).upper()
    if not account_number or not ifsc:
        return

    last4 = _account_last4(account_number)
    existing_row = await _find_existing_bank_account(
        db,
        user_id=profile.user_id,
        account_number=account_number,
        ifsc_code=ifsc,
    )

    account_type = ACCOUNT_TYPE_MAP.get(_str(bank.get("accountType")), "savings")
    holder = _str(bank.get("accountHolderName")) or "Account Holder"

    if existing_row:
        existing_row.ifsc_code = ifsc
        if not existing_row.account_number_ciphertext:
            _apply_bank_verification_fields(
                existing_row,
                journey=journey,
                bank=bank,
                account_number=account_number,
                holder=holder,
            )
        return

    row = InvestorBankAccount(
        investor_profile_id=profile.user_id,
        is_primary=True,
        account_type=account_type,
        account_number_last4=last4,
        ifsc_code=ifsc,
        primary_account_holder_name=holder[:120],
        bank_name=_str(bank.get("bankName"))[:120] or None,
        branch_name=_str(bank.get("branch"))[:120] or None,
        cancelled_cheque_file_id=_str(journey.poa_bank_proof_file_id) or None,
        source=InvestorObjectSource.kyc,
        sync_status=InvestorObjectSyncStatus.draft,
    )
    _apply_bank_verification_fields(
        row,
        journey=journey,
        bank=bank,
        account_number=account_number,
        holder=holder,
    )
    db.add(row)


async def _seed_nominees(db: AsyncSession, profile: InvestorProfile, journey: KycJourneyState) -> None:
    await upsert_nominee_drafts_to_local(db, profile=profile, journey=journey)


__all__ = ["seed_investor_drafts_from_kyc"]
