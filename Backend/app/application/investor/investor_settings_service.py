"""Post-KYC investor profile updates and nominee linking."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.consent.consent_service import (
    ConsentAcceptContext,
    record_revocation,
    user_revocable_consent_active,
)
from app.application.consent.errors import ConsentError
from app.application.investor.investor_nominee_mapper import nominee_draft_to_related_party_fields
from app.application.investor.investor_provision_mapper import (
    FP_INVESTOR_PROFILE_INCOME_SLABS,
    FP_INVESTOR_PROFILE_PEP_DETAILS,
    build_investor_profile_patch_payload,
)
from app.application.investor.investor_provision_service import provision_related_party_row
from app.application.kyc.errors import KycError
from app.application.kyc.personal_draft import (
    MARITAL_STATUS_LOCKED_KEY,
    is_marital_status_locked,
    normalize_personal_draft,
    validate_personal_draft,
)
from app.application.mf.mf_folio_defaults_service import (
    build_nominee_slot_defaults_from_links,
    patch_mfia_folio_defaults,
)
from app.domain.consent.keys import KYC_NOMINATION_OPT_OUT
from app.infrastructure.kyc.cybrilla_terminal_log import log_exception_dump
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.mf.fp_investor_client import patch_investor_profile
from app.infrastructure.persistence.investor_models import (
    InvestorObjectSource,
    InvestorObjectSyncStatus,
    InvestorProfile,
    InvestorProfileStatus,
    InvestorRelatedParty,
)
from app.infrastructure.persistence.mf_transaction_models import MfInvestmentAccount
from app.infrastructure.persistence.models import (
    KycJourneyState,
    KycOverallStatus,
    KycStepStatus,
    User,
    UserKycStatus,
)

MAX_INVESTOR_NOMINEES = 3


async def _require_kyc_completed(db: AsyncSession, user_id: UUID) -> UserKycStatus:
    status = await db.get(UserKycStatus, user_id)
    if status is None or status.overall_status != KycOverallStatus.completed:
        raise KycError(
            "Complete KYC verification before updating your investor profile.",
            "kyc_not_verified",
            403,
        )
    return status


async def _load_active_investor_profile(db: AsyncSession, user_id: UUID) -> InvestorProfile | None:
    return await db.scalar(
        select(InvestorProfile)
        .where(InvestorProfile.user_id == user_id)
        .options(selectinload(InvestorProfile.related_parties))
    )


def _has_finprim_investor_profile(profile: InvestorProfile | None) -> bool:
    if profile is None:
        return False
    external_id = str(profile.external_profile_id or "").strip()
    return profile.status == InvestorProfileStatus.active and bool(external_id)


async def _load_mfia(db: AsyncSession, user_id: UUID) -> MfInvestmentAccount | None:
    return await db.scalar(select(MfInvestmentAccount).where(MfInvestmentAccount.user_id == user_id))


def _has_finprim_mfia(mfia: MfInvestmentAccount | None) -> bool:
    if mfia is None:
        return False
    return bool(str(mfia.fp_mfia_id or "").strip())


def _normalize_pan(value: Any) -> str:
    return str(value or "").strip().upper()


def _investor_pan_number(journey: KycJourneyState) -> str:
    pan_draft = journey.pan_draft_json if isinstance(journey.pan_draft_json, dict) else {}
    return _normalize_pan(pan_draft.get("panNumber"))


def _related_party_create_error(exc: FpClientError) -> KycError:
    message = str(exc.message or "").strip()
    lowered = message.lower()
    if "same as investor pan" in lowered:
        return KycError(
            "Nominee PAN cannot be the same as your PAN. Enter the nominee’s PAN, or leave it blank.",
            "nominee_pan_matches_investor",
            400,
        )
    if exc.status_code == 400:
        return KycError(message or "Could not create nominee.", "related_party_create_failed", 400)
    return KycError(message or "Could not create nominee.", "related_party_create_failed", 502)


async def get_investor_settings_state(db: AsyncSession, *, user_id: UUID) -> dict[str, Any]:
    status = await db.get(UserKycStatus, user_id)
    kyc_completed = status is not None and status.overall_status == KycOverallStatus.completed
    profile = await _load_active_investor_profile(db, user_id) if kyc_completed else None
    mfia = await _load_mfia(db, user_id) if kyc_completed else None
    has_profile = _has_finprim_investor_profile(profile)
    has_mfia = _has_finprim_mfia(mfia)
    journey = await db.get(KycJourneyState, user_id)
    nominee_draft = journey.nominee_draft_json if journey and isinstance(journey.nominee_draft_json, list) else []
    return {
        "kyc_completed": kyc_completed,
        "has_investor_profile": has_profile,
        "investor_profile_id": profile.external_profile_id if has_profile and profile else None,
        "has_mf_investment_account": has_mfia,
        "mfia_id": mfia.fp_mfia_id if has_mfia and mfia else None,
        "can_edit_profile": kyc_completed and has_profile,
        "can_add_nominee": kyc_completed and has_profile and has_mfia,
        "nominee_count": len(nominee_draft),
        "max_nominees": MAX_INVESTOR_NOMINEES,
        "nominees": nominee_draft,
    }


async def update_investor_profile_settings(
    db: AsyncSession,
    *,
    user: User,
    income_slab: str | None = None,
    pep_details: str | None = None,
    marital_status: str | None = None,
    spouse_name: str | None = None,
) -> dict[str, Any]:
    await _require_kyc_completed(db, user.id)
    profile = await _load_active_investor_profile(db, user.id)
    if not _has_finprim_investor_profile(profile) or profile is None:
        raise KycError(
            "Investor profile is not ready yet. Try again after KYC provisioning finishes.",
            "investor_profile_missing",
            409,
        )

    journey = await db.get(KycJourneyState, user.id)
    if journey is None:
        raise KycError("KYC journey not found.", "kyc_journey_missing", 404)

    personal = dict(journey.personal_draft_json or {})
    patch_income = (income_slab or "").strip().lower() or None
    patch_pep = (pep_details or "").strip().lower() or None
    if patch_income and patch_income not in FP_INVESTOR_PROFILE_INCOME_SLABS:
        raise KycError("Choose a valid income slab.", "income_slab_invalid", 400)
    if patch_pep and patch_pep not in FP_INVESTOR_PROFILE_PEP_DETAILS:
        raise KycError("Choose a valid PEP declaration.", "pep_details_invalid", 400)

    if patch_income:
        personal["incomeSlab"] = patch_income
    if patch_pep:
        personal["pepExposed"] = patch_pep
    if marital_status is not None:
        personal["maritalStatus"] = marital_status.strip().lower()
    if spouse_name is not None:
        personal["spouseName"] = spouse_name.strip()

    locked = is_marital_status_locked(journey.personal_draft_json if isinstance(journey.personal_draft_json, dict) else {})
    validate_personal_draft(personal, journey_marital_locked=locked)
    personal = normalize_personal_draft(personal)
    if locked:
        personal[MARITAL_STATUS_LOCKED_KEY] = True

    fp_payload = build_investor_profile_patch_payload(
        profile_id=str(profile.external_profile_id),
        income_slab=patch_income,
        pep_details=patch_pep,
    )
    if len(fp_payload) > 1:
        try:
            result = await patch_investor_profile(fp_payload)
        except FpClientError as exc:
            raise KycError(exc.message or "Could not update investor profile.", "investor_profile_update_failed", 502) from exc
        if result.get("raw"):
            profile.metadata_json = {**(profile.metadata_json or {}), "investor_profile": result["raw"]}

    journey.personal_draft_json = personal
    await db.flush()
    return await get_investor_settings_state(db, user_id=user.id)


async def add_investor_nominee(
    db: AsyncSession,
    *,
    user: User,
    nominees: list[dict[str, Any]] | None = None,
    nominee: dict[str, Any] | None = None,
    consent_context: ConsentAcceptContext | None = None,
) -> dict[str, Any]:
    status = await _require_kyc_completed(db, user.id)
    profile = await _load_active_investor_profile(db, user.id)
    mfia = await _load_mfia(db, user.id)
    if not _has_finprim_investor_profile(profile) or profile is None:
        raise KycError(
            "Investor profile is not ready yet. Try again after KYC provisioning finishes.",
            "investor_profile_missing",
            409,
        )
    if mfia is None or not _has_finprim_mfia(mfia):
        print(
            f"[MFIA] settings nominee save has no local investment account yet user={user.id} mfia={getattr(mfia, 'fp_mfia_id', None)}",
            flush=True,
        )

    journey = await db.get(KycJourneyState, user.id)
    if journey is None:
        raise KycError("KYC journey not found.", "kyc_journey_missing", 404)

    incoming = [item for item in (nominees or []) if isinstance(item, dict)]
    if nominee and isinstance(nominee, dict) and not incoming:
        incoming = [nominee]
    if len(incoming) > MAX_INVESTOR_NOMINEES:
        raise KycError("You can add up to 3 nominees.", "nominee_limit_reached", 400)

    parsed: list[tuple[dict[str, Any], dict[str, Any], int]] = []
    seen_local_ids: set[str] = set()
    seen_names: set[str] = set()
    for item in incoming:
        fields = nominee_draft_to_related_party_fields(item)
        if not fields:
            raise KycError("Enter a valid nominee name.", "nominee_invalid", 400)
        share = int(fields["share_percent"] or 0)
        if share < 1 or share > 100:
            raise KycError("Nominee share must be between 1% and 100%.", "nominee_share_invalid", 400)
        local_id = str(fields.get("local_nominee_id") or "").strip()
        if local_id:
            if local_id in seen_local_ids:
                raise KycError("Each nominee can only appear once.", "nominee_invalid", 400)
            seen_local_ids.add(local_id)
        name_key = str(fields["name"]).strip().lower()
        if name_key in seen_names:
            raise KycError("Nominee names must be unique.", "nominee_invalid", 400)
        seen_names.add(name_key)
        parsed.append((item, fields, share))

    new_share = sum(share for _, _, share in parsed)
    if parsed and new_share != 100:
        raise KycError(
            "Nominee shares must total 100% before they can be saved to your folios.",
            "nominee_share_invalid",
            400,
        )

    investor_pan = _investor_pan_number(journey)
    if investor_pan:
        for _, fields, _share in parsed:
            if _normalize_pan(fields.get("pan")) == investor_pan or _normalize_pan(fields.get("guardian_pan")) == investor_pan:
                raise KycError(
                    "Nominee PAN cannot be the same as your PAN. Enter the nominee’s PAN, or leave it blank.",
                    "nominee_pan_matches_investor",
                    400,
                )

    by_local_id = {
        str(row.local_nominee_id): row
        for row in (profile.related_parties or [])
        if row.local_nominee_id
    }

    linked_rows: list[InvestorRelatedParty] = []
    for item, fields, share in parsed:
        local_id = str(fields.get("local_nominee_id") or "").strip()
        row = by_local_id.get(local_id) if local_id else None
        if row is None:
            row = InvestorRelatedParty(
                investor_profile_id=profile.user_id,
                source=InvestorObjectSource.user,
                sync_status=InvestorObjectSyncStatus.draft,
                local_nominee_id=fields["local_nominee_id"],
                name=fields["name"],
                party_relationship=fields["party_relationship"],
                date_of_birth=fields["date_of_birth"],
                pan=fields["pan"],
                guardian_name=fields["guardian_name"],
                guardian_pan=fields["guardian_pan"],
                share_percent=share,
                external_payload_json=fields["external_payload_json"],
            )
            db.add(row)
            await db.flush()
            if local_id:
                by_local_id[local_id] = row
        else:
            row.share_percent = share
            row.external_payload_json = fields["external_payload_json"]

        if not str(row.external_related_party_id or "").strip():
            try:
                await provision_related_party_row(
                    db,
                    profile_id=str(profile.external_profile_id),
                    party_row=row,
                )
            except FpClientError as exc:
                log_exception_dump(
                    "Related party create/patch failed",
                    exc,
                    local_nominee_id=fields["local_nominee_id"],
                    fp_status=exc.status_code,
                    fp_code=exc.code,
                    fp_message=exc.message,
                    fp_response=exc.response_data,
                    sync_status=str(row.sync_status),
                    external_related_party_id=row.external_related_party_id,
                )
                raise _related_party_create_error(exc) from exc

        if not row.external_related_party_id:
            log_exception_dump(
                "Related party HTTP succeeded but no id was stored",
                local_nominee_id=fields["local_nominee_id"],
                sync_status=str(row.sync_status),
                payload=row.external_payload_json,
            )
            raise KycError("Could not create nominee on the investment account.", "related_party_create_failed", 502)

        linked_rows.append(row)
        core = item.get("core") if isinstance(item.get("core"), dict) else {}
        core["sharePercent"] = str(share)
        item["core"] = core

    links: list[tuple[str, int]] = []
    seen_related_party_ids: set[str] = set()
    for row in linked_rows:
        related_party_id = str(row.external_related_party_id or "").strip()
        if related_party_id and related_party_id not in seen_related_party_ids:
            links.append((related_party_id, int(row.share_percent or 0)))
            seen_related_party_ids.add(related_party_id)

    print(
        f"[MFIA] nominee folio set replaced links={links} mfia={getattr(mfia, 'fp_mfia_id', None)}",
        flush=True,
    )

    allocation_total = sum(share for _related_party_id, share in links)
    if parsed and not links:
        raise KycError(
            "Nominee was created on the investor profile but Finprim did not return a related_party id.",
            "related_party_create_failed",
            502,
        )
    if parsed and allocation_total != 100:
        raise KycError(
            f"Investment account nominees must total 100% before they can be linked (got {allocation_total}%).",
            "nominee_share_invalid",
            400,
        )
    if not mfia or not str(mfia.fp_mfia_id or "").strip():
        raise KycError(
            "Nominee is on the investor profile, but no MF investment account id exists in our table to PATCH.",
            "mf_investment_account_missing",
            502,
        )

    try:
        await patch_mfia_folio_defaults(
            db,
            user_id=user.id,
            updates=build_nominee_slot_defaults_from_links(links),
        )
    except FpClientError as exc:
        log_exception_dump(
            "MFIA nominee folio_defaults PATCH failed",
            exc,
            fp_status=exc.status_code,
            fp_code=exc.code,
            fp_message=exc.message,
            fp_response=exc.response_data,
            links=links,
            mfia_id=mfia.fp_mfia_id,
        )
        raise KycError(
            exc.message or "Finprim rejected linking nominees onto the investment account.",
            "mfia_nominee_link_failed",
            400 if exc.status_code == 400 else 502,
        ) from exc
    except Exception as exc:
        log_exception_dump(
            "Unexpected error while PATCHing MFIA nominee folio_defaults",
            exc,
            links=links,
            mfia_id=mfia.fp_mfia_id,
        )
        raise KycError(
            f"Could not PATCH investment account folio_defaults: {exc}",
            "mfia_nominee_link_failed",
            502,
        ) from exc

    journey.nominee_draft_json = incoming
    if parsed and status.nominee_step_status in {KycStepStatus.pending, KycStepStatus.skipped}:
        status.nominee_step_status = KycStepStatus.saved

    if parsed and consent_context and await user_revocable_consent_active(
        db,
        user_id=user.id,
        definition_key=KYC_NOMINATION_OPT_OUT,
    ):
        try:
            await record_revocation(
                db,
                user=user,
                definition_key=KYC_NOMINATION_OPT_OUT,
                context=consent_context,
            )
        except ConsentError:
            pass

    await db.flush()
    return await get_investor_settings_state(db, user_id=user.id)


__all__ = [
    "MAX_INVESTOR_NOMINEES",
    "add_investor_nominee",
    "get_investor_settings_state",
    "update_investor_profile_settings",
]
