from __future__ import annotations

import json
import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.cas_import_service import list_user_external_holdings
from app.application.mf.mf_redemption_journey_service import (
    get_fp_redemption_journey,
    index_active_redemptions,
    list_fp_redemptions_for_mfia,
)
from app.application.mf.mf_investment_account_service import ensure_fp_mfia, ensure_mfia_old_id
from app.application.mf.mf_order_service import get_or_create_mf_investment_account
from app.application.mf.public_asset_service import resolve_amc_logo_url
from app.core.config import Settings, get_settings
from app.core.redis import get_redis
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.mf.fp_oms_client import (
    get_holdings_report,
    get_investment_account_wise_returns,
    get_mf_redemption,
    get_scheme_wise_returns,
    list_mf_folios,
    list_mf_transactions,
)
from app.infrastructure.persistence.investor_models import InvestorBankAccount, InvestorRelatedParty
from app.infrastructure.persistence.mf_models import FundAmc, FundNavMetrics, MutualFund
from app.infrastructure.persistence.mf_transaction_models import (
    MfInvestmentAccount,
    MfOrder,
    MfOrderStatus,
    MfOrderType,
    MfSipPlan,
    MfSipPlanStatus,
)

logger = logging.getLogger(__name__)

ALLOCATION_SLICE_META: dict[str, dict[str, str]] = {
    "equity": {"label": "Equity", "color": "bg-sky-500"},
    "debt": {"label": "Debt", "color": "bg-emerald-500"},
    "hybrid": {"label": "Hybrid", "color": "bg-amber-500"},
    "other": {"label": "Others", "color": "bg-slate-400"},
}


def _portfolio_slice_for_sebi(sebi_category: str | None) -> str:
    if not sebi_category:
        return "other"
    lowered = sebi_category.lower()
    if any(token in lowered for token in ("debt", "liquid", "bond", "gilt", "overnight")):
        return "debt"
    if any(token in lowered for token in ("hybrid", "balanced", "multi asset", "solution oriented")):
        return "hybrid"
    if any(token in lowered for token in ("equity", "elss", "index")):
        return "equity"
    return "other"


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def build_portfolio_holding_id(*, folio_number: str, isin: str) -> str:
    return f"{folio_number}::{isin}"


def parse_holding_id(holding_id: str) -> tuple[str, str] | None:
    if "::" not in holding_id:
        return None
    folio_number, isin = holding_id.split("::", 1)
    folio_number = folio_number.strip()
    isin = isin.strip().upper()
    if not folio_number or not isin:
        return None
    return folio_number, isin


def parse_scheme_wise_returns(payload: dict[str, Any], *, isin: str) -> dict[str, float | None]:
    data = payload.get("data")
    if not isinstance(data, dict):
        return {}

    columns = data.get("columns") or []
    rows = data.get("rows") or []
    if not rows or not columns:
        return {}

    target = isin.upper()
    for row in rows:
        if not isinstance(row, list):
            continue
        mapped = dict(zip(columns, row))
        row_isin = str(mapped.get("isin") or "").upper()
        if row_isin != target:
            continue
        return {
            "invested_inr": _safe_float(mapped.get("invested_amount")),
            "current_value_inr": _safe_float(mapped.get("current_value")),
            "total_return_inr": _safe_float(mapped.get("unrealized_gain")),
            "total_return_pct": _safe_float(mapped.get("absolute_return")),
            "xirr_pct": _safe_float(mapped.get("xirr")),
        }
    return {}


_FP_INVESTED_TXN_TYPES = {"purchase", "sip", "switch_in", "transfer_in", "bonus", "additional_purchase"}
_FP_REDEEMED_TXN_TYPES = {"redemption", "switch_out", "transfer_out"}
_FP_DIVIDEND_TXN_TYPES = {"dividend_payout", "dividend_reinvestment"}


def _map_fp_transaction_type(raw_type: str | None) -> str:
    normalized = str(raw_type or "").lower()
    if normalized in _FP_REDEEMED_TXN_TYPES:
        return "redeemed"
    if normalized in _FP_DIVIDEND_TXN_TYPES:
        return "dividend"
    return "invested"


def parse_mf_transactions(payload: dict[str, Any], *, isin: str) -> list[dict[str, Any]]:
    rows = payload.get("data")
    if not isinstance(rows, list):
        return []

    target = isin.upper()
    parsed: list[dict[str, Any]] = []

    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            continue
        row_isin = str(row.get("isin") or "").upper()
        if row_isin and row_isin != target:
            continue

        txn_date = (
            row.get("traded_on")
            or row.get("transaction_date")
            or row.get("date")
            or row.get("created_at")
        )
        if not txn_date:
            continue

        units = _safe_float(row.get("units")) or 0.0
        nav = _safe_float(row.get("price") or row.get("nav")) or 0.0
        amount = _safe_float(row.get("amount"))
        if amount is None:
            amount = abs(units * nav)

        txn_type = _map_fp_transaction_type(row.get("type"))
        txn_id = str(row.get("id") or row.get("transaction_id") or f"txn-{index}")

        parsed.append(
            {
                "id": txn_id,
                "date": str(txn_date)[:10],
                "type": txn_type,
                "units": abs(units),
                "nav": nav,
                "value_inr": round(abs(amount), 2),
            }
        )

    parsed.sort(key=lambda item: item["date"], reverse=True)
    return parsed


