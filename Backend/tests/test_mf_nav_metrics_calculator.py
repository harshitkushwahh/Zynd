from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.application.mf.nav_metrics_calculator import (
    compute_metrics_for_history,
    compute_period_return,
    nav_on_or_before,
)


def test_compute_period_return() -> None:
    assert compute_period_return(Decimal("110"), Decimal("100")) == Decimal("10")
    assert compute_period_return(Decimal("110"), Decimal("0")) is None


def test_nav_on_or_before() -> None:
    history = [
        (date(2026, 1, 1), Decimal("100")),
        (date(2026, 2, 1), Decimal("105")),
        (date(2026, 3, 1), Decimal("110")),
    ]
    assert nav_on_or_before(history, date(2026, 2, 15)) == Decimal("105")
    assert nav_on_or_before(history, date(2025, 12, 1)) is None


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
