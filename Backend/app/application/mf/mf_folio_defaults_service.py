"""Build and apply Finprim MFIA folio_defaults from provisioned investor objects."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.infrastructure.kyc.cybrilla_terminal_log import log_exception_dump
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.mf.fp_oms_client import (
    NOMINATION_INFO_VISIBILITY_SHOW,
    create_mf_investment_account,
    get_mf_investment_account,
    update_mf_investment_account,
)
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

MFIA_NOMINEE_LIMIT = 3
_FOLIO_CONTACT_KEYS = (
    "communication_email_address",
    "communication_mobile_number",
    "communication_address",
    "overseas_communication_address",
    "payout_bank_account",
    "demat_account",
)


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


def folio_defaults_have_nominees(folio_defaults: dict[str, Any] | None) -> bool:
    if not isinstance(folio_defaults, dict):
        return False
    return any(folio_defaults.get(f"nominee{index}") for index in (1, 2, 3))


def folio_defaults_need_nomination_visibility(folio_defaults: dict[str, Any] | None) -> bool:
    if not folio_defaults_have_nominees(folio_defaults):
        return False
    value = folio_defaults.get("nomination_info_visibility") if folio_defaults else None
    return not (isinstance(value, str) and value.strip())


def apply_nomination_visibility(folio_defaults: dict[str, Any]) -> dict[str, Any]:
    if folio_defaults_have_nominees(folio_defaults):
        folio_defaults.setdefault("nomination_info_visibility", NOMINATION_INFO_VISIBILITY_SHOW)
    return folio_defaults


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

    chosen = select_mfia_nominee_parties(profile.related_parties)
    if chosen:
        folio_defaults.update(build_nominee_slot_defaults(chosen))
    return apply_nomination_visibility(folio_defaults)


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
    force: bool = False,
) -> bool:
    if not mfia.fp_mfia_id:
        return False

    metadata = mfia.metadata_ or {}
    stored_defaults = metadata.get("folio_defaults") if isinstance(metadata.get("folio_defaults"), dict) else {}
    if metadata.get("folio_defaults_set") and not force:
        stored_visibility = stored_defaults.get("nomination_info_visibility")
        if isinstance(stored_visibility, str) and stored_visibility.strip():
            return True
        try:
            remote_defaults = _extract_remote_folio_defaults(await get_mf_investment_account(mfia.fp_mfia_id))
        except Exception:
            remote_defaults = {}
        merged_defaults = {**remote_defaults, **stored_defaults}
        if folio_defaults_need_nomination_visibility(merged_defaults) or merged_defaults.get("skip_nomination") is False:
            return await patch_mfia_folio_defaults(
                session,
                user_id=user_id,
                updates={"nomination_info_visibility": NOMINATION_INFO_VISIBILITY_SHOW},
            )
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


def _party_created_at(row: InvestorRelatedParty) -> datetime:
    created = row.created_at
    if created is None:
        return datetime.min.replace(tzinfo=timezone.utc)
    if created.tzinfo is None:
        return created.replace(tzinfo=timezone.utc)
    return created.astimezone(timezone.utc)


def _party_debug(row: InvestorRelatedParty) -> dict[str, Any]:
    return {
        "id": str(row.id) if row.id else None,
        "name": row.name,
        "sync_status": str(row.sync_status),
        "external_related_party_id": row.external_related_party_id,
        "share_percent": row.share_percent,
        "created_at": row.created_at,
    }


def _party_is_linkable(party: InvestorRelatedParty) -> bool:
    related_party_id = str(party.external_related_party_id or "").strip()
    return related_party_id.startswith("relp_")


def _party_share(party: InvestorRelatedParty) -> int:
    return int(party.share_percent or 0)


def _active_nominee_rows(rows: list[InvestorRelatedParty] | None) -> list[InvestorRelatedParty]:
    nominees = [party for party in (rows or []) if _party_is_linkable(party)]
    nominees.sort(key=_party_created_at)
    return nominees[:MFIA_NOMINEE_LIMIT]


def select_mfia_nominee_parties(
    parties: list[InvestorRelatedParty] | None,
    *,
    extra_parties: list[InvestorRelatedParty] | None = None,
) -> list[InvestorRelatedParty]:
    extra = [party for party in (extra_parties or []) if _party_is_linkable(party)]
    extra.sort(key=_party_created_at)
    extra_share = sum(_party_share(party) for party in extra)
    if extra and extra_share == 100 and 1 <= len(extra) <= MFIA_NOMINEE_LIMIT:
        return extra[:MFIA_NOMINEE_LIMIT]

    by_key: dict[str, InvestorRelatedParty] = {}
    for party in list(parties or []) + extra:
        if not _party_is_linkable(party):
            continue
        by_key[str(party.id or party.external_related_party_id)] = party
    chosen = sorted(by_key.values(), key=_party_created_at)[:MFIA_NOMINEE_LIMIT]
    if sum(_party_share(party) for party in chosen) == 100:
        return chosen
    return extra[:MFIA_NOMINEE_LIMIT] if extra else chosen


def build_nominee_slot_defaults(parties: list[InvestorRelatedParty]) -> dict[str, Any]:
    return build_nominee_slot_defaults_from_links(
        [
            (str(party.external_related_party_id), _party_share(party))
            for party in parties[:MFIA_NOMINEE_LIMIT]
            if party.external_related_party_id
        ]
    )


def build_nominee_slot_defaults_from_links(links: list[tuple[str, int]]) -> dict[str, Any]:
    folio_defaults: dict[str, Any] = {}
    for index in range(1, MFIA_NOMINEE_LIMIT + 1):
        folio_defaults[f"nominee{index}"] = None
        folio_defaults[f"nominee{index}_allocation_percentage"] = None
    for index, (related_party_id, share) in enumerate(links[:MFIA_NOMINEE_LIMIT], start=1):
        folio_defaults[f"nominee{index}"] = related_party_id
        folio_defaults[f"nominee{index}_allocation_percentage"] = int(share)
    return apply_nomination_visibility(folio_defaults)


def build_nominee_folio_defaults(
    profile: InvestorProfile,
    *,
    parties: list[InvestorRelatedParty] | None = None,
    extra_parties: list[InvestorRelatedParty] | None = None,
) -> dict[str, Any]:
    chosen = select_mfia_nominee_parties(
        parties if parties is not None else profile.related_parties,
        extra_parties=extra_parties,
    )
    return build_nominee_slot_defaults(chosen)


def _non_empty_folio_values(values: dict[str, Any] | None) -> dict[str, Any]:
    cleaned: dict[str, Any] = {}
    for key in _FOLIO_CONTACT_KEYS:
        value = (values or {}).get(key)
        if value not in {None, "", {}}:
            cleaned[key] = value
    return cleaned


def _extract_remote_folio_defaults(payload: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {}
    data = payload.get("data")
    obj = data if isinstance(data, dict) else payload
    folio = obj.get("folio_defaults") if isinstance(obj, dict) else None
    return folio if isinstance(folio, dict) else {}


def _folio_defaults_for_patch(values: dict[str, Any] | None) -> dict[str, Any]:
    cleaned: dict[str, Any] = {}
    for key, value in (values or {}).items():
        if key == "_comment":
            continue
        cleaned[key] = value
    return cleaned


async def patch_mfia_folio_defaults(
    session: AsyncSession,
    *,
    user_id,
    updates: dict[str, Any],
) -> bool:
    mfia = await session.scalar(select(MfInvestmentAccount).where(MfInvestmentAccount.user_id == user_id))
    if not mfia or not mfia.fp_mfia_id:
        log_exception_dump(
            "Cannot PATCH MFIA folio_defaults: investment account missing",
            user_id=str(user_id),
            updates=updates,
        )
        return False

    metadata = mfia.metadata_ or {}
    stored_defaults = metadata.get("folio_defaults") if isinstance(metadata.get("folio_defaults"), dict) else {}
    remote_defaults: dict[str, Any] = {}
    try:
        remote_defaults = _extract_remote_folio_defaults(await get_mf_investment_account(mfia.fp_mfia_id))
    except Exception as exc:
        log_exception_dump(
            "Could not fetch current MFIA before folio_defaults PATCH",
            exc,
            mfia=mfia.fp_mfia_id,
        )

    folio_defaults = {
        **_folio_defaults_for_patch(remote_defaults),
        **_folio_defaults_for_patch(stored_defaults),
        **updates,
    }
    print(
        f"[MFIA] PATCH folio_defaults mfia={mfia.fp_mfia_id} payload={folio_defaults}",
        flush=True,
    )
    await update_mf_investment_account(
        fp_mfia_id=mfia.fp_mfia_id,
        body={"folio_defaults": folio_defaults},
    )
    merged_defaults = stored_defaults if isinstance(stored_defaults, dict) else {}
    merged_defaults.update(folio_defaults)
    mfia.metadata_ = {**metadata, "folio_defaults_set": True, "folio_defaults": merged_defaults}
    await session.flush()
    return True


async def refresh_mfia_communication_email(
    session: AsyncSession,
    *,
    user_id,
    email: InvestorEmailAddress,
) -> bool:
    email_id = str(email.external_email_id or "").strip()
    if not email_id:
        log_exception_dump(
            "Cannot set MFIA communication email: Finprim email id missing",
            user_id=str(user_id),
            local_email=email.email,
        )
        return False
    try:
        return await patch_mfia_folio_defaults(
            session,
            user_id=user_id,
            updates={"communication_email_address": email_id},
        )
    except Exception as exc:
        log_exception_dump(
            "Failed to set MFIA communication_email_address",
            exc,
            user_id=str(user_id),
            email_id=email_id,
        )
        logger.exception("Failed to refresh MFIA communication email user=%s", user_id)
        return False


async def _resolve_fp_mfia_id(
    session: AsyncSession,
    *,
    user_id,
    mfia: MfInvestmentAccount | None,
    profile: InvestorProfile,
) -> tuple[MfInvestmentAccount | None, str | None]:
    account = mfia
    fp_mfia_id = str(getattr(account, "fp_mfia_id", None) or "").strip() or None
    if fp_mfia_id:
        return account, fp_mfia_id
    if not profile.external_profile_id:
        return account, None
    result = await create_mf_investment_account(investor_profile_id=str(profile.external_profile_id))
    fp_mfia_id = str(result.get("fp_mfia_id") or "").strip() or None
    if not fp_mfia_id:
        log_exception_dump("Finprim did not return an mf_investment_account id", result=result)
        return account, None
    if account is None:
        from app.application.mf.mf_order_service import get_or_create_mf_investment_account

        account = await get_or_create_mf_investment_account(session, user_id=user_id)
    account.fp_mfia_id = fp_mfia_id
    account.fp_mfia_old_id = result.get("fp_mfia_old_id")
    from app.infrastructure.persistence.mf_transaction_models import MfInvestmentAccountStatus

    account.status = MfInvestmentAccountStatus.active
    account.failure_reason = None
    await session.flush()
    print(f"[MFIA] created investment account {fp_mfia_id} for user={user_id}", flush=True)
    return account, fp_mfia_id


async def refresh_mfia_nominee_folio_defaults(
    session: AsyncSession,
    *,
    user_id,
    extra_parties: list[InvestorRelatedParty] | None = None,
    nominee_links: list[tuple[str, int]] | None = None,
    mfia: MfInvestmentAccount | None = None,
) -> bool:
    print(
        f"[MFIA] begin nominee link user={user_id} extra={len(extra_parties or [])} "
        f"links={nominee_links} mfia={getattr(mfia, 'fp_mfia_id', None)}",
        flush=True,
    )
    if mfia is None:
        mfia = await session.scalar(select(MfInvestmentAccount).where(MfInvestmentAccount.user_id == user_id))

    profile = await session.scalar(
        select(InvestorProfile)
        .where(InvestorProfile.user_id == user_id)
        .options(
            selectinload(InvestorProfile.related_parties),
            selectinload(InvestorProfile.email_addresses),
            selectinload(InvestorProfile.phone_numbers),
            selectinload(InvestorProfile.addresses),
            selectinload(InvestorProfile.bank_accounts),
        )
    )
    if not profile:
        log_exception_dump("Cannot link nominees: investor profile missing", user_id=str(user_id))
        return False

    mfia, fp_mfia_id = await _resolve_fp_mfia_id(session, user_id=user_id, mfia=mfia, profile=profile)
    if not mfia or not fp_mfia_id:
        log_exception_dump(
            "Cannot link nominees: MFIA missing",
            user_id=str(user_id),
            mfia_found=bool(mfia),
            fp_mfia_id=fp_mfia_id,
        )
        return False

    links = [
        (related_party_id, int(share))
        for related_party_id, share in (nominee_links or [])
        if str(related_party_id or "").startswith("relp_")
    ]
    if not links:
        party_rows = list(
            (
                await session.scalars(
                    select(InvestorRelatedParty).where(InvestorRelatedParty.investor_profile_id == user_id)
                )
            ).all()
        )
        chosen = select_mfia_nominee_parties(party_rows, extra_parties=extra_parties)
        links = [
            (str(party.external_related_party_id), _party_share(party))
            for party in chosen
            if party.external_related_party_id
        ]
    links = links[:MFIA_NOMINEE_LIMIT]
    allocation_total = sum(share for _related_party_id, share in links)
    if not links or allocation_total != 100:
        log_exception_dump(
            "Cannot link nominees onto MFIA: need 1-3 related parties whose shares total 100%",
            user_id=str(user_id),
            mfia=fp_mfia_id,
            allocation_total=allocation_total,
            links=links,
            extra_parties=[_party_debug(row) for row in (extra_parties or [])],
        )
        return False

    metadata = mfia.metadata_ or {}
    contact_defaults = _non_empty_folio_values(build_folio_defaults(profile, fp_enabled=get_settings().resolved_fp_enabled))
    stored_defaults = metadata.get("folio_defaults") if isinstance(metadata.get("folio_defaults"), dict) else {}
    remote_defaults: dict[str, Any] = {}
    try:
        remote_defaults = _extract_remote_folio_defaults(await get_mf_investment_account(fp_mfia_id))
    except Exception as exc:
        log_exception_dump(
            "Could not fetch current MFIA before nominee link; using local folio_defaults",
            exc,
            mfia=fp_mfia_id,
        )

    folio_defaults = {
        **_non_empty_folio_values(remote_defaults),
        **_non_empty_folio_values(stored_defaults),
        **contact_defaults,
        **build_nominee_slot_defaults_from_links(links),
    }
    print(
        "[MFIA] linking related parties onto folio_defaults "
        f"mfia={fp_mfia_id} nominees={len(links)} allocation_total={allocation_total} "
        f"payload={folio_defaults}",
        flush=True,
    )

    try:
        await update_mf_investment_account(
            fp_mfia_id=fp_mfia_id,
            body={"folio_defaults": folio_defaults},
        )
    except FpClientError as exc:
        log_exception_dump(
            "Finprim rejected MFIA folio_defaults nominee link",
            exc,
            user_id=str(user_id),
            mfia=fp_mfia_id,
            folio_defaults=folio_defaults,
            fp_status=exc.status_code,
            fp_code=exc.code,
            fp_message=exc.message,
            fp_response=exc.response_data,
            links=links,
        )
        raise
    except Exception as exc:
        log_exception_dump(
            "Failed to refresh MFIA nominee folio_defaults",
            exc,
            user_id=str(user_id),
            mfia=fp_mfia_id,
            folio_defaults=folio_defaults,
            links=links,
        )
        logger.exception(
            "Failed to refresh MFIA nominee folio_defaults user=%s mfia=%s",
            user_id,
            fp_mfia_id,
        )
        return False

    existing_defaults = metadata.get("folio_defaults")
    merged_defaults = existing_defaults if isinstance(existing_defaults, dict) else {}
    merged_defaults.update(folio_defaults)
    mfia.metadata_ = {**metadata, "folio_defaults_set": True, "folio_defaults": merged_defaults}
    await session.flush()
    return True


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

    try:
        return await patch_mfia_folio_defaults(
            session,
            user_id=user_id,
            updates={"payout_bank_account": bank.external_bank_account_id},
        )
    except Exception:
        logger.exception(
            "Failed to refresh MFIA payout bank user=%s bank=%s",
            user_id,
            bank.id,
        )
        return False
