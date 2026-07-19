from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.investor.investor_bank_account_resolver import resolve_payment_bank_account
from app.application.mf.mf_fp_state import map_fp_mandate_status
from app.application.mf.mf_order_errors import MfOrderError
from app.application.mf.mf_transaction_retry import bump_transient_retry, is_transient_error, should_skip_retry
from app.core.config import get_settings
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.mf.fp_mandate_client import (
    authorize_mandate,
    cancel_mandate,
    create_mandate,
    extract_mandate_status,
    get_mandate,
)
from app.infrastructure.mf.fp_oms_client import invalidate_mf_token
from app.infrastructure.persistence.mf_transaction_models import MfMandate, MfMandateStatus

logger = logging.getLogger(__name__)

TERMINAL_MANDATE_STATUSES = {
    MfMandateStatus.approved,
    MfMandateStatus.failed,
    MfMandateStatus.cancelled,
}


def _mandate_sync_meta(metadata: dict | None) -> dict:
    meta = dict(metadata or {})
    sync = meta.get("mandate_sync")
    return dict(sync) if isinstance(sync, dict) else {}


def should_skip_mandate_sync(metadata: dict | None, *, force: bool = False) -> bool:
    if force:
        return False

    settings = get_settings()
    interval = max(settings.zynd_mf_mandate_sync_interval_seconds, 30)
    sync = _mandate_sync_meta(metadata)
    last_sync_at = sync.get("last_sync_at")
    if not last_sync_at:
        return False

    try:
        last_sync = datetime.fromisoformat(str(last_sync_at))
        if last_sync.tzinfo is None:
            last_sync = last_sync.replace(tzinfo=timezone.utc)
    except ValueError:
        return False

    return datetime.now(timezone.utc) < last_sync + timedelta(seconds=interval)


def record_mandate_sync(metadata: dict | None) -> dict:
    meta = dict(metadata or {})
    sync = _mandate_sync_meta(meta)
    sync["last_sync_at"] = datetime.now(timezone.utc).isoformat()
    meta["mandate_sync"] = sync
    return meta


def _derive_mandate_next_action(*, status: str, auth_url: str | None) -> str:
    if status == "APPROVED":
        return "complete"
    if status in {"FAILED", "CANCELLED"}:
        return "failed"
    if status == "AUTH_PENDING" and auth_url:
        return "authorize_mandate"
    return "wait_processing"


def serialize_mandate(mandate: MfMandate) -> dict:
    return {
        "mandate_id": str(mandate.id),
        "status": mandate.status.value,
        "fp_mandate_id": mandate.fp_mandate_id,
        "bank_account_old_id": mandate.bank_account_old_id,
        "mandate_type": mandate.mandate_type,
        "mandate_limit": mandate.mandate_limit,
        "fp_mandate_status": mandate.fp_mandate_status,
        "auth_url": mandate.auth_token_url,
        "next_action": _derive_mandate_next_action(
            status=mandate.status.value,
            auth_url=mandate.auth_token_url,
        ),
        "failure_code": mandate.failure_code,
        "failure_reason": mandate.failure_reason,
        "created_at": mandate.created_at.isoformat() if mandate.created_at else None,
        "approved_at": mandate.approved_at.isoformat() if mandate.approved_at else None,
    }


def _compute_mandate_limit(amount_inr: Decimal) -> int:
    settings = get_settings()
    base = max(int(amount_inr) * 2, settings.zynd_mf_sip_default_mandate_limit_inr)
    return min(base, 100_000)


async def find_approved_mandate(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    bank_account_old_id: int,
) -> MfMandate | None:
    return await session.scalar(
        select(MfMandate).where(
            MfMandate.user_id == user_id,
            MfMandate.bank_account_old_id == bank_account_old_id,
            MfMandate.status == MfMandateStatus.approved,
        )
    )


async def create_mandate_for_user(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    idempotency_key: str,
    installment_amount_inr: Decimal | None = None,
    bank_account_id: uuid.UUID | None = None,
) -> MfMandate:
    existing = await session.scalar(select(MfMandate).where(MfMandate.idempotency_key == idempotency_key))
    if existing:
        if existing.user_id != user_id:
            raise MfOrderError(code="idempotency_conflict", message="Idempotency key already used", status_code=409)
        return existing

    bank = await resolve_payment_bank_account(
        session,
        user_id=user_id,
        bank_account_id=bank_account_id,
    )
    approved = await find_approved_mandate(
        session,
        user_id=user_id,
        bank_account_old_id=int(bank.external_old_id),
    )
    if approved:
        return approved

    amount = installment_amount_inr or Decimal("5000")
    mandate = MfMandate(
        user_id=user_id,
        investor_bank_account_id=bank.id,
        bank_account_old_id=int(bank.external_old_id),
        status=MfMandateStatus.pending,
        mandate_type="UPI",
        mandate_limit=_compute_mandate_limit(amount),
        idempotency_key=idempotency_key,
    )
    session.add(mandate)
    await session.flush()
    return mandate


async def list_user_mandates(session: AsyncSession, *, user_id: uuid.UUID) -> list[MfMandate]:
    result = await session.execute(
        select(MfMandate)
        .where(MfMandate.user_id == user_id)
        .order_by(MfMandate.created_at.desc())
    )
    return list(result.scalars())


async def get_user_mandate(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    mandate_id: uuid.UUID,
) -> MfMandate | None:
    mandate = await session.get(MfMandate, mandate_id)
    if not mandate or mandate.user_id != user_id:
        return None
    return mandate