def _months_invested(first_investment_date: str | None) -> int | None:
    if not first_investment_date:
        return None
    try:
        start = date.fromisoformat(first_investment_date[:10])
    except ValueError:
        return None
    today = date.today()
    months = (today.year - start.year) * 12 + (today.month - start.month)
    return max(months, 0)


def _extract_folio_meta(folio_payload: dict[str, Any]) -> dict[str, Any]:
    rows = folio_payload.get("data")
    if not isinstance(rows, list) or not rows:
        return {}

    folio = rows[0] if isinstance(rows[0], dict) else {}
    holding_mode = "Demat" if folio.get("dp_id") and folio.get("client_id") else "Physical"

    nominee_name = None
    nominee = folio.get("nominee1")
    if isinstance(nominee, dict):
        nominee_name = nominee.get("name") or nominee.get("nominee_name")

    redeem_bank_label = None
    payout_details = folio.get("payout_details")
    if isinstance(payout_details, list):
        for detail in payout_details:
            if not isinstance(detail, dict):
                continue
            bank = detail.get("bank_account") if isinstance(detail.get("bank_account"), dict) else detail
            if not isinstance(bank, dict):
                continue
            account_number = str(bank.get("account_number") or bank.get("number") or "")
            last4 = account_number[-4:] if len(account_number) >= 4 else account_number
            bank_name = bank.get("bank_name") or bank.get("name") or "Bank"
            if last4:
                redeem_bank_label = f"{bank_name} ....{last4}"
                break

    return {
        "holding_mode": holding_mode,
        "nominee_name": str(nominee_name) if nominee_name else None,
        "redeem_bank_label": redeem_bank_label,
    }


