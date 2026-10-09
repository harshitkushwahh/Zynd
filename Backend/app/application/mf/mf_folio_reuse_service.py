"""Reuse an existing AMC folio on additional purchases and SIPs.

Cybrilla: a folio belongs to an AMC. Omitting folio_number asks the AMC to
open a new folio. Prefer the folio that already holds this ISIN; otherwise
any folio for the same AMC.
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.mf_investment_account_service import ensure_mfia_old_id
from app.application.mf.portfolio_holdings_service import parse_holdings_report
from app.infrastructure.mf.fp_oms_client import get_holdings_report, list_mf_folios
from app.infrastructure.persistence.mf_models import FundAmc, MutualFund
from app.infrastructure.persistence.mf_transaction_models import MfInvestmentAccount

logger = logging.getLogger(__name__)


def _normalize_isin(value: str | None) -> str:
    return str(value or "").strip().upper()


def _folio_number_from_record(folio: dict[str, Any]) -> str:
    return str(folio.get("number") or folio.get("folio_number") or "").strip()


def _scheme_isins_from_folio(folio: dict[str, Any]) -> set[str]:
    isins: set[str] = set()
    for payout in folio.get("payout_details") or []:
        if isinstance(payout, dict):
            isin = _normalize_isin(payout.get("scheme"))
            if isin:
                isins.add(isin)
    for scheme in folio.get("schemes") or []:
        if isinstance(scheme, dict):
            isin = _normalize_isin(scheme.get("isin") or scheme.get("scheme"))
            if isin:
                isins.add(isin)
        elif isinstance(scheme, str):
            isin = _normalize_isin(scheme)
            if isin:
                isins.add(isin)
    return isins


def parse_mf_folio_list(payload: dict[str, Any] | list[Any] | None) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        return []
    data = payload.get("data")
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    if isinstance(payload.get("folios"), list):
        return [item for item in payload["folios"] if isinstance(item, dict)]
    return []


def pick_folio_number_for_scheme(
    *,
    isin: str,
    holding_rows: list[dict[str, Any]],
    folio_records: list[dict[str, Any]],
    amc_codes: set[str],
    same_amc_isins: set[str],
) -> str | None:
    target = _normalize_isin(isin)
    if not target:
        return None

    for row in holding_rows:
        if _normalize_isin(row.get("isin")) == target:
            folio = str(row.get("folio_number") or "").strip()
            if folio:
                return folio

    same_amc = {_normalize_isin(item) for item in same_amc_isins if item}
    for row in holding_rows:
        if _normalize_isin(row.get("isin")) in same_amc:
            folio = str(row.get("folio_number") or "").strip()
            if folio:
                return folio

    normalized_amc_codes = {str(code).strip() for code in amc_codes if str(code).strip()}
    isin_folio: str | None = None
    amc_folio: str | None = None
    for folio in folio_records:
        number = _folio_number_from_record(folio)
        if not number:
            continue
        if target in _scheme_isins_from_folio(folio):
            isin_folio = isin_folio or number
        amc = str(folio.get("amc") or folio.get("amc_id") or "").strip()
        if amc and amc in normalized_amc_codes:
            amc_folio = amc_folio or number
    return isin_folio or amc_folio


async def _same_amc_isins(session: AsyncSession, fund: MutualFund) -> set[str]:
    rows = (
        await session.execute(
            select(MutualFund.isin_growth, MutualFund.isin_div_reinvestment).where(
                MutualFund.amc_id == fund.amc_id
            )
        )
    ).all()
    isins: set[str] = set()
    for growth, div in rows:
        if growth:
            isins.add(str(growth).upper())
        if div:
            isins.add(str(div).upper())
    return isins


async def _amc_codes_for_fund(session: AsyncSession, fund: MutualFund) -> set[str]:
    amc = await session.get(FundAmc, fund.amc_id)
    if amc is None:
        return set()
    codes = {value for value in (amc.fp_amc_id, amc.amc_code) if value}
    return {str(code).strip() for code in codes if str(code).strip()}


async def _fund_for_isin(session: AsyncSession, isin: str, fund: MutualFund | None) -> MutualFund | None:
    if fund is not None:
        return fund
    target = _normalize_isin(isin)
    if not target:
        return None
    return await session.scalar(
        select(MutualFund).where(
            or_(
                MutualFund.isin_growth == target,
                MutualFund.isin_div_reinvestment == target,
            )
        )
    )


async def resolve_existing_folio_for_scheme(
    session: AsyncSession,
    *,
    fp_mfia_id: str,
    isin: str,
    mfia: MfInvestmentAccount | None = None,
    fund: MutualFund | None = None,
) -> str | None:
    """Best-effort folio reuse. Lookup failures must not block order create."""
    target = _normalize_isin(isin)
    if not fp_mfia_id or not target:
        return None

    holding_rows: list[dict[str, Any]] = []
    folio_records: list[dict[str, Any]] = []
    try:
        old_id = None
        if mfia is not None:
            old_id = await ensure_mfia_old_id(session, mfia=mfia)
        if old_id is not None:
            holdings_payload = await get_holdings_report(investment_account_id=old_id)
            holding_rows = parse_holdings_report(holdings_payload)
    except Exception:
        logger.exception("Folio reuse holdings lookup failed mfia=%s isin=%s", fp_mfia_id, target)

    try:
        folio_payload = await list_mf_folios(fp_mfia_id=fp_mfia_id)
        folio_records = parse_mf_folio_list(folio_payload)
    except Exception:
        logger.exception("Folio reuse folio list failed mfia=%s isin=%s", fp_mfia_id, target)

    resolved_fund = await _fund_for_isin(session, target, fund)
    amc_codes: set[str] = set()
    same_amc_isins: set[str] = set()
    if resolved_fund is not None:
        amc_codes = await _amc_codes_for_fund(session, resolved_fund)
        same_amc_isins = await _same_amc_isins(session, resolved_fund)

    return pick_folio_number_for_scheme(
        isin=target,
        holding_rows=holding_rows,
        folio_records=folio_records,
        amc_codes=amc_codes,
        same_amc_isins=same_amc_isins,
    )
