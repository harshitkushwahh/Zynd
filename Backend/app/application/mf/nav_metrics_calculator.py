from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

RETURN_PERIODS: dict[str, int] = {
    "return_1d": 1,
    "return_1w": 7,
    "return_1m": 30,
    "return_3m": 90,
    "return_6m": 180,
    "return_1y": 365,
    "return_3y": 365 * 3,
    "return_5y": 365 * 5,
}

NAV_LOOKUP_TOLERANCE_DAYS = 7


def compute_period_return(current: Decimal, prior: Decimal | None) -> Decimal | None:
    if prior is None or prior <= 0:
        return None
    return ((current / prior) - Decimal("1")) * Decimal("100")


def nav_on_or_before_with_date(
    history: list[tuple[date, Decimal]],
    target: date,
) -> tuple[date, Decimal] | None:
    """Return (date, NAV) at the latest date <= target from sorted (date, nav) pairs."""
    prior_date: date | None = None
    prior_nav: Decimal | None = None
    for nav_date, nav_value in history:
        if nav_date <= target:
            prior_date = nav_date
            prior_nav = nav_value
        else:
            break
    if prior_date is None or prior_nav is None:
        return None
    return prior_date, prior_nav


def nav_on_or_before(history: list[tuple[date, Decimal]], target: date) -> Decimal | None:
    """Return NAV at the latest date <= target from sorted (date, nav) pairs."""
    match = nav_on_or_before_with_date(history, target)
    return match[1] if match else None


def resolve_period_start_nav(
    history: list[tuple[date, Decimal]],
    as_of_date: date,
    period_days: int,
) -> tuple[date, Decimal] | None:
    """Resolve the start NAV for a labeled lookback window, or None if history is insufficient."""
    if not history or period_days <= 0:
        return None

    history = sorted(history, key=lambda row: row[0])
    first_nav_date = history[0][0]
    if (as_of_date - first_nav_date).days < period_days:
        return None

    target_date = as_of_date - timedelta(days=period_days)
    match = nav_on_or_before_with_date(history, target_date)
    if match is None:
        return None

    prior_date, prior_nav = match
    if (target_date - prior_date).days > NAV_LOOKUP_TOLERANCE_DAYS:
        return None
    return prior_date, prior_nav


def compute_metrics_for_history(
    history: list[tuple[date, Decimal]],
) -> tuple[date, dict[str, Decimal | None]] | None:
    if not history:
        return None
    history = sorted(history, key=lambda row: row[0])
    as_of_date, latest_nav = history[-1]
    metrics: dict[str, Decimal | None] = {}

    for field, days in RETURN_PERIODS.items():
        match = resolve_period_start_nav(history, as_of_date, days)
        if match is None:
            metrics[field] = None
            continue
        _, prior_nav = match
        metrics[field] = compute_period_return(latest_nav, prior_nav)

    return as_of_date, metrics
