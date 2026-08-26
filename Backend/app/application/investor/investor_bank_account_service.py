from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.investor.investor_bank_account_crypto import encrypt_account_number, read_account_number
from app.application.investor.investor_bank_account_errors import InvestorBankAccountError
from app.application.investor.indian_bank_display import resolve_bank_display_name
from app.application.investor.investor_provision_mapper import build_bank_account_payload
from app.application.kyc.bank_verification_core import (
    BankVerificationError,
    extract_bank_account_result,
    extract_readiness_verified,
    holder_name_from_pan_draft,
    is_verified_result,
    map_account_type,
    run_hybrid_bank_verification,
)
from app.application.kyc.journey_state_service import get_or_create_journey
from app.application.mf.mf_folio_defaults_service import refresh_mfia_payout_bank_account
from app.application.mf.mf_mandate_guard import (
    count_active_sips_for_bank,
    find_blocking_mandate_for_bank,
    has_in_flight_mandate_for_bank,
)
from app.core.config import get_settings
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.mf.fp_investor_client import create_bank_account
from app.infrastructure.persistence.investor_models import (
    InvestorBankAccount,
    InvestorBankVerificationStatus,
    InvestorObjectSource,
    InvestorObjectSyncStatus,
    InvestorProfile,
)
from app.infrastructure.persistence.models import KycJourneyState, KycOverallStatus, User, UserKycStatus
from app.infrastructure.persistence.repositories.investor_profile_repository import (
    get_or_create_pending_investor_profile,
)

logger = logging.getLogger(__name__)

MAX_BANK_ACCOUNTS_PER_USER = 5

