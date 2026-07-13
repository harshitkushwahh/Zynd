from __future__ import annotations

from decimal import Decimal
from typing import Any

_RETURN_WEIGHTS: tuple[tuple[str, Decimal], ...] = (
    ("return_5y", Decimal("0.35")),
    ("return_3y", Decimal("0.25")),
    ("return_1y", Decimal("0.15")),
    ("return_6m", Decimal("0.10")),
    ("return_3m", Decimal("0.08")),
    ("return_1m", Decimal("0.05")),
    ("return_1w", Decimal("0.02")),
)


def weighted_return_score(metrics: Any) -> Decimal | None:
    if metrics is None:
        return None

    weighted_sum = Decimal("0")
    weight_total = Decimal("0")
    for field, weight in _RETURN_WEIGHTS:
        value = getattr(metrics, field, None)
        if value is None:
            continue
        weighted_sum += Decimal(str(value)) * weight
        weight_total += weight

    if weight_total == 0:
        return None
    return weighted_sum / weight_total


def has_minimum_return_history(metrics: Any) -> bool:
    if metrics is None:
        return False
    return getattr(metrics, "return_3y", None) is not None or getattr(metrics, "return_1y", None) is not None
