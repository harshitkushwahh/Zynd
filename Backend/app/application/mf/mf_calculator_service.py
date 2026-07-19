from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any, Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.invest_catalog_cache import build_invest_cache_key, get_cached_json, set_cached_json
from app.application.mf.invest_home_service import get_invest_config
from app.application.mf.investment_constraints import serialize_investment_constraints_for_api
from app.application.mf.mf_calculator_errors import MfCalculatorError
from app.application.mf.mf_nav_history_service import load_fund_nav_history, resolve_fund_by_product_id
from app.application.mf.mf_projection_calculator import (
    LumpsumProjection,
    ProjectionPoint,
    SipProjection,
    SwpProjection,
    project_lumpsum_scenarios,
    project_sip,
    project_swp,
)
from app.application.mf.mf_tax_templates import CALCULATOR_HORIZONS
from app.core.config import get_settings
from app.infrastructure.persistence.mf_models import MutualFund

MAX_LUMPSUM_CALCULATOR_AMOUNT_INR = 100_000_000
MAX_SIP_MONTHLY_AMOUNT_INR = 100_000
MAX_CALCULATOR_AMOUNT_INR = MAX_LUMPSUM_CALCULATOR_AMOUNT_INR
MAX_DURATION_MONTHS = 999
MIN_HISTORY_POINTS = 2


