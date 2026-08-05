"""Provision local investor drafts to Finprim (live MF tenant)."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.investor.investor_profile_service import (
    mark_investor_profile_active,
    mark_investor_profile_failed,
    mark_investor_profile_provisioning,
)
from app.application.investor.investor_provision_mapper import (
    InvestorProvisionValidationError,
    build_address_payload,
    build_bank_account_payload,
    build_email_payload,
    build_investor_profile_payload,
    build_phone_payload,
    build_related_party_patch_payload,
    build_related_party_payload,
    validate_provision_drafts,
    validate_provision_inputs,
)
from app.core.config import get_settings
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.mf.fp_investor_client import (
    create_address,
    create_bank_account,
    create_email_address,
    create_investor_profile,
    create_phone_number,
    create_related_party,
    patch_related_party,
)
from app.infrastructure.persistence.investor_models import (
    InvestorAddress,
    InvestorBankAccount,
    InvestorEmailAddress,
    InvestorObjectSyncStatus,
    InvestorPhoneNumber,
    InvestorProfile,
    InvestorProfileStatus,
    InvestorRelatedParty,
)
from app.infrastructure.persistence.models import KycJourneyState, User

logger = logging.getLogger(__name__)


def _mark_child_active(row: Any, *, external_id: str | None, external_old_id: int | None = None, raw: dict | None = None) -> None:
    row.external_payload_json = raw
    row.sync_status = InvestorObjectSyncStatus.active
    row.failure_code = None
    row.failure_reason = None
    if hasattr(row, "external_bank_account_id"):
        row.external_bank_account_id = external_id
        row.external_old_id = external_old_id
    elif hasattr(row, "external_address_id"):
        row.external_address_id = external_id
    elif hasattr(row, "external_email_id"):
        row.external_email_id = external_id
    elif hasattr(row, "external_phone_id"):
        row.external_phone_id = external_id
    elif hasattr(row, "external_related_party_id"):
        row.external_related_party_id = external_id


def _mark_child_failed(row: Any, *, code: str, reason: str) -> None:
    row.sync_status = InvestorObjectSyncStatus.failed
    if hasattr(row, "failure_code"):
        row.failure_code = code
    if hasattr(row, "failure_reason"):
        row.failure_reason = reason


async def _load_profile_bundle(session: AsyncSession, user_id) -> tuple[InvestorProfile, User, KycJourneyState | None] | None:
    profile = await session.scalar(
        select(InvestorProfile)
        .where(InvestorProfile.user_id == user_id)
        .options(
            selectinload(InvestorProfile.bank_accounts),
            selectinload(InvestorProfile.addresses),
            selectinload(InvestorProfile.email_addresses),
            selectinload(InvestorProfile.phone_numbers),
            selectinload(InvestorProfile.related_parties),
        )
    )
    if not profile:
        return None
    user = await session.get(User, user_id)
    if not user:
        return None
    journey = await session.get(KycJourneyState, user_id)
    return profile, user, journey


async def provision_investor_profile(session: AsyncSession, *, user_id) -> bool:
    settings = get_settings()
    if not settings.resolved_fp_enabled:
        logger.warning("Skipping investor provisioning for user=%s — Finprim is not enabled", user_id)
        return False

    bundle = await _load_profile_bundle(session, user_id)
    if not bundle:
        return False
    profile, user, journey = bundle

    if profile.external_profile_id and profile.status == InvestorProfileStatus.active:
        try:
            validate_provision_inputs(user=user, journey=journey)
            validate_provision_drafts(
                addresses=profile.addresses,
                bank_accounts=profile.bank_accounts,
                email_addresses=profile.email_addresses,
                phone_numbers=profile.phone_numbers,
            )
        except InvestorProvisionValidationError:
            return False
        try:
            await _provision_child_objects(
                session,
                profile=profile,
                profile_id=profile.external_profile_id,
                user=user,
                journey=journey,
            )
        except FpClientError as exc:
            logger.exception("Investor child sync failed user=%s code=%s", user_id, exc.code)
            return True
        return True

    if profile.status == InvestorProfileStatus.active and profile.external_profile_id:
        return False

    try:
        validate_provision_inputs(user=user, journey=journey)
        validate_provision_drafts(
            addresses=profile.addresses,
            bank_accounts=profile.bank_accounts,
            email_addresses=profile.email_addresses,
            phone_numbers=profile.phone_numbers,
        )
    except InvestorProvisionValidationError as exc:
        await mark_investor_profile_failed(
            session,
            profile,
            failure_code=exc.code,
            failure_reason=exc.message,
        )
        return True

    await mark_investor_profile_provisioning(session, profile)

    try:
        profile_id = profile.external_profile_id
        profile_old_id = profile.external_old_id
        if not profile_id:
            profile_payload = build_investor_profile_payload(user=user, journey=journey)
            created = await create_investor_profile(profile_payload)
            profile_id = created.get("id")
            profile_old_id = created.get("old_id")
            if not profile_id:
                raise InvestorProvisionValidationError(
                    "fp_profile_missing",
                    "Finprim did not return investor profile id",
                )
            profile.external_profile_id = profile_id
            profile.external_old_id = profile_old_id
            await session.flush()

        await _provision_child_objects(
            session,
            profile=profile,
            profile_id=profile_id,
            user=user,
            journey=journey,
        )
        await mark_investor_profile_active(
            session,
            profile,
            external_profile_id=profile_id,
            external_old_id=profile_old_id,
        )
        return True
    except FpClientError as exc:
        await mark_investor_profile_failed(session, profile, failure_code=exc.code, failure_reason=exc.message)
        logger.exception("Investor provisioning failed user=%s code=%s", user_id, exc.code)
        return True
    except InvestorProvisionValidationError as exc:
        await mark_investor_profile_failed(session, profile, failure_code=exc.code, failure_reason=exc.message)
        logger.exception("Investor provisioning failed user=%s code=%s", user_id, exc.code)
        return True
    except Exception as exc:
        await mark_investor_profile_failed(
            session,
            profile,
            failure_code="fp_provision_failed",
            failure_reason=str(exc),
        )
        logger.exception("Investor provisioning failed user=%s", user_id)
        return True


async def _provision_child_objects(
    session: AsyncSession,
    *,
    profile: InvestorProfile,
    profile_id: str,
    user: User,
    journey: KycJourneyState,
) -> None:
    for email_row in profile.email_addresses:
        if email_row.sync_status == InvestorObjectSyncStatus.active and email_row.external_email_id:
            continue
        email_row.sync_status = InvestorObjectSyncStatus.pending_create
        try:
            result = await create_email_address(build_email_payload(profile_id=profile_id, email_row=email_row))
            _mark_child_active(email_row, external_id=result.get("id"), raw=result.get("raw"))
        except FpClientError as exc:
            _mark_child_failed(email_row, code="fp_email_failed", reason=str(exc))
            raise

    for phone_row in profile.phone_numbers:
        if phone_row.sync_status == InvestorObjectSyncStatus.active and phone_row.external_phone_id:
            continue
        phone_row.sync_status = InvestorObjectSyncStatus.pending_create
        try:
            result = await create_phone_number(build_phone_payload(profile_id=profile_id, phone_row=phone_row))
            _mark_child_active(phone_row, external_id=result.get("id"), raw=result.get("raw"))
        except FpClientError as exc:
            _mark_child_failed(phone_row, code="fp_phone_failed", reason=str(exc))
            raise

    for address_row in profile.addresses:
        if address_row.nature == "correspondence":
            continue
        if address_row.sync_status == InvestorObjectSyncStatus.active and address_row.external_address_id:
            continue
        address_row.sync_status = InvestorObjectSyncStatus.pending_create
        try:
            result = await create_address(build_address_payload(profile_id=profile_id, address_row=address_row))
            _mark_child_active(address_row, external_id=result.get("id"), raw=result.get("raw"))
        except FpClientError as exc:
            _mark_child_failed(address_row, code="fp_address_failed", reason=str(exc))
            raise

    for bank_row in profile.bank_accounts:
        if bank_row.sync_status == InvestorObjectSyncStatus.active and bank_row.external_bank_account_id:
            continue
        bank_row.sync_status = InvestorObjectSyncStatus.pending_create
        try:
            result = await create_bank_account(
                build_bank_account_payload(profile_id=profile_id, bank_row=bank_row, journey=journey)
            )
            _mark_child_active(
                bank_row,
                external_id=result.get("id"),
                external_old_id=result.get("old_id"),
                raw=result.get("raw"),
            )
        except FpClientError as exc:
            _mark_child_failed(bank_row, code="fp_bank_failed", reason=str(exc))
            raise

    for party_row in profile.related_parties:
        if party_row.sync_status == InvestorObjectSyncStatus.active and party_row.external_related_party_id:
            patch_payload = build_related_party_patch_payload(party_row=party_row)
            if patch_payload:
                party_row.sync_status = InvestorObjectSyncStatus.pending_create
                try:
                    result = await patch_related_party(patch_payload)
                    _mark_child_active(party_row, external_id=party_row.external_related_party_id, raw=result.get("raw"))
                except FpClientError as exc:
                    _mark_child_failed(party_row, code="fp_related_party_patch_failed", reason=str(exc))
                    raise
            continue
        party_row.sync_status = InvestorObjectSyncStatus.pending_create
        try:
            result = await create_related_party(build_related_party_payload(profile_id=profile_id, party_row=party_row))
            _mark_child_active(party_row, external_id=result.get("id"), raw=result.get("raw"))
            patch_payload = build_related_party_patch_payload(party_row=party_row)
            if patch_payload:
                patch_result = await patch_related_party(patch_payload)
                _mark_child_active(party_row, external_id=result.get("id"), raw=patch_result.get("raw"))
        except FpClientError as exc:
            _mark_child_failed(party_row, code="fp_related_party_failed", reason=str(exc))
            raise

    await session.flush()
