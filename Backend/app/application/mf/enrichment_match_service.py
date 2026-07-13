from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.amfi_parsers import normalize_scheme_name
from app.infrastructure.persistence.mf_models import MutualFund


async def build_fund_match_indexes(
    session: AsyncSession,
) -> tuple[dict[str, int], dict[str, int]]:
    by_scheme_code: dict[str, int] = {}
    by_name: dict[str, int] = {}
    rows = await session.execute(
        select(MutualFund.id, MutualFund.scheme_code, MutualFund.scheme_name, MutualFund.plan_type)
    )
    for fund_id, scheme_code, scheme_name, plan_type in rows.all():
        plan = (plan_type or "REGULAR").upper()
        if plan == "DIRECT":
            continue
        if scheme_code:
            by_scheme_code[str(scheme_code).strip()] = fund_id
        if scheme_name:
            by_name[normalize_scheme_name(scheme_name)] = fund_id
    return by_scheme_code, by_name


def resolve_fund_id(
    *,
    by_scheme_code: dict[str, int],
    by_name: dict[str, int],
    scheme_code: str | None = None,
    scheme_name: str | None = None,
) -> int | None:
    if scheme_code:
        fund_id = by_scheme_code.get(str(scheme_code).strip())
        if fund_id:
            return fund_id
    if scheme_name:
        return by_name.get(normalize_scheme_name(scheme_name))
    return None
