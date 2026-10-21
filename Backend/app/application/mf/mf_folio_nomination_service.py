"""Summarize AMC folio nomination state from Finprim (read-only)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.mf_folio_reuse_service import parse_mf_folio_list
from app.infrastructure.core.kyc.fp_clients import FpClientError
from app.infrastructure.core.mf.oms_client import list_mf_folios
from app.infrastructure.persistence.mf_models import FundAmc
from app.infrastructure.persistence.mf_transaction_models import MfInvestmentAccount


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


def _serialize_folio_row(folio: dict[str, Any], *, amc_by_code: dict[str, FundAmc]) -> dict[str, Any] | None:
    folio_number = _folio_number_from_record(folio)
    if not folio_number:
        return None
    amc_code = str(folio.get("amc") or folio.get("amc_id") or "").strip()
    amc_row = amc_by_code.get(amc_code) if amc_code else None
    nominee_count = count_folio_nominees(folio)
    return {
        "folio_number": folio_number,
        "amc_code": amc_code or None,
        "amc_name": amc_row.name if amc_row else (f"AMC {amc_code}" if amc_code else "AMC"),
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
    amc_codes = {
        str(folio.get("amc") or folio.get("amc_id") or "").strip()
        for folio in folio_records
        if str(folio.get("amc") or folio.get("amc_id") or "").strip()
    }
    amc_by_code = await _load_amc_display_by_fp_code(session, amc_codes)

    rows: list[dict[str, Any]] = []
    for folio in folio_records:
        if not isinstance(folio, dict):
            continue
        item = _serialize_folio_row(folio, amc_by_code=amc_by_code)
        if item:
            rows.append(item)

    rows.sort(key=lambda item: (item.get("amc_name") or "", item.get("folio_number") or ""))
    return {"available": True, "folios": rows}