def parse_holdings_report(payload: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for folio in payload.get("folios") or []:
        if not isinstance(folio, dict):
            continue
        folio_number = str(folio.get("folio_number") or "").strip()
        for scheme in folio.get("schemes") or []:
            if not isinstance(scheme, dict):
                continue
            isin = str(scheme.get("isin") or "").strip().upper()
            if not isin:
                continue
            holdings = scheme.get("holdings") if isinstance(scheme.get("holdings"), dict) else {}
            market_value = scheme.get("market_value") if isinstance(scheme.get("market_value"), dict) else {}
            invested_value = scheme.get("invested_value") if isinstance(scheme.get("invested_value"), dict) else {}
            nav = scheme.get("nav") if isinstance(scheme.get("nav"), dict) else {}

            units = _safe_float(holdings.get("units")) or 0.0
            redeemable_units = _safe_float(holdings.get("redeemable_units"))
            current_value = _safe_float(market_value.get("amount")) or 0.0
            redeemable_amount = _safe_float(market_value.get("redeemable_amount"))
            invested = _safe_float(invested_value.get("amount")) or 0.0
            nav_value = _safe_float(nav.get("value"))
            nav_as_on = nav.get("as_on") or market_value.get("as_on") or holdings.get("as_on")

            rows.append(
                {
                    "folio_number": folio_number,
                    "isin": isin,
                    "fund_name": str(scheme.get("name") or isin),
                    "scheme_type": scheme.get("type"),
                    "units": units,
                    "redeemable_units": redeemable_units if redeemable_units is not None else units,
                    "current_value_inr": current_value,
                    "redeemable_amount_inr": redeemable_amount if redeemable_amount is not None else current_value,
                    "invested_inr": invested,
                    "nav": nav_value,
                    "nav_as_on": str(nav_as_on) if nav_as_on else None,
                }
            )
    return rows


def parse_investment_account_returns(payload: dict[str, Any]) -> dict[str, float | None]:
    data = payload.get("data")
    if not isinstance(data, dict):
        return {}

    columns = data.get("columns") or []
    rows = data.get("rows") or []
    if not rows or not columns:
        return {}

    first_row = rows[0]
    if not isinstance(first_row, list):
        return {}

    mapped = dict(zip(columns, first_row))
    return {
        "invested_inr": _safe_float(mapped.get("invested_amount")),
        "current_value_inr": _safe_float(mapped.get("current_value")),
        "total_return_inr": _safe_float(mapped.get("unrealized_gain")),
        "total_return_pct": _safe_float(mapped.get("absolute_return")),
        "xirr_pct": _safe_float(mapped.get("xirr")),
    }


def _compute_allocation_slices(
    holdings: list[dict[str, Any]],
    *,
    isin_category: dict[str, str | None],
) -> list[dict[str, Any]]:
    totals: dict[str, float] = {key: 0.0 for key in ALLOCATION_SLICE_META}
    total_value = sum(float(row.get("current_value_inr") or 0) for row in holdings)

    for row in holdings:
        isin = str(row.get("isin") or "").upper()
        amount = float(row.get("current_value_inr") or 0)
        slice_key = _portfolio_slice_for_sebi(isin_category.get(isin))
        totals[slice_key] = totals.get(slice_key, 0.0) + amount

    if total_value <= 0:
        return []

    slices: list[dict[str, Any]] = []
    for slice_id, meta in ALLOCATION_SLICE_META.items():
        amount = totals.get(slice_id, 0.0)
        if amount <= 0:
            continue
        slices.append(
            {
                "id": slice_id,
                "label": meta["label"],
                "value_pct": round(amount / total_value * 100, 1),
                "color": meta["color"],
            }
        )
    return slices


def _build_flow_series(*, invested_inr: float, current_value_inr: float) -> list[dict[str, Any]]:
    if invested_inr <= 0 and current_value_inr <= 0:
        return []
    return [
        {"label": "Invested", "value": round(invested_inr, 2)},
        {"label": "Current", "value": round(current_value_inr, 2)},
    ]


def _month_end_date(year: int, month: int) -> date:
    if month == 12:
        next_month = date(year + 1, 1, 1)
    else:
        next_month = date(year, month + 1, 1)
    return next_month - timedelta(days=1)


def _month_label(year: int, month: int) -> str:
    return date(year, month, 1).strftime("%b %y")


async def _load_return_1d_by_isin(session: AsyncSession, *, isins: set[str]) -> dict[str, float]:
    if not isins:
        return {}
    rows = (
        await session.execute(
            select(MutualFund.isin, FundNavMetrics.return_1d)
            .join(FundNavMetrics, FundNavMetrics.fund_id == MutualFund.id)
            .where(MutualFund.isin.in_(list(isins)))
        )
    ).all()
    mapped: dict[str, float] = {}
    for isin, return_1d in rows:
        if isin and return_1d is not None:
            mapped[str(isin).upper()] = float(return_1d)
    return mapped


def _compute_portfolio_day_change(
    holdings: list[dict[str, Any]],
    *,
    return_1d_by_isin: dict[str, float],
) -> tuple[float | None, float | None]:
    total_value = sum(float(row.get("current_value_inr") or 0) for row in holdings)
    if total_value <= 0:
        return None, None

    weighted_change_inr = 0.0
    covered_value = 0.0
    for row in holdings:
        isin = str(row.get("isin") or "").upper()
        value = float(row.get("current_value_inr") or 0)
        return_1d = return_1d_by_isin.get(isin)
        if return_1d is None or value <= 0:
            continue
        weighted_change_inr += value * (return_1d / 100)
        covered_value += value

    if covered_value <= 0:
        return None, None

    day_change_pct = (weighted_change_inr / total_value) * 100
    return round(weighted_change_inr, 2), round(day_change_pct, 2)


def _apply_holding_day_change(
    holdings: list[dict[str, Any]],
    *,
    return_1d_by_isin: dict[str, float],
) -> None:
    for row in holdings:
        isin = str(row.get("isin") or "").upper()
        value = float(row.get("current_value_inr") or 0)
        return_1d = return_1d_by_isin.get(isin)
        if return_1d is None or value <= 0:
            row["day_change_inr"] = None
            row["day_change_pct"] = None
            continue
        change_inr = value * (return_1d / 100)
        row["day_change_inr"] = round(change_inr, 2)
        row["day_change_pct"] = round(return_1d, 2)


async def _build_portfolio_growth_series(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    current_value_inr: float,
    invested_inr: float,
    months: int = 12,
) -> list[dict[str, Any]]:
    if current_value_inr <= 0 and invested_inr <= 0:
        return []

    rows = (
        await session.execute(
            select(MfOrder.created_at, MfOrder.amount_inr, MfOrder.order_type).where(
                MfOrder.user_id == user_id,
                MfOrder.status == MfOrderStatus.succeeded,
            )
        )
    ).all()

    now = datetime.now(timezone.utc)
    start = date(now.year, now.month, 1)
    for _ in range(max(months - 1, 0)):
        if start.month == 1:
            start = date(start.year - 1, 12, 1)
        else:
            start = date(start.year, start.month - 1, 1)

    timeline: list[tuple[datetime, Decimal]] = []
    for created_at, amount_inr, order_type in rows:
        if created_at is None:
            continue
        amount = Decimal(str(amount_inr or 0))
        if amount <= 0:
            continue
        signed = -amount if order_type == MfOrderType.redemption else amount
        timeline.append((created_at, signed))
    timeline.sort(key=lambda item: item[0])

    points: list[dict[str, Any]] = []
    cumulative = Decimal("0")
    event_index = 0
    cursor_year, cursor_month = start.year, start.month
    end_year, end_month = now.year, now.month

    value_ratio = (current_value_inr / invested_inr) if invested_inr > 0 else 1.0

    while (cursor_year, cursor_month) <= (end_year, end_month):
        month_end = datetime(
            *_month_end_date(cursor_year, cursor_month).timetuple()[:3],
            23,
            59,
            59,
            tzinfo=timezone.utc,
        )
        while event_index < len(timeline) and timeline[event_index][0] <= month_end:
            cumulative += timeline[event_index][1]
            event_index += 1

        invested_value = float(max(cumulative, Decimal("0")))
        estimated_value = invested_value * value_ratio if invested_value > 0 else 0.0
        if cursor_month == end_month and cursor_year == end_year and current_value_inr > 0:
            estimated_value = current_value_inr
            invested_value = invested_inr

        points.append(
            {
                "label": _month_label(cursor_year, cursor_month),
                "value": round(estimated_value, 2),
                "date": month_end.date().isoformat(),
                "invested": round(invested_value, 2),
            }
        )

        if cursor_month == 12:
            cursor_year += 1
            cursor_month = 1
        else:
            cursor_month += 1

    if len(points) < 2:
        return _build_flow_series(invested_inr=invested_inr, current_value_inr=current_value_inr)
    return points


async def _merge_external_holdings(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    fp_holdings: list[dict[str, Any]],
    fund_meta: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    fp_keys = {
        (str(row.get("folio_number") or "").strip(), str(row.get("isin") or "").upper())
        for row in fp_holdings
    }
    merged = [{**row, "source": "zynd"} for row in fp_holdings]

    external_rows = await list_user_external_holdings(session, user_id=user_id)
    total_current = sum(float(row.get("current_value_inr") or 0) for row in merged)

    for ext in external_rows:
        folio = str(ext.get("folio_number") or "").strip()
        isin = str(ext.get("isin") or "").upper()
        if not folio or not isin:
            continue
        if (folio, isin) in fp_keys:
            continue

        meta = fund_meta.get(isin, {})
        market_value = float(ext.get("market_value_inr") or 0)
        units = float(ext.get("units") or 0)
        nav = float(ext.get("nav_value") or 0)
        total_current += market_value

        merged.append(
            {
                "id": build_portfolio_holding_id(folio_number=folio, isin=isin),
                "folio_number": folio,
                "isin": isin,
                "fund_name": meta.get("matched_fund_name") or ext.get("matched_scheme_name") or ext.get("scheme_name") or isin,
                "amc_name": meta.get("amc_name") or ext.get("amc_name"),
                "amc_logo_url": meta.get("amc_logo_url") or ext.get("amc_logo_url"),
                "units": units,
                "redeemable_units": units,
                "current_value_inr": market_value,
                "redeemable_amount_inr": market_value,
                "invested_inr": market_value,
                "return_inr": 0.0,
                "return_pct": 0.0,
                "allocation_pct": 0.0,
                "nav": nav or None,
                "nav_as_on": ext.get("as_of_date"),
                "source": "external",
            }
        )

    if total_current > 0:
        for row in merged:
            value = float(row.get("current_value_inr") or 0)
            row["allocation_pct"] = round(value / total_current * 100, 1)

    merged.sort(key=lambda row: float(row.get("current_value_inr") or 0), reverse=True)
    return merged


async def _portfolio_cache_key(user_id: uuid.UUID, kind: str, settings: Settings) -> str:
    return f"portfolio:{kind}:v1:{user_id}"


async def _get_cached_portfolio(key: str, *, settings: Settings) -> Any | None:
    if not settings.zynd_mf_invest_cache_enabled:
        return None
    client = await get_redis(settings.redis_cache_db, settings)
    raw = await client.get(key)
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        await client.delete(key)
        return None


async def _set_cached_portfolio(key: str, payload: Any, *, settings: Settings) -> None:
    if not settings.zynd_mf_invest_cache_enabled:
        return
    client = await get_redis(settings.redis_cache_db, settings)
    ttl = max(settings.zynd_mf_portfolio_cache_ttl_seconds, 1)
    await client.set(key, json.dumps(payload, default=str), ex=ttl)


async def invalidate_user_portfolio_cache(user_id: uuid.UUID) -> None:
    settings = get_settings()
    if not settings.zynd_mf_invest_cache_enabled:
        return
    client = await get_redis(settings.redis_cache_db, settings)
    patterns = [
        f"portfolio:summary:v1:{user_id}",
        f"portfolio:holdings:v1:{user_id}",
        f"portfolio:redeem_units:v1:{user_id}",
        f"portfolio:holding_detail:v1:{user_id}:*",
    ]
    for pattern in patterns:
        if pattern.endswith("*"):
            async for key in client.scan_iter(match=pattern):
                await client.delete(key)
        else:
            await client.delete(pattern)


async def _load_fund_metadata(
    session: AsyncSession,
    *,
    isins: set[str],
    settings: Settings,
) -> dict[str, dict[str, Any]]:
    if not isins:
        return {}

    result = await session.execute(
        select(
            MutualFund.isin,
            MutualFund.scheme_name,
            MutualFund.sebi_category,
            FundAmc.name,
            FundAmc.logo_url,
            FundAmc.slug,
        )
        .join(FundAmc, FundAmc.id == MutualFund.amc_id)
        .where(MutualFund.isin.in_(isins))
    )

    metadata: dict[str, dict[str, Any]] = {}
    for isin, scheme_name, sebi_category, amc_name, logo_url, slug in result:
        metadata[str(isin).upper()] = {
            "matched_fund_name": scheme_name,
            "sebi_category": sebi_category,
            "amc_name": amc_name,
            "amc_logo_url": resolve_amc_logo_url(logo_url, slug, settings),
        }
    return metadata


async def _load_sip_stats(session: AsyncSession, *, user_id: uuid.UUID) -> tuple[int, float]:
    rows = (
        await session.execute(
            select(MfSipPlan.amount_inr, MfSipPlan.frequency).where(
                MfSipPlan.user_id == user_id,
                MfSipPlan.status == MfSipPlanStatus.active,
            )
        )
    ).all()

    active_count = len(rows)
    monthly_total = Decimal("0")
    for amount, frequency in rows:
        freq = str(frequency or "").lower()
        if freq == "monthly":
            monthly_total += Decimal(str(amount))
        elif freq == "daily":
            monthly_total += Decimal(str(amount)) * Decimal("30")
    return active_count, float(monthly_total)


async def _has_processing_orders(session: AsyncSession, *, user_id: uuid.UUID) -> bool:
    count = await session.scalar(
        select(func.count())
        .select_from(MfOrder)
        .where(
            MfOrder.user_id == user_id,
            MfOrder.status.in_(
                [
                    MfOrderStatus.pending,
                    MfOrderStatus.processing,
                    MfOrderStatus.payment_pending,
                    MfOrderStatus.submitted,
                ]
            ),
        )
    )
    return int(count or 0) > 0


async def _resolve_mfia_context(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
) -> tuple[MfInvestmentAccount | None, int | None, str | None, str]:
    mfia = await get_or_create_mf_investment_account(session, user_id=user_id)
    fp_mfia_id = mfia.fp_mfia_id

    if not fp_mfia_id:
        fp_mfia_id = await ensure_fp_mfia(session, user_id=user_id, mfia=mfia)
        await session.flush()

    if not fp_mfia_id:
        if mfia.status.value == "FAILED":
            return mfia, None, None, "mfia_failed"
        return mfia, None, None, "no_mfia"

    old_id = await ensure_mfia_old_id(session, mfia=mfia)
    if old_id is None:
        return mfia, None, fp_mfia_id, "mfia_not_ready"

    return mfia, old_id, fp_mfia_id, "ready"


async def _fetch_enriched_holdings(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    mfia_old_id: int,
    fp_mfia_id: str,
) -> tuple[list[dict[str, Any]], dict[str, float | None], str | None]:
    settings = get_settings()
    holdings_payload = await get_holdings_report(investment_account_id=mfia_old_id)
    raw_rows = parse_holdings_report(holdings_payload)

    returns_payload = await get_investment_account_wise_returns(fp_mfia_id=fp_mfia_id)
    returns = parse_investment_account_returns(returns_payload)

    isins = {str(row["isin"]).upper() for row in raw_rows}
    fund_meta = await _load_fund_metadata(session, isins=isins, settings=settings)
    isin_category = {isin: meta.get("sebi_category") for isin, meta in fund_meta.items()}

    total_current = sum(float(row.get("current_value_inr") or 0) for row in raw_rows)
    enriched: list[dict[str, Any]] = []

    for row in raw_rows:
        isin = str(row["isin"]).upper()
        meta = fund_meta.get(isin, {})
        invested = float(row.get("invested_inr") or 0)
        current_value = float(row.get("current_value_inr") or 0)
        return_inr = current_value - invested
        return_pct = (return_inr / invested * 100) if invested > 0 else 0.0
        allocation_pct = (current_value / total_current * 100) if total_current > 0 else 0.0

        enriched.append(
            {
                "id": build_portfolio_holding_id(folio_number=str(row["folio_number"]), isin=isin),
                "folio_number": row["folio_number"],
                "isin": isin,
                "fund_name": meta.get("matched_fund_name") or row["fund_name"],
                "amc_name": meta.get("amc_name"),
                "amc_logo_url": meta.get("amc_logo_url"),
                "units": row["units"],
                "redeemable_units": row["redeemable_units"],
                "current_value_inr": current_value,
                "redeemable_amount_inr": row.get("redeemable_amount_inr"),
                "invested_inr": invested,
                "return_inr": round(return_inr, 2),
                "return_pct": round(return_pct, 2),
                "allocation_pct": round(allocation_pct, 1),
                "nav": row.get("nav"),
                "nav_as_on": row.get("nav_as_on"),
            }
        )

    as_on = None
    for row in raw_rows:
        if row.get("nav_as_on"):
            as_on = row["nav_as_on"]
            break

    if not returns.get("current_value_inr") and total_current > 0:
        returns["current_value_inr"] = total_current
    if not returns.get("invested_inr") and raw_rows:
        returns["invested_inr"] = sum(float(row.get("invested_inr") or 0) for row in raw_rows)
    if returns.get("total_return_inr") is None and returns.get("current_value_inr") and returns.get("invested_inr"):
        returns["total_return_inr"] = float(returns["current_value_inr"]) - float(returns["invested_inr"])
    if returns.get("total_return_pct") is None and returns.get("invested_inr"):
        invested = float(returns["invested_inr"] or 0)
        if invested > 0 and returns.get("total_return_inr") is not None:
            returns["total_return_pct"] = float(returns["total_return_inr"]) / invested * 100

    allocation = _compute_allocation_slices(raw_rows, isin_category=isin_category)
    returns["_allocation"] = allocation  # type: ignore[index]
    returns["_as_on"] = as_on  # type: ignore[index]

    return enriched, returns, as_on


async def get_user_portfolio_summary(session: AsyncSession, *, user_id: uuid.UUID) -> dict[str, Any]:
    settings = get_settings()
    cache_key = await _portfolio_cache_key(user_id, "summary", settings)
    cached = await _get_cached_portfolio(cache_key, settings=settings)
    if cached is not None:
        return cached

    _mfia, old_id, fp_mfia_id, readiness = await _resolve_mfia_context(session, user_id=user_id)
    active_sips, monthly_sip_inr = await _load_sip_stats(session, user_id=user_id)
    processing = await _has_processing_orders(session, user_id=user_id)

    if readiness != "ready" or old_id is None or fp_mfia_id is None:
        external_holdings = await _merge_external_holdings(
            session,
            user_id=user_id,
            fp_holdings=[],
            fund_meta={},
        )
        if external_holdings:
            isins = {str(row.get("isin") or "").upper() for row in external_holdings}
            return_1d_by_isin = await _load_return_1d_by_isin(session, isins=isins)
            _apply_holding_day_change(external_holdings, return_1d_by_isin=return_1d_by_isin)
            day_change_inr, day_change_pct = _compute_portfolio_day_change(
                external_holdings,
                return_1d_by_isin=return_1d_by_isin,
            )
            current_value = sum(float(row.get("current_value_inr") or 0) for row in external_holdings)
            invested = current_value
            fund_meta = await _load_fund_metadata(session, isins=isins, settings=settings)
            isin_category = {isin: meta.get("sebi_category") for isin, meta in fund_meta.items()}
            allocation = _compute_allocation_slices(
                [{"isin": row["isin"], "current_value_inr": row["current_value_inr"]} for row in external_holdings],
                isin_category=isin_category,
            )
            payload = {
                "status": "ready",
                "has_pending_orders": processing,
                "current_value_inr": current_value,
                "invested_inr": invested,
                "total_return_inr": 0.0,
                "total_return_pct": 0.0,
                "day_change_inr": day_change_inr,
                "day_change_pct": day_change_pct,
                "xirr_pct": None,
                "holdings_count": len(external_holdings),
                "active_sips_count": active_sips,
                "monthly_sip_inr": monthly_sip_inr,
                "allocation": allocation,
                "growth": await _build_portfolio_growth_series(
                    session,
                    user_id=user_id,
                    current_value_inr=current_value,
                    invested_inr=invested,
                ),
                "as_on": external_holdings[0].get("nav_as_on") if external_holdings else None,
            }
        else:
            payload = {
                "status": readiness,
                "has_pending_orders": processing,
                "current_value_inr": 0.0,
                "invested_inr": 0.0,
                "total_return_inr": 0.0,
                "total_return_pct": 0.0,
                "day_change_inr": None,
                "day_change_pct": None,
                "xirr_pct": None,
                "holdings_count": 0,
                "active_sips_count": active_sips,
                "monthly_sip_inr": monthly_sip_inr,
                "allocation": [],
                "growth": [],
                "as_on": None,
            }
        await _set_cached_portfolio(cache_key, payload, settings=settings)
        return payload

    holdings, returns, as_on = await _fetch_enriched_holdings(
        session,
        user_id=user_id,
        mfia_old_id=old_id,
        fp_mfia_id=fp_mfia_id,
    )
    allocation = returns.pop("_allocation", [])  # type: ignore[misc]
    as_on = returns.pop("_as_on", as_on)  # type: ignore[misc]

    isins = {str(row.get("isin") or "").upper() for row in holdings}
    fund_meta = await _load_fund_metadata(session, isins=isins, settings=settings)
    holdings = await _merge_external_holdings(
        session,
        user_id=user_id,
        fp_holdings=holdings,
        fund_meta=fund_meta,
    )
    external_isins = {str(row.get("isin") or "").upper() for row in holdings if row.get("source") == "external"}
    if external_isins:
        fund_meta = {**fund_meta, **(await _load_fund_metadata(session, isins=external_isins, settings=settings))}
        isins |= external_isins

    return_1d_by_isin = await _load_return_1d_by_isin(session, isins=isins)
    _apply_holding_day_change(holdings, return_1d_by_isin=return_1d_by_isin)
    day_change_inr, day_change_pct = _compute_portfolio_day_change(holdings, return_1d_by_isin=return_1d_by_isin)

    if holdings:
        isin_category = {isin: meta.get("sebi_category") for isin, meta in fund_meta.items()}
        raw_for_allocation = [
            {"isin": row["isin"], "current_value_inr": row["current_value_inr"]} for row in holdings
        ]
        allocation = _compute_allocation_slices(raw_for_allocation, isin_category=isin_category)

    current_value = sum(float(row.get("current_value_inr") or 0) for row in holdings) or float(
        returns.get("current_value_inr") or 0
    )
    invested = float(returns.get("invested_inr") or 0)
    if not invested and holdings:
        invested = sum(float(row.get("invested_inr") or 0) for row in holdings if row.get("source") != "external")

    status = "empty"
    if holdings:
        status = "ready"
    elif processing:
        status = "processing"

    total_return_inr = current_value - invested if current_value > 0 or invested > 0 else 0.0
    total_return_pct = (total_return_inr / invested * 100) if invested > 0 else 0.0

    payload = {
        "status": status,
        "has_pending_orders": processing,
        "current_value_inr": current_value,
        "invested_inr": invested,
        "total_return_inr": round(total_return_inr, 2),
        "total_return_pct": round(total_return_pct, 2),
        "day_change_inr": day_change_inr,
        "day_change_pct": day_change_pct,
        "xirr_pct": returns.get("xirr_pct"),
        "holdings_count": len(holdings),
        "active_sips_count": active_sips,
        "monthly_sip_inr": monthly_sip_inr,
        "allocation": allocation,
        "growth": await _build_portfolio_growth_series(
            session,
            user_id=user_id,
            current_value_inr=current_value,
            invested_inr=invested,
        ),
        "as_on": as_on,
    }
    await _set_cached_portfolio(cache_key, payload, settings=settings)
    return payload


async def list_user_portfolio_holdings(session: AsyncSession, *, user_id: uuid.UUID) -> dict[str, Any]:
    settings = get_settings()
    cache_key = await _portfolio_cache_key(user_id, "holdings", settings)
    cached = await _get_cached_portfolio(cache_key, settings=settings)
    if cached is not None:
        return cached

    _mfia, old_id, fp_mfia_id, readiness = await _resolve_mfia_context(session, user_id=user_id)
    processing = await _has_processing_orders(session, user_id=user_id)

    if readiness != "ready" or old_id is None or fp_mfia_id is None:
        settings = get_settings()
        external_holdings = await _merge_external_holdings(
            session,
            user_id=user_id,
            fp_holdings=[],
            fund_meta={},
        )
        if external_holdings:
            isins = {str(row.get("isin") or "").upper() for row in external_holdings}
            return_1d_by_isin = await _load_return_1d_by_isin(session, isins=isins)
            _apply_holding_day_change(external_holdings, return_1d_by_isin=return_1d_by_isin)
            current_value = sum(float(row.get("current_value_inr") or 0) for row in external_holdings)
            payload = {
                "status": "ready",
                "has_pending_orders": processing,
                "holdings": external_holdings,
                "as_on": external_holdings[0].get("nav_as_on") if external_holdings else None,
            }
        else:
            payload = {
                "status": readiness,
                "has_pending_orders": processing,
                "holdings": [],
                "as_on": None,
            }
        await _set_cached_portfolio(cache_key, payload, settings=settings)
        return payload

    holdings, _returns, as_on = await _fetch_enriched_holdings(
        session,
        user_id=user_id,
        mfia_old_id=old_id,
        fp_mfia_id=fp_mfia_id,
    )

    isins = {str(row.get("isin") or "").upper() for row in holdings}
    fund_meta = await _load_fund_metadata(session, isins=isins, settings=settings)
    holdings = await _merge_external_holdings(
        session,
        user_id=user_id,
        fp_holdings=holdings,
        fund_meta=fund_meta,
    )
    external_isins = {str(row.get("isin") or "").upper() for row in holdings if row.get("source") == "external"}
    if external_isins:
        fund_meta = {
            **fund_meta,
            **(await _load_fund_metadata(session, isins=external_isins, settings=settings)),
        }
        isins |= external_isins
    return_1d_by_isin = await _load_return_1d_by_isin(session, isins=isins)
    _apply_holding_day_change(holdings, return_1d_by_isin=return_1d_by_isin)

    status = "ready" if holdings else ("processing" if processing else "empty")
    payload = {
        "status": status,
        "has_pending_orders": processing,
        "holdings": holdings,
        "as_on": as_on,
    }
    await _set_cached_portfolio(cache_key, payload, settings=settings)
    return payload


async def _load_primary_bank_label(session: AsyncSession, *, user_id: uuid.UUID) -> str | None:
    row = await session.scalar(
        select(InvestorBankAccount)
        .where(InvestorBankAccount.investor_profile_id == user_id)
        .order_by(InvestorBankAccount.is_primary.desc(), InvestorBankAccount.created_at.asc())
        .limit(1)
    )
    if row is None:
        return None
    bank_name = row.bank_name or "Bank"
    last4 = row.account_number_last4
    return f"{bank_name} ....{last4}" if last4 else bank_name


async def _load_primary_nominee_name(session: AsyncSession, *, user_id: uuid.UUID) -> str | None:
    row = await session.scalar(
        select(InvestorRelatedParty.name)
        .where(InvestorRelatedParty.investor_profile_id == user_id)
        .order_by(InvestorRelatedParty.share_percent.desc(), InvestorRelatedParty.created_at.asc())
        .limit(1)
    )
    return str(row) if row else None


async def _load_local_order_transactions(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    isin: str,
) -> list[dict[str, Any]]:
    rows = (
        await session.execute(
            select(MfOrder.amount_inr, MfOrder.order_type, MfOrder.settled_at, MfOrder.created_at, MfOrder.id)
            .join(MutualFund, MutualFund.id == MfOrder.fund_id)
            .where(
                MfOrder.user_id == user_id,
                MutualFund.isin == isin,
                MfOrder.status == MfOrderStatus.succeeded,
            )
            .order_by(MfOrder.settled_at.desc().nullslast(), MfOrder.created_at.desc())
        )
    ).all()

    transactions: list[dict[str, Any]] = []
    for amount_inr, order_type, settled_at, created_at, order_id in rows:
        txn_date = settled_at or created_at
        if txn_date is None:
            continue
        txn_type = "redeemed" if str(order_type.value).lower() == "redemption" else "invested"
        transactions.append(
            {
                "id": str(order_id),
                "date": txn_date.date().isoformat(),
                "type": txn_type,
                "units": 0.0,
                "nav": 0.0,
                "value_inr": round(float(amount_inr), 2),
            }
        )
    return transactions


async def get_user_portfolio_holding_detail(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    holding_id: str,
) -> dict[str, Any]:
    settings = get_settings()
    cache_key = f"portfolio:holding_detail:v1:{user_id}:{holding_id}"
    cached = await _get_cached_portfolio(cache_key, settings=settings)
    if cached is not None:
        return cached

    parsed = parse_holding_id(holding_id)
    if parsed is None:
        return {"status": "invalid_holding_id", "holding": None}

    folio_number, isin = parsed
    _mfia, old_id, fp_mfia_id, readiness = await _resolve_mfia_context(session, user_id=user_id)

    if readiness != "ready" or old_id is None or fp_mfia_id is None:
        payload = {"status": readiness, "holding": None}
        await _set_cached_portfolio(cache_key, payload, settings=settings)
        return payload

    holdings_payload = await get_holdings_report(
        investment_account_id=old_id,
        folios=folio_number,
    )
    raw_rows = [row for row in parse_holdings_report(holdings_payload) if str(row.get("isin")).upper() == isin]
    if not raw_rows:
        payload = {"status": "not_found", "holding": None}
        await _set_cached_portfolio(cache_key, payload, settings=settings)
        return payload

    row = raw_rows[0]
    fund_meta = await _load_fund_metadata(session, isins={isin}, settings=settings)
    meta = fund_meta.get(isin, {})

    folio_payload = await list_mf_folios(fp_mfia_id=fp_mfia_id, folio_number=folio_number)
    folio_meta = _extract_folio_meta(folio_payload)

    txn_payload = await list_mf_transactions(
        folios=folio_number,
        fp_mfia_id=fp_mfia_id,
        types="purchase,sip,redemption,dividend_payout,dividend_reinvestment,switch_in,switch_out,transfer_in,transfer_out,bonus",
    )
    transactions = parse_mf_transactions(txn_payload, isin=isin)
    if not transactions:
        transactions = await _load_local_order_transactions(session, user_id=user_id, isin=isin)

    scheme_returns = parse_scheme_wise_returns(
        await get_scheme_wise_returns(fp_mfia_id=fp_mfia_id),
        isin=isin,
    )

    invested = float(row.get("invested_inr") or 0)
    current_value = float(row.get("current_value_inr") or 0)
    units = float(row.get("units") or 0)
    redeemable_units = float(row.get("redeemable_units") or units)
    nav = float(row.get("nav") or 0)
    return_inr = current_value - invested
    return_pct = (return_inr / invested * 100) if invested > 0 else 0.0
    avg_nav = (invested / units) if units > 0 else 0.0

    first_txn_date = transactions[-1]["date"] if transactions else None
    invested_months = _months_invested(first_txn_date)

    bank_label = folio_meta.get("redeem_bank_label") or await _load_primary_bank_label(session, user_id=user_id)
    nominee_name = folio_meta.get("nominee_name") or await _load_primary_nominee_name(session, user_id=user_id)

    xirr_pct = scheme_returns.get("xirr_pct")
    if xirr_pct is None and invested > 0:
        xirr_pct = return_pct

    return_1d_by_isin = await _load_return_1d_by_isin(session, isins={isin})
    day_change_row = {
        "isin": isin,
        "current_value_inr": current_value,
    }
    _apply_holding_day_change([day_change_row], return_1d_by_isin=return_1d_by_isin)

    holding = {
        "id": build_portfolio_holding_id(folio_number=folio_number, isin=isin),
        "folio_number": folio_number,
        "isin": isin,
        "fund_name": meta.get("matched_fund_name") or row.get("fund_name") or isin,
        "amc_name": meta.get("amc_name"),
        "amc_logo_url": meta.get("amc_logo_url"),
        "units": units,
        "redeemable_units": redeemable_units,
        "current_value_inr": current_value,
        "redeemable_amount_inr": row.get("redeemable_amount_inr"),
        "invested_inr": invested,
        "return_inr": round(return_inr, 2),
        "return_pct": round(return_pct, 2),
        "allocation_pct": 0.0,
        "nav": nav or None,
        "nav_as_on": row.get("nav_as_on"),
        "holding_mode": folio_meta.get("holding_mode") or "Physical",
        "invested_months": invested_months,
        "avg_nav": round(avg_nav, 4) if avg_nav > 0 else None,
        "current_nav": nav or None,
        "day_change_inr": day_change_row.get("day_change_inr"),
        "day_change_pct": day_change_row.get("day_change_pct"),
        "xirr_pct": xirr_pct,
        "redeem_bank_label": bank_label,
        "nominee_name": nominee_name,
        "transactions": transactions,
    }

    payload = {"status": "ready", "holding": holding}
    await _set_cached_portfolio(cache_key, payload, settings=settings)
    return payload


async def list_user_redeemable_holdings(session: AsyncSession, *, user_id: uuid.UUID) -> dict[str, Any]:
    settings = get_settings()
    cache_key = f"portfolio:redeem_units:v1:{user_id}"
    cached = await _get_cached_portfolio(cache_key, settings=settings)
    if cached is not None:
        return cached

    _mfia, old_id, fp_mfia_id, readiness = await _resolve_mfia_context(session, user_id=user_id)

    if readiness != "ready" or old_id is None or fp_mfia_id is None:
        payload = {"status": readiness, "items": []}
        await _set_cached_portfolio(cache_key, payload, settings=settings)
        return payload

    holdings, _returns, as_on = await _fetch_enriched_holdings(
        session,
        user_id=user_id,
        mfia_old_id=old_id,
        fp_mfia_id=fp_mfia_id,
    )
    redeemable = [row for row in holdings if float(row.get("redeemable_units") or 0) > 0]

    try:
        fp_redemptions = await list_fp_redemptions_for_mfia(fp_mfia_id=fp_mfia_id)
    except FpClientError:
        logger.exception("Failed to list FP redemptions for mfia=%s", fp_mfia_id)
        fp_redemptions = []
    active_by_holding = index_active_redemptions(fp_redemptions)

    items: list[dict[str, Any]] = []
    for row in redeemable:
        holding_id = str(row["id"])
        items.append(
            {
                **row,
                "active_redemption": active_by_holding.get(holding_id),
            }
        )

    payload = {
        "status": "ready" if items else "empty",
        "items": items,
        "as_on": as_on,
    }
    await _set_cached_portfolio(cache_key, payload, settings=settings)
    return payload


async def get_user_redemption_journey(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    fp_redemption_id: str,
) -> dict[str, Any]:
    _mfia, _old_id, fp_mfia_id, readiness = await _resolve_mfia_context(session, user_id=user_id)
    if readiness != "ready" or fp_mfia_id is None:
        return {"status": readiness, "journey": None}

    redemption = await get_mf_redemption(fp_redemption_id)
    if not isinstance(redemption, dict) or not redemption.get("id"):
        return {"status": "not_found", "journey": None}

    redemption_mfia = redemption.get("mf_investment_account")
    if redemption_mfia and str(redemption_mfia) != fp_mfia_id:
        return {"status": "not_found", "journey": None}

    journey = await get_fp_redemption_journey(fp_redemption_id)
    if journey is None:
        return {"status": "not_found", "journey": None}

    return {"status": "ready", "journey": journey}
