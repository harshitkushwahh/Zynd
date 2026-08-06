"""Resolve and ensure Finprim MF investment accounts for a user."""

from __future__ import annotations

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.mf_folio_defaults_service import ensure_mfia_folio_defaults
from app.application.mf.mf_order_service import get_or_create_mf_investment_account
from app.core.config import get_settings
from app.infrastructure.mf.fp_oms_client import (
    create_mf_investment_account,
    extract_fp_old_id,
    get_mf_investment_account,
)
from app.infrastructure.persistence.investor_models import InvestorProfile, InvestorProfileStatus
from app.infrastructure.persistence.mf_transaction_models import (
    MfInvestmentAccount,
    MfInvestmentAccountStatus,
)

logger = logging.getLogger(__name__)


async def ensure_mfia_old_id(session: AsyncSession, *, mfia: MfInvestmentAccount) -> int | None:
    """Backfill numeric MFIA id required by legacy holdings report APIs."""
    if mfia.fp_mfia_old_id is not None:
        return mfia.fp_mfia_old_id
    if not mfia.fp_mfia_id:
        return None

    settings = get_settings()
    if not settings.resolved_fp_enabled:
        return mfia.fp_mfia_old_id

    try:
        payload = await get_mf_investment_account(mfia.fp_mfia_id)
    except Exception:
        logger.exception("Failed to fetch MFIA %s for old_id backfill", mfia.fp_mfia_id)
        return None

    old_id = extract_fp_old_id(payload)
    if old_id is not None:
        mfia.fp_mfia_old_id = old_id
        await session.flush()
    return old_id


async def ensure_fp_mfia(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    mfia: MfInvestmentAccount | None = None,
) -> str | None:
    """Ensure user has an active Finprim MFIA with folio defaults applied."""
    account = mfia or await get_or_create_mf_investment_account(session, user_id=user_id)

    if account.fp_mfia_id and account.status == MfInvestmentAccountStatus.active:
        folio_ready = await ensure_mfia_folio_defaults(session, user_id=user_id, mfia=account)
        if folio_ready:
            await ensure_mfia_old_id(session, mfia=account)
        return account.fp_mfia_id if folio_ready else None

    profile = await session.get(InvestorProfile, user_id)
    if not profile or profile.status != InvestorProfileStatus.active or not profile.external_profile_id:
        return None

    settings = get_settings()
    if not settings.resolved_fp_enabled:
        logger.warning("Skipping MFIA creation for user=%s — Finprim is not enabled", user_id)
        return None

    result = await create_mf_investment_account(investor_profile_id=profile.external_profile_id)
    fp_mfia_id = result.get("fp_mfia_id")
    if not fp_mfia_id:
        account.status = MfInvestmentAccountStatus.failed
        account.failure_reason = "Finprim did not return mf_investment_account id"
        await session.flush()
        return None

    account.fp_mfia_id = fp_mfia_id
    account.fp_mfia_old_id = result.get("fp_mfia_old_id")
    account.status = MfInvestmentAccountStatus.active
    account.failure_reason = None
    await session.flush()

    if not await ensure_mfia_folio_defaults(session, user_id=user_id, mfia=account):
        return None

    await ensure_mfia_old_id(session, mfia=account)
    return fp_mfia_id
