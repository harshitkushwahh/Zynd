from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from app.application.mf.mf_tax_templates import CALCULATOR_HORIZONS
from app.application.mf.nav_metrics_calculator import compute_period_return, nav_on_or_before, resolve_period_start_nav

History = list[tuple[date, Decimal]]


@dataclass(frozen=True)
class ProjectionPoint:
    point_date: date
    invested_inr: Decimal
    value_inr: Decimal
    units: Decimal | None = None


@dataclass(frozen=True)
class LumpsumProjection:
    as_of_date: date
    amount_inr: Decimal
    horizon: str
    horizon_days: int
    start_date: date
    start_nav: Decimal
    end_nav: Decimal
    value_inr: Decimal
    return_pct: Decimal | None


@dataclass(frozen=True)
class SipProjection:
    as_of_date: date
    monthly_amount_inr: Decimal
    duration_months: int
    sip_day: int
    total_invested_inr: Decimal
    value_inr: Decimal
    return_pct: Decimal | None
    xirr_pct: Decimal | None
    installments: int
    points: tuple[ProjectionPoint, ...]


@dataclass(frozen=True)
class SwpProjection:
    as_of_date: date
    corpus_inr: Decimal
    monthly_withdrawal_inr: Decimal
    duration_months: int
    withdrawal_day: int
    total_withdrawn_inr: Decimal
    remaining_value_inr: Decimal
    months_sustained: int
    depleted: bool
    points: tuple[ProjectionPoint, ...]


