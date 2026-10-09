from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.application.mf.mf_projection_calculator import (
    add_months,
    day_in_month,
    project_lumpsum,
    project_lumpsum_scenarios,
    project_sip,
    project_swp,
)
from app.application.mf.nav_metrics_calculator import compute_metrics_for_history
from app.application.mf.return_calculator_snapshot_service import _build_horizons_from_history


def _history() -> list[tuple[date, Decimal]]:
    return [
        (date(2025, 1, 5), Decimal("100")),
        (date(2025, 2, 5), Decimal("110")),
        (date(2025, 3, 5), Decimal("105")),
        (date(2025, 4, 5), Decimal("115")),
        (date(2025, 5, 5), Decimal("120")),
        (date(2025, 6, 5), Decimal("125")),
    ]


def test_project_lumpsum_one_year() -> None:
    history = [
        (date(2025, 1, 1), Decimal("100")),
        (date(2026, 1, 1), Decimal("110")),
    ]
    result = project_lumpsum(history, amount_inr=Decimal("1000"), horizon="1y")
    assert result is not None
    assert result.value_inr == Decimal("1100.00")
    assert result.return_pct == Decimal("10")


def test_project_lumpsum_scenarios_projects_missing_horizons_from_trailing() -> None:
    history = [
        (date(2025, 1, 1), Decimal("100")),
        (date(2026, 1, 1), Decimal("110")),
    ]
    scenarios = project_lumpsum_scenarios(history, amount_inr=Decimal("1000"), horizons=["1y", "5y"])
    by_horizon = {row.horizon: row for row in scenarios}
    assert set(by_horizon) == {"1y", "5y"}
    assert by_horizon["1y"].value_inr == Decimal("1100.00")
    assert by_horizon["5y"].value_inr == Decimal("1610.51")


def test_project_lumpsum_one_month_history_still_projects_five_year() -> None:
    history = [
        (date(2026, 1, 1), Decimal("100")),
        (date(2026, 1, 31), Decimal("110")),
    ]
    result = project_lumpsum(history, amount_inr=Decimal("1000"), horizon="5y")
    assert result is not None
    assert result.value_inr > Decimal("1000")

    catalog = compute_metrics_for_history(history)
    assert catalog is not None
    _as_of, metrics = catalog
    assert metrics["return_3y"] is None
    assert metrics["return_5y"] is None
    assert metrics["return_1m"] == Decimal("10")


def test_snapshot_fills_missing_horizons_from_trailing() -> None:
    history = [
        (date(2026, 1, 1), Decimal("100")),
        (date(2026, 1, 31), Decimal("110")),
    ]
    as_of_date, horizons = _build_horizons_from_history(history)
    assert as_of_date == date(2026, 1, 31)
    assert "3m" in horizons
    assert "5y" in horizons
    assert horizons["5y"]["projected_from_trailing"] is True
    assert horizons["5y"]["multiplier"] > 1


def test_project_sip_accumulates_units() -> None:
    result = project_sip(
        _history(),
        monthly_amount_inr=Decimal("1000"),
        duration_months=3,
        sip_day=5,
    )
    assert result is not None
    assert result.installments >= 3
    assert result.total_invested_inr == Decimal(result.installments * 1000)
    assert result.value_inr > result.total_invested_inr


def test_project_swp_withdraws_monthly() -> None:
    result = project_swp(
        _history(),
        corpus_inr=Decimal("10000"),
        monthly_withdrawal_inr=Decimal("1000"),
        duration_months=3,
        withdrawal_day=5,
    )
    assert result is not None
    assert result.total_withdrawn_inr > 0
    assert result.months_sustained >= 1
    assert result.remaining_value_inr >= Decimal("0")


def test_add_months_and_day_in_month() -> None:
    assert add_months(date(2026, 1, 31), 1) == date(2026, 2, 28)
    assert day_in_month(2026, 2, 31) == date(2026, 2, 28)
