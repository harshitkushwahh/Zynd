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


def compute_period_return(current: Decimal, prior: Decimal | None) -> Decimal | None:
    if prior is None or prior <= 0:
        return None
    return ((current / prior) - Decimal("1")) * Decimal("100")


def nav_on_or_before(history: list[tuple[date, Decimal]], target: date) -> Decimal | None:
    """Return NAV at the latest date <= target from sorted (date, nav) pairs."""
    candidate: Decimal | None = None
    for nav_date, nav_value in history:
        if nav_date <= target:
            candidate = nav_value
        else:
            break
    return candidate


def compute_metrics_for_history(
    history: list[tuple[date, Decimal]],
) -> tuple[date, dict[str, Decimal | None]] | None:
    if not history:
        return None
    history = sorted(history, key=lambda row: row[0])
    as_of_date, latest_nav = history[-1]
    metrics: dict[str, Decimal | None] = {}

    for field, days in RETURN_PERIODS.items():
        target_date = as_of_date - timedelta(days=days)
        prior_nav = nav_on_or_before(history, target_date)
        metrics[field] = compute_period_return(latest_nav, prior_nav)

    return as_of_date, metrics
