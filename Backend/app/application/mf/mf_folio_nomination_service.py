"""Summarize AMC folio nomination state from Finprim (read-only)."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.mf_folio_reuse_service import _scheme_isins_from_folio, parse_mf_folio_list
from app.application.mf.mf_investment_account_service import ensure_mfia_old_id
from app.application.mf.mf_scheme_resolution import mutual_fund_isin_in
from app.application.mf.portfolio_holdings_service import parse_holdings_report
from app.infrastructure.core.kyc.fp_clients import FpClientError
from app.infrastructure.core.mf.oms_client import get_holdings_report, list_mf_folios
from app.infrastructure.persistence.mf_models import FundAmc, MutualFund
from app.infrastructure.persistence.mf_transaction_models import MfInvestmentAccount

logger = logging.getLogger(__name__)


def _folio_number_from_record(folio: dict[str, Any]) -> str:
    return str(folio.get("number") or folio.get("folio_number") or "").strip()


def _nominee_slot_present(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, dict):
        return bool(str(value.get("name") or value.get("nominee_name") or "").strip())
    return True


def count_folio_nominees(folio: dict[str, Any]) -> int:
    return sum(1 for index in (1, 2, 3) if _nominee_slot_present(folio.get(f"nominee{index}")))


def primary_nominee_name(folio: dict[str, Any]) -> str | None:
    for index in (1, 2, 3):
        nominee = folio.get(f"nominee{index}")
        if isinstance(nominee, dict):
            name = str(nominee.get("name") or nominee.get("nominee_name") or "").strip()
            if name:
                return name
        elif isinstance(nominee, str) and nominee.strip():
            return nominee.strip()
    return None


def nominee_count_label(count: int) -> str:
    if count <= 0:
        return "No nominee"
    if count == 1:
        return "1 nominee"
    return f"{count} nominees"


def _amc_code_from_folio(folio: dict[str, Any]) -> str:
    raw = folio.get("amc") if folio.get("amc") is not None else folio.get("amc_id")
    if isinstance(raw, dict):
        for key in ("id", "code", "amc_code", "fp_id"):
            value = str(raw.get(key) or "").strip()
            if value:
                return value
        return ""
    return str(raw or "").strip()


def _active_folio_numbers(holding_rows: list[dict[str, Any]]) -> set[str]:
    active: set[str] = set()
    for row in holding_rows:
        folio_number = str(row.get("folio_number") or "").strip()
        if not folio_number:
            continue
        units = float(row.get("units") or 0)
        if units > 0:
            active.add(folio_number)
    return active


def _primary_isin_for_folio(
    folio_number: str,
    *,
    folio_record: dict[str, Any],
    holding_rows: list[dict[str, Any]],
) -> str | None:
    for row in holding_rows:
        if str(row.get("folio_number") or "").strip() != folio_number:
            continue
        isin = str(row.get("isin") or "").strip().upper()
        if isin:
            return isin
    scheme_isins = _scheme_isins_from_folio(folio_record)
    return next(iter(scheme_isins), None)


async def _load_amc_display_by_isin(session: AsyncSession, isins: set[str]) -> dict[str, FundAmc]:
    normalized = {str(isin).strip().upper() for isin in isins if str(isin).strip()}
    if not normalized:
        return {}
    result = await session.execute(
        select(MutualFund.isin_growth, MutualFund.isin_div_reinvestment, FundAmc)
        .join(FundAmc, FundAmc.id == MutualFund.amc_id)
        .where(mutual_fund_isin_in(normalized))
    )
    by_isin: dict[str, FundAmc] = {}
    for isin_growth, isin_div, amc in result.all():
        if isin_growth:
            by_isin[str(isin_growth).upper()] = amc
        if isin_div:
            by_isin[str(isin_div).upper()] = amc
    return by_isin


async def _load_amc_display_by_fp_code(session: AsyncSession, codes: set[str]) -> dict[str, FundAmc]:
    normalized = {str(code).strip() for code in codes if str(code).strip()}
    if not normalized:
        return {}
    rows = (
        await session.scalars(
            select(FundAmc).where(
                or_(
                    FundAmc.fp_amc_id.in_(normalized),
                    FundAmc.amc_code.in_(normalized),
                )
            )
        )
    ).all()
    by_key: dict[str, FundAmc] = {}
    for amc in rows:
        if amc.fp_amc_id:
            by_key[str(amc.fp_amc_id).strip()] = amc
        if amc.amc_code:
            by_key[str(amc.amc_code).strip()] = amc
    return by_key


def _resolve_amc_row(
    folio: dict[str, Any],
    *,
    folio_number: str,
    amc_by_code: dict[str, FundAmc],
    amc_by_isin: dict[str, FundAmc],
    holding_rows: list[dict[str, Any]],
) -> FundAmc | None:
    amc_code = _amc_code_from_folio(folio)
    amc_row = amc_by_code.get(amc_code) if amc_code else None
    if amc_row is not None:
        return amc_row
    isin = _primary_isin_for_folio(folio_number, folio_record=folio, holding_rows=holding_rows)
    if isin:
        return amc_by_isin.get(isin)
    return None


def _serialize_folio_row(
    folio: dict[str, Any],
    *,
    amc_by_code: dict[str, FundAmc],
    amc_by_isin: dict[str, FundAmc] | None = None,
    holding_rows: list[dict[str, Any]] | None = None,
) -> dict[str, Any] | None:
    folio_number = _folio_number_from_record(folio)
    if not folio_number:
        return None
    amc_code = _amc_code_from_folio(folio)
    amc_row = _resolve_amc_row(
        folio,
        folio_number=folio_number,
        amc_by_code=amc_by_code,
        amc_by_isin=amc_by_isin or {},
        holding_rows=holding_rows or [],
    )
    nominee_count = count_folio_nominees(folio)
    return {
        "folio_number": folio_number,
        "amc_code": amc_code or None,
        "amc_name": amc_row.name if amc_row else (f"AMC {amc_code}" if amc_code else "Fund house"),
        "amc_slug": amc_row.slug if amc_row else None,
        "nominee_count": nominee_count,
        "nominee_status": nominee_count_label(nominee_count),
        "primary_nominee_name": primary_nominee_name(folio),
    }


async def list_user_mf_folio_nominations(
    session: AsyncSession,
    *,
    user_id: UUID,
) -> dict[str, Any]:
    mfia = await session.scalar(select(MfInvestmentAccount).where(MfInvestmentAccount.user_id == user_id))
    fp_mfia_id = str(mfia.fp_mfia_id or "").strip() if mfia else ""
    if not fp_mfia_id:
        return {"available": False, "folios": []}

    try:
        payload = await list_mf_folios(fp_mfia_id=fp_mfia_id)
    except FpClientError:
        return {"available": False, "folios": []}

    folio_records = parse_mf_folio_list(payload)

    holding_rows: list[dict[str, Any]] = []
    if mfia is not None:
        try:
            old_id = await ensure_mfia_old_id(session, mfia=mfia)
            if old_id is not None:
                holdings_payload = await get_holdings_report(investment_account_id=old_id)
                holding_rows = parse_holdings_report(holdings_payload)
        except Exception:
            logger.exception("MF folio nomination holdings lookup failed user_id=%s", user_id)

    active_folios = _active_folio_numbers(holding_rows)
    if active_folios:
        folio_records = [
            folio
            for folio in folio_records
            if isinstance(folio, dict) and _folio_number_from_record(folio) in active_folios
        ]

    amc_codes = {_amc_code_from_folio(folio) for folio in folio_records if isinstance(folio, dict)}
    amc_codes.discard("")
    scheme_isins: set[str] = set()
    for folio in folio_records:
        if isinstance(folio, dict):
            scheme_isins |= _scheme_isins_from_folio(folio)
    for row in holding_rows:
        isin = str(row.get("isin") or "").strip().upper()
        if isin:
            scheme_isins.add(isin)

    amc_by_code = await _load_amc_display_by_fp_code(session, amc_codes)
    amc_by_isin = await _load_amc_display_by_isin(session, scheme_isins)

    rows: list[dict[str, Any]] = []
    for folio in folio_records:
        if not isinstance(folio, dict):
            continue
        item = _serialize_folio_row(
            folio,
            amc_by_code=amc_by_code,
            amc_by_isin=amc_by_isin,
            holding_rows=holding_rows,
        )
        if item:
            rows.append(item)

    rows.sort(key=lambda item: (item.get("amc_name") or "", item.get("folio_number") or ""))
    return {"available": True, "folios": rows}