async def initiate_mandate_auth(session: AsyncSession, mandate: MfMandate) -> MfMandate:
    if mandate.status == MfMandateStatus.approved:
        return mandate
    if mandate.fp_mandate_id is None:
        raise MfOrderError(code="mandate_not_ready", message="Mandate is still being created")

    try:
        result = await authorize_mandate(mandate_id=int(mandate.fp_mandate_id))
    except FpClientError as exc:
        mandate.status = MfMandateStatus.failed
        mandate.failure_code = exc.code
        mandate.failure_reason = exc.message
        await session.flush()
        raise MfOrderError(code=exc.code, message=exc.message) from exc

    token_url = result.get("token_url")
    if token_url:
        mandate.auth_token_url = str(token_url)
    mandate.status = MfMandateStatus.auth_pending
    await session.flush()
    return mandate


async def cancel_user_mandate(session: AsyncSession, mandate: MfMandate) -> MfMandate:
    if mandate.status == MfMandateStatus.cancelled:
        return mandate
    if mandate.fp_mandate_id is not None:
        await cancel_mandate(int(mandate.fp_mandate_id))
    mandate.status = MfMandateStatus.cancelled
    await session.flush()
    return mandate


async def submit_pending_mandate(session: AsyncSession, mandate: MfMandate) -> bool:
    if mandate.status != MfMandateStatus.pending or mandate.fp_mandate_id is not None:
        return False
    if should_skip_retry(mandate.metadata_):
        return False

    try:
        result = await create_mandate(
            bank_account_id=mandate.bank_account_old_id,
            mandate_limit=mandate.mandate_limit,
            mandate_type=mandate.mandate_type,
        )
    except Exception as exc:
        logger.exception("Mandate create failed mandate=%s", mandate.id)
        if is_transient_error(exc):
            mandate.metadata_, terminal = bump_transient_retry(
                mandate.metadata_,
                error_code="fp_mandate_create_failed",
                error_message=str(exc),
            )
            await session.flush()
            return not terminal
        mandate.status = MfMandateStatus.failed
        mandate.failure_code = "fp_mandate_create_failed"
        mandate.failure_reason = str(exc)
        await session.flush()
        return True

    fp_mandate_id = result.get("id")
    if fp_mandate_id is None:
        mandate.status = MfMandateStatus.failed
        mandate.failure_code = "fp_mandate_id_missing"
        mandate.failure_reason = "Finprim did not return mandate id"
        await session.flush()
        return True

    mandate.fp_mandate_id = int(fp_mandate_id)
    mandate.status = MfMandateStatus.auth_pending
    await session.flush()

    try:
        await initiate_mandate_auth(session, mandate)
    except MfOrderError:
        return True
    return True


async def sync_mandate_from_fp(session: AsyncSession, mandate: MfMandate, *, force: bool = False) -> bool:
    if mandate.status in TERMINAL_MANDATE_STATUSES or mandate.fp_mandate_id is None:
        return False
    if should_skip_mandate_sync(mandate.metadata_, force=force):
        return False

    payload = await get_mandate(int(mandate.fp_mandate_id))
    mandate.metadata_ = record_mandate_sync(mandate.metadata_)
    fp_status = extract_mandate_status(payload)
    mapped = map_fp_mandate_status(fp_status)
    changed = mapped != mandate.status or fp_status != mandate.fp_mandate_status
    mandate.fp_mandate_status = fp_status if fp_status is not None else mandate.fp_mandate_status
    mandate.status = mapped
    if mapped == MfMandateStatus.approved and mandate.approved_at is None:
        mandate.approved_at = datetime.now(timezone.utc)
    elif mapped == MfMandateStatus.failed:
        mandate.failure_code = mandate.failure_code or "fp_mandate_failed"
        mandate.failure_reason = mandate.failure_reason or str(fp_status)
    await session.flush()
    return changed


async def process_pending_mandates(session: AsyncSession, *, batch_size: int = 10) -> dict[str, int]:
    mandates = list(
        (
            await session.execute(
                select(MfMandate)
                .where(MfMandate.status == MfMandateStatus.pending)
                .order_by(MfMandate.created_at)
                .limit(batch_size)
            )
        ).scalars()
    )
    submitted = 0
    for mandate in mandates:
        if await submit_pending_mandate(session, mandate):
            submitted += 1
    return {"processed": len(mandates), "submitted": submitted}


async def sync_open_mandates(session: AsyncSession, *, batch_size: int = 20) -> dict[str, int]:
    mandates = list(
        (
            await session.execute(
                select(MfMandate)
                .where(MfMandate.status == MfMandateStatus.auth_pending)
                .order_by(MfMandate.updated_at)
                .limit(batch_size)
            )
        ).scalars()
    )
    updated = 0
    failed = 0
    skipped = 0
    for mandate in mandates:
        if should_skip_mandate_sync(mandate.metadata_):
            skipped += 1
            continue
        try:
            if await sync_mandate_from_fp(session, mandate):
                updated += 1
        except FpClientError as exc:
            failed += 1
            mandate.metadata_ = record_mandate_sync(mandate.metadata_)
            if exc.status_code == 401:
                invalidate_mf_token()
            logger.warning(
                "Failed to sync mandate %s (fp_mandate_id=%s): %s",
                mandate.id,
                mandate.fp_mandate_id,
                exc.message,
            )
    return {"processed": len(mandates), "updated": updated, "failed": failed, "skipped": skipped}
