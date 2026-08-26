from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.application.mf.nav_metrics_calculator import (
    compute_cagr_return,
    compute_metrics_for_history,
    compute_period_return,
    nav_on_or_before,
    nav_on_or_before_with_date,
    resolve_period_start_nav,
)


def test_compute_period_return() -> None:
    assert compute_period_return(Decimal("110"), Decimal("100")) == Decimal("10")
    assert compute_period_return(Decimal("110"), Decimal("0")) is None


def test_compute_cagr_return() -> None:
    # 100 -> 140 over 3 years = 40% absolute, ~11.87% p.a. CAGR
    assert compute_cagr_return(Decimal("140"), Decimal("100"), years=Decimal("3")) == Decimal("11.8689")
    assert compute_cagr_return(Decimal("110"), Decimal("100"), years=Decimal("1")) == Decimal("10")
    assert compute_cagr_return(Decimal("110"), Decimal("0"), years=Decimal("3")) is None


def test_compute_metrics_for_history_uses_cagr_for_multi_year_horizons() -> None:
    history = [
        (date(2023, 1, 1), Decimal("100")),
        (date(2026, 1, 1), Decimal("140")),
    ]
    result = compute_metrics_for_history(history)
    assert result is not None
    _as_of, metrics = result
    assert metrics["return_3y"] == Decimal("11.8689")
    assert metrics["return_5y"] is None


def test_nav_on_or_before() -> None:
    history = [
        (date(2026, 1, 1), Decimal("100")),
        (date(2026, 2, 1), Decimal("105")),
        (date(2026, 3, 1), Decimal("110")),
    ]
    assert nav_on_or_before(history, date(2026, 2, 15)) == Decimal("105")
    assert nav_on_or_before(history, date(2025, 12, 1)) is None


def test_nav_on_or_before_with_date() -> None:
    history = [
        (date(2026, 1, 1), Decimal("100")),
        (date(2026, 2, 1), Decimal("105")),
    ]
    assert nav_on_or_before_with_date(history, date(2026, 1, 15)) == (date(2026, 1, 1), Decimal("100"))


def test_compute_metrics_for_history() -> None:
    history = [
        (date(2025, 1, 1), Decimal("100")),
        (date(2026, 1, 1), Decimal("110")),
    ]
    result = compute_metrics_for_history(history)
    assert result is not None
    as_of, metrics = result
    assert as_of == date(2026, 1, 1)
    assert metrics["return_1y"] == Decimal("10")


def test_compute_metrics_for_history_skips_long_horizons_with_short_history() -> None:
    history = [
        (date(2026, 1, 1), Decimal("100")),
        (date(2026, 2, 1), Decimal("190")),
    ]
    result = compute_metrics_for_history(history)
    assert result is not None
    _as_of, metrics = result
    assert metrics["return_1m"] == Decimal("90")
    assert metrics["return_3m"] is None
    assert metrics["return_6m"] is None
    assert metrics["return_1y"] is None
    assert metrics["return_3y"] is None
    assert metrics["return_5y"] is None


def test_compute_metrics_for_history_skips_sparse_short_periods() -> None:
    history = [
        (date(2026, 1, 1), Decimal("100")),
        (date(2026, 1, 31), Decimal("190")),
    ]
    result = compute_metrics_for_history(history)
    assert result is not None
    _as_of, metrics = result
    assert metrics["return_1d"] is None
    assert metrics["return_1w"] is None
    assert metrics["return_1m"] == Decimal("90")


def test_resolve_period_start_nav_requires_full_span() -> None:
    history = [
        (date(2026, 1, 1), Decimal("100")),
        (date(2026, 2, 1), Decimal("110")),
    ]
    assert resolve_period_start_nav(history, date(2026, 2, 1), 365) is None