KYC_ACCOUNT_TYPE_MAP = {
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


def _ifsc_bank_prefix(ifsc_code: str) -> str:
    return _str(ifsc_code).upper()[:4]


def _bank_account_identity_key(row: InvestorBankAccount) -> str:
    account_number = read_account_number(row)
    if account_number:
        return f"acct:{account_number.strip()}"
    return f"last4:{row.account_number_last4}:{_ifsc_bank_prefix(row.ifsc_code)}"


def _bank_account_preference_score(row: InvestorBankAccount) -> tuple[Any, ...]:
    bank_name = _str(row.bank_name)
    return (
        1 if row.verification_status == InvestorBankVerificationStatus.verified else 0,
        1 if row.external_bank_account_id else 0,
        len(bank_name),
        1 if len(bank_name) > 6 else 0,
        1 if row.is_primary else 0,
        row.created_at or datetime.min.replace(tzinfo=timezone.utc),
    )


async def _find_existing_bank_account(
    db: AsyncSession,
    *,
    user_id: UUID,
    account_number: str,
    ifsc_code: str,
) -> InvestorBankAccount | None:
    account_no = account_number.strip()
    ifsc = ifsc_code.strip().upper()
    last4 = _account_last4(account_no)

    exact = await db.scalar(
        select(InvestorBankAccount).where(
            InvestorBankAccount.investor_profile_id == user_id,
            InvestorBankAccount.account_number_last4 == last4,
            InvestorBankAccount.ifsc_code == ifsc,
        )
    )
    if exact:
        return exact

    candidates = (
        await db.scalars(
            select(InvestorBankAccount).where(
                InvestorBankAccount.investor_profile_id == user_id,
                InvestorBankAccount.account_number_last4 == last4,
            )
        )
    ).all()

    for row in candidates:
        stored = read_account_number(row)
        if stored and stored.strip() == account_no:
            return row

    bank_prefix = _ifsc_bank_prefix(ifsc)
    prefix_matches = [row for row in candidates if _ifsc_bank_prefix(row.ifsc_code) == bank_prefix]
    if len(prefix_matches) == 1:
        return prefix_matches[0]
    return None


async def _consolidate_duplicate_bank_accounts(
    db: AsyncSession,
    rows: list[InvestorBankAccount],
) -> list[InvestorBankAccount]:
    active = [row for row in rows if not is_bank_account_disabled(row)]

    account_number_by_loose_key: dict[str, str] = {}
    loose_buckets: dict[str, list[InvestorBankAccount]] = {}
    for row in active:
        loose_key = f"last4:{row.account_number_last4}:{_ifsc_bank_prefix(row.ifsc_code)}"
        loose_buckets.setdefault(loose_key, []).append(row)
    for loose_key, bucket in loose_buckets.items():
        account_numbers = {
            read_account_number(row).strip()
            for row in bucket
            if read_account_number(row)
        }
        if len(account_numbers) == 1:
            account_number_by_loose_key[loose_key] = account_numbers.pop()

    multi_loose_keys = {key for key, bucket in loose_buckets.items() if len(bucket) > 1}

    groups: dict[str, list[InvestorBankAccount]] = {}
    for row in active:
        loose_key = f"last4:{row.account_number_last4}:{_ifsc_bank_prefix(row.ifsc_code)}"
        account_number = read_account_number(row)
        if loose_key in multi_loose_keys:
            if account_number:
                key = f"acct:{account_number.strip()}"
            else:
                promoted = account_number_by_loose_key.get(loose_key)
                key = f"acct:{promoted}" if promoted else loose_key
        elif account_number:
            key = f"acct:{account_number.strip()}"
        else:
            promoted = account_number_by_loose_key.get(loose_key)
            key = f"acct:{promoted}" if promoted else loose_key
        groups.setdefault(key, []).append(row)

    kept: list[InvestorBankAccount] = []
    changed = False
    for group in groups.values():
        if len(group) == 1:
            kept.append(group[0])
            continue

        ranked = sorted(group, key=_bank_account_preference_score, reverse=True)
        winner = ranked[0]
        kept.append(winner)

        for loser in ranked[1:]:
            metadata = loser.metadata_json if isinstance(loser.metadata_json, dict) else {}
            if metadata.get("disabled"):
                continue

            if loser.is_primary:
                winner.is_primary = True
                loser.is_primary = False
                changed = True

            if not _str(winner.bank_name) and _str(loser.bank_name):
                winner.bank_name = loser.bank_name[:120]
                changed = True
            elif len(_str(loser.bank_name)) > len(_str(winner.bank_name)):
                winner.bank_name = loser.bank_name[:120]
                changed = True

            if not winner.external_bank_account_id and loser.external_bank_account_id:
                winner.external_bank_account_id = loser.external_bank_account_id
                winner.external_old_id = loser.external_old_id
                changed = True

            loser.metadata_json = {
                **metadata,
                "disabled": True,
                "disabledAt": datetime.now(timezone.utc).isoformat(),
                "disabledReason": "duplicate_account_number",
                "consolidatedInto": str(winner.id),
            }
            loser.is_primary = False
            changed = True

    if changed:
        await db.flush()
        for row in kept:
            await db.refresh(row)
    return kept

def _map_verification_status(
    *,
    bank_verified: bool,
    requires_manual: bool,
) -> InvestorBankVerificationStatus:
    if bank_verified:
        return InvestorBankVerificationStatus.verified
    if requires_manual:
        return InvestorBankVerificationStatus.manual_required
    return InvestorBankVerificationStatus.failed


def _map_journey_verification_status(raw: Any) -> InvestorBankVerificationStatus:
    normalized = _str(raw).lower()
    if normalized == "verified":
        return InvestorBankVerificationStatus.verified
    if normalized == "manual_required":
        return InvestorBankVerificationStatus.manual_required
    if normalized == "failed":
        return InvestorBankVerificationStatus.failed
    return InvestorBankVerificationStatus.pending


def _map_bank_verification_error(exc: BankVerificationError) -> InvestorBankAccountError:
    return InvestorBankAccountError(code=exc.code, message=exc.message, status_code=exc.status_code)


def is_bank_account_disabled(row: InvestorBankAccount) -> bool:
    metadata = row.metadata_json if isinstance(row.metadata_json, dict) else {}
    return bool(metadata.get("disabled"))


def _clear_disabled_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
    updated = dict(metadata)
    updated.pop("disabled", None)
    updated.pop("disabledAt", None)
    return updated


async def _count_active_bank_accounts(db: AsyncSession, *, user_id: UUID) -> int:
    rows = (
        await db.scalars(select(InvestorBankAccount).where(InvestorBankAccount.investor_profile_id == user_id))
    ).all()
    return sum(1 for row in rows if not is_bank_account_disabled(row))


async def _is_kyc_completed(db: AsyncSession, user_id: UUID) -> bool:
    status = await db.get(UserKycStatus, user_id)
    return bool(status and status.overall_status == KycOverallStatus.completed)


async def _require_kyc_completed(db: AsyncSession, user_id: UUID) -> None:
    if not await _is_kyc_completed(db, user_id):
        raise InvestorBankAccountError(
            code="kyc_required",
            message="Complete KYC verification before managing bank accounts.",
            status_code=403,
        )


async def _require_pan_verified_journey(db: AsyncSession, user_id: UUID):
    journey = await get_or_create_journey(db, user_id)
    pan_draft = journey.pan_draft_json if isinstance(journey.pan_draft_json, dict) else {}
    pan_number = _str(pan_draft.get("panNumber")).upper()
    if not pan_number:
        raise InvestorBankAccountError(
            code="pan_not_verified",
            message="Complete PAN verification before managing bank accounts.",
            status_code=403,
        )
    return journey, pan_draft, pan_number


async def _get_owned_bank_account(
    db: AsyncSession,
    *,
    user_id: UUID,
    bank_account_id: UUID,
    allow_disabled: bool = False,
) -> InvestorBankAccount:
    row = await db.scalar(
        select(InvestorBankAccount).where(
            InvestorBankAccount.id == bank_account_id,
            InvestorBankAccount.investor_profile_id == user_id,
        )
    )
    if not row:
        raise InvestorBankAccountError(
            code="bank_account_not_found",
            message="Bank account not found.",
            status_code=404,
        )
    if not allow_disabled and is_bank_account_disabled(row):
        raise InvestorBankAccountError(
            code="bank_account_not_found",
            message="Bank account not found.",
            status_code=404,
        )
    return row


async def _serialize_bank_account_from_session(db: AsyncSession, row: InvestorBankAccount) -> dict[str, Any]:
    await db.refresh(row)
    return serialize_bank_account(row)


async def _serialize_bank_account_for_list(
    db: AsyncSession,
    *,
    user_id: UUID,
    row: InvestorBankAccount,
) -> dict[str, Any]:
    payload = await _serialize_bank_account_from_session(db, row)
    return await _enrich_bank_account_hub_fields(db, user_id=user_id, row=row, payload=payload)


def serialize_bank_account(row: InvestorBankAccount) -> dict[str, Any]:
    metadata = row.metadata_json if isinstance(row.metadata_json, dict) else {}
    failure = row.verification_failure_json if isinstance(row.verification_failure_json, dict) else None
    payload = {
        "id": str(row.id),
        "account_number_masked": f"•••• {row.account_number_last4}",
        "account_number_last4": row.account_number_last4,
        "ifsc_code": row.ifsc_code,
        "account_type": row.account_type,
        "account_holder_name": row.primary_account_holder_name,
        "pan_account_holder_name": row.pan_account_holder_name,
        "bank_name": resolve_bank_display_name(row.bank_name, row.ifsc_code),
        "branch_name": row.branch_name,
        "is_primary": row.is_primary,
        "source": row.source.value,
        "verification_status": row.verification_status.value,
        "sync_status": row.sync_status.value,
        "requires_manual_verification": row.verification_status == InvestorBankVerificationStatus.manual_required,
        "requires_proof_upload": bool(
            row.verification_status == InvestorBankVerificationStatus.manual_required
            and not row.cancelled_cheque_file_id
        ),
        "proof_uploaded": bool(row.cancelled_cheque_file_id),
        "preverify_id": row.poa_preverify_id,
        "failure": failure,
        "readiness_verified": bool(metadata.get("readinessVerified")),
        "external_bank_account_id": row.external_bank_account_id,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }
    payload["is_payment_ready"] = _is_bank_account_payment_ready(row)
    payload["active_sip_count"] = 0
    payload["blocks_removal"] = False
    payload["blocks_primary_switch"] = False
    return payload


def _is_bank_account_payment_ready(row: InvestorBankAccount) -> bool:
    return (
        row.verification_status == InvestorBankVerificationStatus.verified
        and row.sync_status == InvestorObjectSyncStatus.active
        and bool(row.external_bank_account_id)
        and not is_bank_account_disabled(row)
    )


async def _enrich_bank_account_hub_fields(
    db: AsyncSession,
    *,
    user_id: UUID,
    row: InvestorBankAccount,
    payload: dict[str, Any],
) -> dict[str, Any]:
    active_sip_count = 0
    in_flight_mandate = False
    if row.external_old_id is not None:
        bank_old_id = int(row.external_old_id)
        active_sip_count = await count_active_sips_for_bank(
            db,
            user_id=user_id,
            bank_account_old_id=bank_old_id,
        )
        in_flight_mandate = await has_in_flight_mandate_for_bank(
            db,
            user_id=user_id,
            bank_account_old_id=bank_old_id,
        )
    payload["active_sip_count"] = active_sip_count
    payload["blocks_removal"] = active_sip_count > 0 or in_flight_mandate
    if row.is_primary and row.external_old_id is not None:
        blocking_mandate = await find_blocking_mandate_for_bank(
            db,
            user_id=user_id,
            bank_account_old_id=int(row.external_old_id),
        )
        payload["blocks_primary_switch"] = blocking_mandate is not None
    else:
        payload["blocks_primary_switch"] = False
    return payload


async def list_user_bank_accounts(db: AsyncSession, *, user_id: UUID) -> list[dict[str, Any]]:
    if not await _is_kyc_completed(db, user_id):
        return []
    journey, _, _ = await _require_pan_verified_journey(db, user_id)
    profile = await get_or_create_pending_investor_profile(db, user_id=user_id)
    rows = (
        await db.scalars(
            select(InvestorBankAccount)
            .where(InvestorBankAccount.investor_profile_id == user_id)
            .order_by(InvestorBankAccount.is_primary.desc(), InvestorBankAccount.created_at.asc())
        )
    ).all()
    consolidated = await _consolidate_duplicate_bank_accounts(db, list(rows))
    settings = get_settings()
    for row in consolidated:
        if _bank_needs_payment_setup(row):
            await _provision_bank_account_if_ready(
                db,
                profile=profile,
                bank_row=row,
                journey=journey,
            )
    for row in consolidated:
        if not _bank_needs_payment_setup(row):
            continue
        if not settings.resolved_fp_enabled or settings.debug:
            _apply_stub_bank_payment_ids(row)
    await db.flush()
    return [await _serialize_bank_account_for_list(db, user_id=user_id, row=row) for row in consolidated]


async def verify_and_add_bank_account(
    db: AsyncSession,
    *,
    user: User,
    account_number: str,
    account_type: str,
    ifsc_code: str,
) -> dict[str, Any]:
    await _require_kyc_completed(db, user.id)
    journey, pan_draft, pan_number = await _require_pan_verified_journey(db, user.id)
    profile = await get_or_create_pending_investor_profile(db, user_id=user.id)

    ifsc = ifsc_code.strip().upper()
    account_no = account_number.strip()
    last4 = _account_last4(account_no)

    existing = await _find_existing_bank_account(
        db,
        user_id=user.id,
        account_number=account_no,
        ifsc_code=ifsc,
    )
    if (
        existing
        and existing.verification_status == InvestorBankVerificationStatus.verified
        and not is_bank_account_disabled(existing)
    ):
        raise InvestorBankAccountError(
            code="bank_account_exists",
            message="This bank account is already saved and verified.",
            status_code=409,
        )

    needs_new_active_slot = not existing or is_bank_account_disabled(existing)
    if needs_new_active_slot:
        active_count = await _count_active_bank_accounts(db, user_id=user.id)
        if active_count >= MAX_BANK_ACCOUNTS_PER_USER:
            raise InvestorBankAccountError(
                code="bank_account_limit_reached",
                message=f"You can save up to {MAX_BANK_ACCOUNTS_PER_USER} bank accounts.",
                status_code=400,
            )

    try:
        outcome = await run_hybrid_bank_verification(
            pan_draft=pan_draft,
            pan_number=pan_number,
            account_number=account_no,
            account_type=account_type,
            ifsc_code=ifsc,
            kyc_already_registered=journey.kyc_already_registered,
        )
    except BankVerificationError as exc:
        raise _map_bank_verification_error(exc) from exc

    verification_status = _map_verification_status(
        bank_verified=outcome.bank_verified,
        requires_manual=outcome.requires_manual,
    )
    if outcome.requires_manual and not outcome.bank_verified:
        verification_status = InvestorBankVerificationStatus.manual_required
    elif not outcome.bank_verified and not outcome.requires_manual:
        verification_status = InvestorBankVerificationStatus.failed

    ciphertext, key_version = encrypt_account_number(account_no)
    mapped_account_type = map_account_type(account_type)
    metadata = _clear_disabled_metadata(
        {
            "readinessVerified": outcome.readiness_verified,
            "poaAccountType": outcome.poa_account_type,
            "seededFrom": "user_add",
        }
    )

    has_primary = await db.scalar(
        select(InvestorBankAccount.id).where(
            InvestorBankAccount.investor_profile_id == user.id,
            InvestorBankAccount.is_primary.is_(True),
        )
    )

    if existing:
        row = existing
        row.ifsc_code = ifsc
        row.primary_account_holder_name = (outcome.kyckart_holder_name or outcome.pan_holder_name)[:120]
        row.pan_account_holder_name = outcome.pan_holder_name[:120]
        row.bank_name = outcome.bank_name[:120] or None
        row.branch_name = outcome.branch[:120] or None
        row.account_type = mapped_account_type
        row.poa_preverify_id = outcome.preverify_id or None
        row.verification_status = verification_status
        row.verification_failure_json = outcome.failure
        row.account_number_ciphertext = ciphertext
        row.account_number_key_version = key_version
        row.metadata_json = metadata
        row.source = InvestorObjectSource.user
        if verification_status != InvestorBankVerificationStatus.verified:
            row.sync_status = InvestorObjectSyncStatus.draft
    else:
        row = InvestorBankAccount(
            investor_profile_id=user.id,
            is_primary=not bool(has_primary),
            account_type=mapped_account_type,
            account_number_last4=last4,
            ifsc_code=ifsc,
            primary_account_holder_name=(outcome.kyckart_holder_name or outcome.pan_holder_name)[:120],
            pan_account_holder_name=outcome.pan_holder_name[:120],
            bank_name=outcome.bank_name[:120] or None,
            branch_name=outcome.branch[:120] or None,
            poa_preverify_id=outcome.preverify_id or None,
            verification_status=verification_status,
            verification_failure_json=outcome.failure,
            account_number_ciphertext=ciphertext,
            account_number_key_version=key_version,
            metadata_json=metadata,
            source=InvestorObjectSource.user,
            sync_status=InvestorObjectSyncStatus.draft,
        )
        db.add(row)

    await db.flush()

    if verification_status == InvestorBankVerificationStatus.verified:
        await _provision_bank_account_if_ready(db, profile=profile, bank_row=row, journey=journey)

    payload = await _serialize_bank_account_from_session(db, row)
    payload.update(
        {
            "success": outcome.bank_verified,
            "pan_verified": outcome.pan_verified,
            "bank_verified": outcome.bank_verified,
            "requires_manual_verification": outcome.requires_manual,
            "requires_proof_upload": outcome.requires_proof_upload,
        }
    )
    return payload


async def upload_bank_account_proof(
    db: AsyncSession,
    *,
    user: User,
    bank_account_id: UUID,
    file_bytes: bytes,
    filename: str,
    content_type: str,
) -> dict[str, Any]:
    from app.infrastructure.kyc.poa_client import upload_poa_file

    await _require_kyc_completed(db, user.id)
    await _require_pan_verified_journey(db, user.id)
    row = await _get_owned_bank_account(db, user_id=user.id, bank_account_id=bank_account_id)

    if row.verification_status not in {
        InvestorBankVerificationStatus.manual_required,
        InvestorBankVerificationStatus.pending,
        InvestorBankVerificationStatus.failed,
    }:
        raise InvestorBankAccountError(
            code="proof_not_required",
            message="Proof upload is not required for this bank account.",
            status_code=400,
        )
    if not row.poa_preverify_id:
        raise InvestorBankAccountError(
            code="bank_not_started",
            message="Verify bank details before uploading proof.",
            status_code=400,
        )

    allowed_types = {"application/pdf", "image/jpeg", "image/jpg", "image/png"}
    if content_type not in allowed_types:
        raise InvestorBankAccountError(
            code="invalid_file_type",
            message="Unsupported file type. Use PDF, JPEG, or PNG.",
            status_code=400,
        )
    if len(file_bytes) > 10 * 1024 * 1024:
        raise InvestorBankAccountError(
            code="file_too_large",
            message="File size must be 10MB or less.",
            status_code=400,
        )

    uploaded = await upload_poa_file(
        file_bytes=file_bytes,
        filename=filename,
        content_type=content_type,
        purpose="bank account proof",
    )
    file_id = str(uploaded.get("id") or "")
    row.cancelled_cheque_file_id = file_id
    await db.flush()
    return {"file_id": file_id, "bank_account": await _serialize_bank_account_from_session(db, row)}


async def verify_bank_account_manual(
    db: AsyncSession,
    *,
    user: User,
    bank_account_id: UUID,
) -> dict[str, Any]:
    from app.infrastructure.kyc.poa_client import poa_verify_bank_account_manual

    await _require_kyc_completed(db, user.id)
    journey, pan_draft, pan_number = await _require_pan_verified_journey(db, user.id)
    profile = await get_or_create_pending_investor_profile(db, user_id=user.id)
    row = await _get_owned_bank_account(db, user_id=user.id, bank_account_id=bank_account_id)

    if not row.poa_preverify_id:
        raise InvestorBankAccountError(
            code="bank_not_started",
            message="Verify bank details before manual verification.",
            status_code=400,
        )
    if not row.cancelled_cheque_file_id:
        raise InvestorBankAccountError(
            code="bank_proof_required",
            message="Upload bank account proof before manual verification.",
            status_code=400,
        )

    account_number = read_account_number(row)
    if not account_number:
        raise InvestorBankAccountError(
            code="bank_account_number_missing",
            message="Bank account number is unavailable for verification.",
            status_code=400,
        )

    account_holder_name = row.pan_account_holder_name or holder_name_from_pan_draft(pan_draft)
    if not account_holder_name:
        raise InvestorBankAccountError(
            code="pan_name_unavailable",
            message="Complete PAN verification before verifying your bank account.",
            status_code=403,
        )

    metadata = row.metadata_json if isinstance(row.metadata_json, dict) else {}
    poa_account_type = _str(metadata.get("poaAccountType")) or row.account_type

    try:
        poa_result = await poa_verify_bank_account_manual(
            pan_number=pan_number,
            account_holder_name=account_holder_name,
            account_number=account_number,
            ifsc_code=row.ifsc_code,
            account_type=poa_account_type,
            proof_file_id=row.cancelled_cheque_file_id,
        )
    except FpClientError as exc:
        raise InvestorBankAccountError(code=exc.code, message=exc.message, status_code=exc.status_code) from exc

    bank_result = extract_bank_account_result(poa_result)
    bank_verified = is_verified_result(bank_result)
    readiness_verified = extract_readiness_verified(
        poa_result,
        kyc_already_registered=journey.kyc_already_registered,
    )

    failure: dict[str, Any] | None = None
    if not bank_verified:
        failure = {
            "field": "bank_account",
            "code": bank_result.get("code"),
            "reason": bank_result.get("reason") or "Manual bank verification failed.",
        }

    row.poa_preverify_id = str(poa_result.get("id") or row.poa_preverify_id)
    row.verification_status = (
        InvestorBankVerificationStatus.verified if bank_verified else InvestorBankVerificationStatus.failed
    )
    row.verification_failure_json = failure
    row.metadata_json = {**metadata, "readinessVerified": readiness_verified}

    await db.flush()

    if bank_verified:
        await _provision_bank_account_if_ready(db, profile=profile, bank_row=row, journey=journey)

    payload = await _serialize_bank_account_from_session(db, row)
    payload.update(
        {
            "success": bank_verified,
            "bank_verified": bank_verified,
            "readiness_verified": readiness_verified,
            "requires_manual_verification": not bank_verified,
            "requires_proof_upload": False,
        }
    )
    return payload


async def get_bank_account_preverify_status(
    db: AsyncSession,
    *,
    user_id: UUID,
    bank_account_id: UUID,
    preverify_id: str,
) -> dict[str, Any]:
    from app.infrastructure.kyc.poa_client import fetch_poa_preverification

    await _require_kyc_completed(db, user_id)
    row = await _get_owned_bank_account(db, user_id=user_id, bank_account_id=bank_account_id)
    if row.poa_preverify_id != preverify_id:
        raise InvestorBankAccountError(
            code="preverify_not_found",
            message="Pre-verification record not found.",
            status_code=404,
        )

    try:
        payload = await fetch_poa_preverification(preverify_id)
    except FpClientError as exc:
        raise InvestorBankAccountError(code=exc.code, message=exc.message, status_code=exc.status_code) from exc

    bank_result = extract_bank_account_result(payload)
    return {
        "status": payload.get("status"),
        "bank_verified": is_verified_result(bank_result),
        "code": bank_result.get("code"),
        "reason": bank_result.get("reason"),
    }


async def set_primary_bank_account(
    db: AsyncSession,
    *,
    user_id: UUID,
    bank_account_id: UUID,
) -> dict[str, Any]:
    await _require_kyc_completed(db, user_id)
    await _require_pan_verified_journey(db, user_id)
    target = await _get_owned_bank_account(db, user_id=user_id, bank_account_id=bank_account_id)

    if target.verification_status != InvestorBankVerificationStatus.verified:
        raise InvestorBankAccountError(
            code="bank_not_verified",
            message="Only verified bank accounts can be set as primary.",
            status_code=400,
        )
    if target.is_primary:
        return serialize_bank_account(target)

    current_primary = await db.scalar(
        select(InvestorBankAccount).where(
            InvestorBankAccount.investor_profile_id == user_id,
            InvestorBankAccount.is_primary.is_(True),
        )
    )
    if current_primary and current_primary.id != target.id and current_primary.external_old_id is not None:
        from app.application.mf.mf_mandate_service import reconcile_bank_mandates_from_fp

        await reconcile_bank_mandates_from_fp(
            db,
            user_id=user_id,
            bank_account_old_id=int(current_primary.external_old_id),
            force=True,
        )
        blocking_mandate = await find_blocking_mandate_for_bank(
            db,
            user_id=user_id,
            bank_account_old_id=int(current_primary.external_old_id),
        )
        if blocking_mandate:
            raise InvestorBankAccountError(
                code="active_mandate_exists",
                message="Switch your SIP to another bank account before changing your primary payout bank.",
                status_code=409,
            )

    await db.execute(
        update(InvestorBankAccount)
        .where(InvestorBankAccount.investor_profile_id == user_id)
        .values(is_primary=False)
    )
    target.is_primary = True
    await db.flush()

    if target.external_bank_account_id:
        await refresh_mfia_payout_bank_account(db, user_id=user_id, bank=target)

    return await _serialize_bank_account_from_session(db, target)


async def disable_bank_account(
    db: AsyncSession,
    *,
    user_id: UUID,
    bank_account_id: UUID,
) -> None:
    await _require_kyc_completed(db, user_id)
    await _require_pan_verified_journey(db, user_id)
    row = await _get_owned_bank_account(
        db,
        user_id=user_id,
        bank_account_id=bank_account_id,
        allow_disabled=True,
    )
    if is_bank_account_disabled(row):
        return

    if row.is_primary:
        raise InvestorBankAccountError(
            code="cannot_disable_primary",
            message="Set another bank account as primary before removing this one.",
            status_code=400,
        )

    if row.external_old_id is not None:
        from app.application.mf.mf_mandate_service import reconcile_bank_mandates_from_fp

        await reconcile_bank_mandates_from_fp(
            db,
            user_id=user_id,
            bank_account_old_id=int(row.external_old_id),
            force=True,
        )
        blocking_mandate = await find_blocking_mandate_for_bank(
            db,
            user_id=user_id,
            bank_account_old_id=int(row.external_old_id),
        )
        if blocking_mandate:
            raise InvestorBankAccountError(
                code="active_mandate_exists",
                message="Switch your SIP to another bank account before removing this one.",
                status_code=409,
            )

    metadata = row.metadata_json if isinstance(row.metadata_json, dict) else {}
    row.metadata_json = {
        **metadata,
        "disabled": True,
        "disabledAt": datetime.now(timezone.utc).isoformat(),
    }
    await db.flush()


def _stub_bank_account_external_ids(bank_row: InvestorBankAccount) -> tuple[str, int]:
    external_id = bank_row.external_bank_account_id or f"bac_stub_{bank_row.id.hex[:24]}"
    external_old_id = bank_row.external_old_id or (bank_row.id.int % 1_000_000_000 or 1)
    return external_id, external_old_id


def _apply_stub_bank_payment_ids(bank_row: InvestorBankAccount) -> None:
    external_id, external_old_id = _stub_bank_account_external_ids(bank_row)
    bank_row.external_bank_account_id = external_id
    bank_row.external_old_id = external_old_id
    bank_row.sync_status = InvestorObjectSyncStatus.active
    bank_row.failure_code = None
    bank_row.failure_reason = None


def _bank_needs_payment_setup(row: InvestorBankAccount) -> bool:
    return (
        row.verification_status == InvestorBankVerificationStatus.verified
        and not is_bank_account_disabled(row)
        and (
            row.sync_status != InvestorObjectSyncStatus.active
            or not row.external_bank_account_id
            or row.external_old_id is None
        )
    )


async def _provision_bank_account_if_ready(
    db: AsyncSession,
    *,
    profile: InvestorProfile,
    bank_row: InvestorBankAccount,
    journey,
) -> None:
    settings = get_settings()
    if bank_row.sync_status == InvestorObjectSyncStatus.active and bank_row.external_bank_account_id and bank_row.external_old_id is not None:
        return
    if bank_row.verification_status != InvestorBankVerificationStatus.verified:
        return
    if not settings.resolved_fp_enabled:
        _apply_stub_bank_payment_ids(bank_row)
        await db.flush()
        return
    if not profile.external_profile_id:
        return
    if not read_account_number(bank_row):
        return

    bank_row.sync_status = InvestorObjectSyncStatus.pending_create
    try:
        result = await create_bank_account(
            build_bank_account_payload(
                profile_id=profile.external_profile_id,
                bank_row=bank_row,
                journey=journey,
            )
        )
        bank_row.external_bank_account_id = result.get("id")
        bank_row.external_old_id = result.get("old_id")
        bank_row.external_payload_json = result.get("raw")
        bank_row.sync_status = InvestorObjectSyncStatus.active
        bank_row.failure_code = None
        bank_row.failure_reason = None
    except FpClientError as exc:
        bank_row.sync_status = InvestorObjectSyncStatus.failed
        bank_row.failure_code = "fp_bank_failed"
        bank_row.failure_reason = str(exc)
        logger.exception(
            "Failed to provision bank account user=%s bank=%s code=%s",
            profile.user_id,
            bank_row.id,
            exc.code,
        )
    await db.flush()

    if bank_row.is_primary and bank_row.external_bank_account_id:
        await refresh_mfia_payout_bank_account(db, user_id=profile.user_id, bank=bank_row)


async def sync_bank_account_from_kyc_journey(
    db: AsyncSession,
    *,
    user_id: UUID,
    journey: KycJourneyState,
) -> InvestorBankAccount | None:
    """Upsert the KYC journey bank draft into investor_bank_accounts."""
    bank = journey.bank_draft_json if isinstance(journey.bank_draft_json, dict) else {}
    account_number = _str(bank.get("accountNumber"))
    ifsc = _str(bank.get("ifscCode")).upper()
    if not account_number or not ifsc:
        return None

    profile = await get_or_create_pending_investor_profile(db, user_id=user_id)
    last4 = _account_last4(account_number)
    existing_row = await _find_existing_bank_account(
        db,
        user_id=user_id,
        account_number=account_number,
        ifsc_code=ifsc,
    )

    account_type = KYC_ACCOUNT_TYPE_MAP.get(_str(bank.get("accountType")), "savings")
    holder = _str(bank.get("accountHolderName")) or "Account Holder"
    verification_status = _map_journey_verification_status(journey.bank_verification_status)
    ciphertext, key_version = encrypt_account_number(account_number)
    pan_holder = _str(bank.get("panAccountHolderName")) or holder
    metadata = {
        "seededFrom": "kyc",
        "readinessVerified": bool(bank.get("readinessVerified")),
    }
    if _str(bank.get("poaAccountType")):
        metadata["poaAccountType"] = _str(bank.get("poaAccountType"))

    has_primary = await db.scalar(
        select(InvestorBankAccount.id).where(
            InvestorBankAccount.investor_profile_id == user_id,
            InvestorBankAccount.is_primary.is_(True),
        )
    )

    if existing_row:
        row = existing_row
        row.ifsc_code = ifsc
        row.primary_account_holder_name = holder[:120]
        row.pan_account_holder_name = pan_holder[:120] or None
        row.bank_name = _str(bank.get("bankName"))[:120] or None
        row.branch_name = _str(bank.get("branch"))[:120] or None
        row.account_type = account_type
        row.poa_preverify_id = _str(journey.poa_bank_preverify_id) or row.poa_preverify_id
        row.verification_status = verification_status
        row.verification_failure_json = journey.bank_verification_failure_json
        row.account_number_ciphertext = ciphertext
        row.account_number_key_version = key_version
        row.metadata_json = metadata
        row.source = InvestorObjectSource.kyc
        if not row.cancelled_cheque_file_id:
            row.cancelled_cheque_file_id = _str(journey.poa_bank_proof_file_id) or None
        if not has_primary and verification_status == InvestorBankVerificationStatus.verified:
            row.is_primary = True
    else:
        row = InvestorBankAccount(
            investor_profile_id=user_id,
            is_primary=not bool(has_primary),
            account_type=account_type,
            account_number_last4=last4,
            ifsc_code=ifsc,
            primary_account_holder_name=holder[:120],
            pan_account_holder_name=pan_holder[:120] or None,
            bank_name=_str(bank.get("bankName"))[:120] or None,
            branch_name=_str(bank.get("branch"))[:120] or None,
            poa_preverify_id=_str(journey.poa_bank_preverify_id) or None,
            verification_status=verification_status,
            verification_failure_json=journey.bank_verification_failure_json,
            account_number_ciphertext=ciphertext,
            account_number_key_version=key_version,
            metadata_json=metadata,
            cancelled_cheque_file_id=_str(journey.poa_bank_proof_file_id) or None,
            source=InvestorObjectSource.kyc,
            sync_status=InvestorObjectSyncStatus.draft,
        )
        db.add(row)

    await db.flush()

    if row.verification_status == InvestorBankVerificationStatus.verified:
        await _provision_bank_account_if_ready(db, profile=profile, bank_row=row, journey=journey)

    return row