def _quantize_inr(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"))


def _days_in_month(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def add_months(base: date, months: int) -> date:
    month_index = base.month - 1 + months
    year = base.year + month_index // 12
    month = month_index % 12 + 1
    day = min(base.day, _days_in_month(year, month))
    return date(year, month, day)


def day_in_month(year: int, month: int, day: int) -> date:
    return date(year, month, min(max(day, 1), _days_in_month(year, month)))


def sorted_history(history: History) -> History:
    return sorted(history, key=lambda row: row[0])


def horizon_to_days(horizon: str) -> int | None:
    return CALCULATOR_HORIZONS.get(horizon)


def compute_xirr(
    cashflows: list[tuple[date, Decimal]],
    *,
    guess: Decimal = Decimal("0.1"),
    max_iterations: int = 100,
    tolerance: Decimal = Decimal("0.0000001"),
) -> Decimal | None:
    if len(cashflows) < 2:
        return None

    ordered = sorted(cashflows, key=lambda row: row[0])
    base_date = ordered[0][0]
    amounts: list[Decimal] = []
    years: list[Decimal] = []
    for flow_date, amount in ordered:
        if amount == 0:
            continue
        delta_days = (flow_date - base_date).days
        years.append(Decimal(str(delta_days)) / Decimal("365"))
        amounts.append(amount)

    if len(amounts) < 2:
        return None

    rate = guess
    for _ in range(max_iterations):
        npv = Decimal("0")
        derivative = Decimal("0")
        for amount, year_fraction in zip(amounts, years, strict=True):
            if year_fraction == 0:
                npv += amount
                derivative -= amount
                continue
            factor = (Decimal("1") + rate) ** year_fraction
            if factor == 0:
                return None
            npv += amount / factor
            derivative -= year_fraction * amount / ((Decimal("1") + rate) ** (year_fraction + Decimal("1")))

        if abs(npv) < tolerance:
            return _quantize_inr(rate * Decimal("100"))
        if derivative == 0:
            return None
        rate -= npv / derivative
        if rate <= Decimal("-0.9999"):
            rate = Decimal("-0.9999")

    return None


def project_lumpsum(
    history: History,
    *,
    amount_inr: Decimal,
    horizon: str,
) -> LumpsumProjection | None:
    horizon_days = horizon_to_days(horizon)
    if horizon_days is None or amount_inr <= 0:
        return None

    history = sorted_history(history)
    if len(history) < 2:
        return None

    as_of_date, end_nav = history[-1]
    start_date = as_of_date - timedelta(days=horizon_days)
    start_match = resolve_period_start_nav(history, as_of_date, horizon_days)
    if start_match is None or end_nav <= 0:
        return None
    _prior_date, start_nav = start_match
    if start_nav <= 0:
        return None

    value_inr = _quantize_inr(amount_inr * (end_nav / start_nav))
    return LumpsumProjection(
        as_of_date=as_of_date,
        amount_inr=amount_inr,
        horizon=horizon,
        horizon_days=horizon_days,
        start_date=start_date,
        start_nav=start_nav,
        end_nav=end_nav,
        value_inr=value_inr,
        return_pct=compute_period_return(end_nav, start_nav),
    )


def project_lumpsum_scenarios(
    history: History,
    *,
    amount_inr: Decimal,
    horizons: list[str] | None = None,
) -> list[LumpsumProjection]:
    requested = horizons or list(CALCULATOR_HORIZONS.keys())
    scenarios: list[LumpsumProjection] = []
    for horizon in requested:
        projection = project_lumpsum(history, amount_inr=amount_inr, horizon=horizon)
        if projection is not None:
            scenarios.append(projection)
    return scenarios


def project_sip(
    history: History,
    *,
    monthly_amount_inr: Decimal,
    duration_months: int,
    sip_day: int = 5,
) -> SipProjection | None:
    if monthly_amount_inr <= 0 or duration_months <= 0:
        return None

    history = sorted_history(history)
    if len(history) < 2:
        return None

    sip_day = min(max(sip_day, 1), 28)
    as_of_date, end_nav = history[-1]
    if end_nav <= 0:
        return None

    start_anchor = add_months(as_of_date, -duration_months)
    units = Decimal("0")
    total_invested = Decimal("0")
    installments = 0
    cashflows: list[tuple[date, Decimal]] = []
    points: list[ProjectionPoint] = []

    for month_offset in range(duration_months + 1):
        month_date = add_months(start_anchor, month_offset)
        sip_date = day_in_month(month_date.year, month_date.month, sip_day)
        if sip_date > as_of_date:
            break

        nav = nav_on_or_before(history, sip_date)
        if nav is None or nav <= 0:
            continue

        units += monthly_amount_inr / nav
        total_invested += monthly_amount_inr
        installments += 1
        cashflows.append((sip_date, -monthly_amount_inr))
        points.append(
            ProjectionPoint(
                point_date=sip_date,
                invested_inr=_quantize_inr(total_invested),
                value_inr=_quantize_inr(units * nav),
                units=units,
            )
        )

    if installments == 0:
        return None

    value_inr = _quantize_inr(units * end_nav)
    cashflows.append((as_of_date, value_inr))
    return_pct = None
    if total_invested > 0:
        return_pct = _quantize_inr(((value_inr / total_invested) - Decimal("1")) * Decimal("100"))

    return SipProjection(
        as_of_date=as_of_date,
        monthly_amount_inr=monthly_amount_inr,
        duration_months=duration_months,
        sip_day=sip_day,
        total_invested_inr=_quantize_inr(total_invested),
        value_inr=value_inr,
        return_pct=return_pct,
        xirr_pct=compute_xirr(cashflows),
        installments=installments,
        points=tuple(points),
    )


def project_swp(
    history: History,
    *,
    corpus_inr: Decimal,
    monthly_withdrawal_inr: Decimal,
    duration_months: int,
    withdrawal_day: int = 5,
) -> SwpProjection | None:
    if corpus_inr <= 0 or monthly_withdrawal_inr <= 0 or duration_months <= 0:
        return None

    history = sorted_history(history)
    if len(history) < 2:
        return None

    withdrawal_day = min(max(withdrawal_day, 1), 28)
    as_of_date, end_nav = history[-1]
    if end_nav <= 0:
        return None

    start_anchor = add_months(as_of_date, -duration_months)
    start_nav = nav_on_or_before(history, start_anchor)
    if start_nav is None or start_nav <= 0:
        return None

    units = corpus_inr / start_nav
    total_withdrawn = Decimal("0")
    months_sustained = 0
    depleted = False
    points: list[ProjectionPoint] = []

    for month_offset in range(duration_months + 1):
        month_date = add_months(start_anchor, month_offset)
        withdrawal_date = day_in_month(month_date.year, month_date.month, withdrawal_day)
        if withdrawal_date > as_of_date:
            break

        nav = nav_on_or_before(history, withdrawal_date)
        if nav is None or nav <= 0:
            continue

        portfolio_value = units * nav
        if month_offset > 0:
            withdraw_amount = min(monthly_withdrawal_inr, portfolio_value)
            if withdraw_amount <= 0:
                depleted = True
                break
            units -= withdraw_amount / nav
            total_withdrawn += withdraw_amount
            months_sustained += 1
            portfolio_value = units * nav
            if portfolio_value < monthly_withdrawal_inr:
                depleted = portfolio_value <= Decimal("0.01")

        points.append(
            ProjectionPoint(
                point_date=withdrawal_date,
                invested_inr=_quantize_inr(corpus_inr),
                value_inr=_quantize_inr(portfolio_value),
                units=units,
            )
        )

        if depleted:
            break

    remaining_value = _quantize_inr(units * end_nav)
    return SwpProjection(
        as_of_date=as_of_date,
        corpus_inr=_quantize_inr(corpus_inr),
        monthly_withdrawal_inr=_quantize_inr(monthly_withdrawal_inr),
        duration_months=duration_months,
        withdrawal_day=withdrawal_day,
        total_withdrawn_inr=_quantize_inr(total_withdrawn),
        remaining_value_inr=remaining_value,
        months_sustained=months_sustained,
        depleted=depleted,
        points=tuple(points),
    )