def _decimal(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return float(value)


def _serialize_point(point: ProjectionPoint) -> dict[str, Any]:
    return {
        "date": point.point_date.isoformat(),
        "invested_inr": _decimal(point.invested_inr),
        "value_inr": _decimal(point.value_inr),
        "units": _decimal(point.units) if point.units is not None else None,
    }


def _data_quality(history_len: int) -> str:
    if history_len < MIN_HISTORY_POINTS:
        return "insufficient_history"
    if history_len < 180:
        return "shallow_nav_history"
    return "ok"


def fund_swp_allowed(fund: MutualFund) -> bool:
    constraints = fund.investment_constraints
    if not isinstance(constraints, dict):
        return True
    details = serialize_investment_constraints_for_api(constraints)
    if not details:
        return True
    transaction_types = details.get("transaction_types") or []
    if not transaction_types:
        return True
    return "swp" in transaction_types


def _validate_amount(
    amount_inr: float,
    *,
    field: str = "amount_inr",
    max_amount_inr: float = MAX_CALCULATOR_AMOUNT_INR,
) -> Decimal:
    amount = Decimal(str(amount_inr))
    if amount <= 0 or amount > max_amount_inr:
        raise MfCalculatorError(
            code="invalid_amount",
            message=f"{field} must be between 0 and {max_amount_inr}",
        )
    return amount


def _validate_duration_months(duration_months: int) -> int:
    if duration_months < 1 or duration_months > MAX_DURATION_MONTHS:
        raise MfCalculatorError(
            code="invalid_duration",
            message=f"duration_months must be between 1 and {MAX_DURATION_MONTHS}",
        )
    return duration_months


def _validate_day(day: int, *, field: str) -> int:
    if day < 1 or day > 28:
        raise MfCalculatorError(code="invalid_day", message=f"{field} must be between 1 and 28")
    return day


def _validate_horizons(horizons: list[str] | None) -> list[str]:
    if not horizons:
        return list(CALCULATOR_HORIZONS.keys())
    invalid = [horizon for horizon in horizons if horizon not in CALCULATOR_HORIZONS]
    if invalid:
        raise MfCalculatorError(
            code="invalid_horizon",
            message=f"Unsupported horizons: {', '.join(invalid)}",
        )
    return horizons


def _validate_lumpsum_amount(fund: MutualFund, amount: Decimal) -> None:
    min_amount = fund.min_lumpsum_amount
    if min_amount is not None and amount < min_amount:
        raise MfCalculatorError(
            code="below_min_lumpsum",
            message=f"Minimum lumpsum amount is INR {min_amount}",
        )


def _validate_sip_amount(fund: MutualFund, amount: Decimal) -> None:
    min_amount = fund.min_sip_amount
    if min_amount is not None and amount < min_amount:
        raise MfCalculatorError(
            code="below_min_sip",
            message=f"Minimum SIP amount is INR {min_amount}",
        )


def _serialize_lumpsum_scenarios(
    *,
    product_id: uuid.UUID,
    amount_inr: Decimal,
    scenarios: list[LumpsumProjection],
    disclaimer: str,
    data_quality: str,
) -> dict[str, Any]:
    as_of_date = scenarios[0].as_of_date.isoformat() if scenarios else None
    return {
        "product_id": str(product_id),
        "mode": "lumpsum",
        "amount_inr": float(amount_inr),
        "as_of_date": as_of_date,
        "data_quality": data_quality,
        "disclaimer": disclaimer,
        "scenarios": [
            {
                "horizon": scenario.horizon,
                "invested_inr": float(amount_inr),
                "value_inr": float(scenario.value_inr),
                "return_pct": _decimal(scenario.return_pct),
            }
            for scenario in scenarios
        ],
        "points": [],
    }


def _serialize_sip_projection(
    *,
    product_id: uuid.UUID,
    projection: SipProjection,
    disclaimer: str,
    data_quality: str,
) -> dict[str, Any]:
    return {
        "product_id": str(product_id),
        "mode": "sip",
        "monthly_amount_inr": float(projection.monthly_amount_inr),
        "duration_months": projection.duration_months,
        "sip_day": projection.sip_day,
        "total_invested_inr": float(projection.total_invested_inr),
        "projected_value_inr": float(projection.value_inr),
        "return_pct": _decimal(projection.return_pct),
        "xirr_pct": _decimal(projection.xirr_pct),
        "installments": projection.installments,
        "as_of_date": projection.as_of_date.isoformat(),
        "data_quality": data_quality,
        "disclaimer": disclaimer,
        "points": [_serialize_point(point) for point in projection.points],
    }


def _serialize_swp_projection(
    *,
    product_id: uuid.UUID,
    projection: SwpProjection,
    disclaimer: str,
    data_quality: str,
) -> dict[str, Any]:
    return {
        "product_id": str(product_id),
        "mode": "swp",
        "corpus_inr": float(projection.corpus_inr),
        "monthly_withdrawal_inr": float(projection.monthly_withdrawal_inr),
        "duration_months": projection.duration_months,
        "withdrawal_day": projection.withdrawal_day,
        "total_withdrawn_inr": float(projection.total_withdrawn_inr),
        "remaining_value_inr": float(projection.remaining_value_inr),
        "months_sustained": projection.months_sustained,
        "depleted": projection.depleted,
        "as_of_date": projection.as_of_date.isoformat(),
        "data_quality": data_quality,
        "disclaimer": disclaimer,
        "points": [_serialize_point(point) for point in projection.points],
    }


async def _load_history_for_fund(session: AsyncSession, fund: MutualFund) -> list[tuple]:
    return await load_fund_nav_history(session, fund_id=fund.id)


async def compute_lumpsum_calculator(
    session: AsyncSession,
    *,
    product_id: uuid.UUID,
    amount_inr: float,
    horizons: list[str] | None = None,
) -> dict[str, Any] | None:
    settings = get_settings()
    if not settings.zynd_mf_calculators_enabled:
        raise MfCalculatorError(
            code="calculators_disabled",
            message="Fund calculators are not enabled",
            status_code=503,
        )

    row = await resolve_fund_by_product_id(session, product_id)
    if not row:
        return None

    _product, fund, _amc = row
    amount = _validate_amount(amount_inr, max_amount_inr=MAX_LUMPSUM_CALCULATOR_AMOUNT_INR)
    validated_horizons = _validate_horizons(horizons)

    history = await _load_history_for_fund(session, fund)
    config = await get_invest_config(session)
    data_quality = _data_quality(len(history))

    scenarios = project_lumpsum_scenarios(history, amount_inr=amount, horizons=validated_horizons)
    return _serialize_lumpsum_scenarios(
        product_id=product_id,
        amount_inr=amount,
        scenarios=scenarios,
        disclaimer=config["disclaimer"],
        data_quality=data_quality,
    )


async def compute_sip_calculator(
    session: AsyncSession,
    *,
    product_id: uuid.UUID,
    monthly_amount_inr: float,
    duration_months: int,
    sip_day: int = 5,
) -> dict[str, Any] | None:
    settings = get_settings()
    if not settings.zynd_mf_calculators_enabled:
        raise MfCalculatorError(
            code="calculators_disabled",
            message="Fund calculators are not enabled",
            status_code=503,
        )

    row = await resolve_fund_by_product_id(session, product_id)
    if not row:
        return None

    _product, fund, _amc = row
    amount = _validate_amount(
        monthly_amount_inr,
        field="monthly_amount_inr",
        max_amount_inr=MAX_SIP_MONTHLY_AMOUNT_INR,
    )
    duration = _validate_duration_months(duration_months)
    day = _validate_day(sip_day, field="sip_day")

    history = await _load_history_for_fund(session, fund)
    config = await get_invest_config(session)
    data_quality = _data_quality(len(history))

    projection = project_sip(
        history,
        monthly_amount_inr=amount,
        duration_months=duration,
        sip_day=day,
    )
    if projection is None:
        return {
            "product_id": str(product_id),
            "mode": "sip",
            "monthly_amount_inr": float(amount),
            "duration_months": duration,
            "sip_day": day,
            "total_invested_inr": 0.0,
            "projected_value_inr": 0.0,
            "return_pct": None,
            "xirr_pct": None,
            "installments": 0,
            "as_of_date": None,
            "data_quality": data_quality,
            "disclaimer": config["disclaimer"],
            "points": [],
        }

    return _serialize_sip_projection(
        product_id=product_id,
        projection=projection,
        disclaimer=config["disclaimer"],
        data_quality=data_quality,
    )


async def compute_swp_calculator(
    session: AsyncSession,
    *,
    product_id: uuid.UUID,
    corpus_inr: float,
    monthly_withdrawal_inr: float,
    duration_months: int,
    withdrawal_day: int = 5,
) -> dict[str, Any] | None:
    settings = get_settings()
    if not settings.zynd_mf_calculators_enabled:
        raise MfCalculatorError(
            code="calculators_disabled",
            message="Fund calculators are not enabled",
            status_code=503,
        )

    row = await resolve_fund_by_product_id(session, product_id)
    if not row:
        return None

    _product, fund, _amc = row
    if not fund_swp_allowed(fund):
        raise MfCalculatorError(
            code="swp_not_allowed",
            message="SWP is not available for this fund",
        )

    corpus = _validate_amount(corpus_inr, field="corpus_inr")
    withdrawal = _validate_amount(monthly_withdrawal_inr, field="monthly_withdrawal_inr")
    duration = _validate_duration_months(duration_months)
    day = _validate_day(withdrawal_day, field="withdrawal_day")

    history = await _load_history_for_fund(session, fund)
    config = await get_invest_config(session)
    data_quality = _data_quality(len(history))

    projection = project_swp(
        history,
        corpus_inr=corpus,
        monthly_withdrawal_inr=withdrawal,
        duration_months=duration,
        withdrawal_day=day,
    )
    if projection is None:
        return {
            "product_id": str(product_id),
            "mode": "swp",
            "corpus_inr": float(corpus),
            "monthly_withdrawal_inr": float(withdrawal),
            "duration_months": duration,
            "withdrawal_day": day,
            "total_withdrawn_inr": 0.0,
            "remaining_value_inr": 0.0,
            "months_sustained": 0,
            "depleted": True,
            "as_of_date": None,
            "data_quality": data_quality,
            "disclaimer": config["disclaimer"],
            "points": [],
        }

    return _serialize_swp_projection(
        product_id=product_id,
        projection=projection,
        disclaimer=config["disclaimer"],
        data_quality=data_quality,
    )


async def compute_return_calculator(
    session: AsyncSession,
    *,
    product_id: uuid.UUID,
    amount_inr: float,
    mode: Literal["lumpsum", "sip"] = "lumpsum",
    horizons: list[str] | None = None,
    duration_months: int = 12,
    sip_day: int = 5,
) -> dict[str, Any] | None:
    if mode == "sip":
        sip_payload = await compute_sip_calculator(
            session,
            product_id=product_id,
            monthly_amount_inr=amount_inr,
            duration_months=duration_months,
            sip_day=sip_day,
        )
        if sip_payload is None:
            return None
        return {
            "product_id": sip_payload["product_id"],
            "amount_inr": sip_payload["monthly_amount_inr"],
            "mode": "sip",
            "as_of_date": sip_payload.get("as_of_date"),
            "data_quality": sip_payload.get("data_quality"),
            "disclaimer": sip_payload.get("disclaimer"),
            "scenarios": [
                {
                    "horizon": f"{sip_payload['duration_months']}m",
                    "invested_inr": sip_payload["total_invested_inr"],
                    "value_inr": sip_payload["projected_value_inr"],
                    "return_pct": sip_payload.get("return_pct"),
                }
            ],
        }

    lumpsum_payload = await compute_lumpsum_calculator(
        session,
        product_id=product_id,
        amount_inr=amount_inr,
        horizons=horizons,
    )
    if lumpsum_payload is None:
        return None
    return {
        "product_id": lumpsum_payload["product_id"],
        "amount_inr": lumpsum_payload["amount_inr"],
        "mode": "lumpsum",
        "as_of_date": lumpsum_payload.get("as_of_date"),
        "scenarios": lumpsum_payload.get("scenarios", []),
    }


async def cached_compute_calculator(
    session: AsyncSession,
    *,
    kind: str,
    product_id: uuid.UUID,
    cache_parts: list[str],
    compute_fn,
) -> dict[str, Any] | None:
    settings = get_settings()
    cache_key = await build_invest_cache_key("calc-v2", kind, str(product_id), *cache_parts)
    cached = await get_cached_json(cache_key, settings=settings)
    if cached is not None:
        return cached

    payload = await compute_fn()
    if payload is None:
        return None

    await set_cached_json(
        cache_key,
        payload,
        ttl_seconds=settings.zynd_mf_invest_cache_calc_ttl_seconds,
        settings=settings,
    )
    return payload
