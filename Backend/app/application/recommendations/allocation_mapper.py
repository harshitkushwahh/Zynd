from __future__ import annotations

from decimal import Decimal
from typing import Any


ALLOCATION_BUCKETS: dict[str, dict[str, str]] = {
    "equity": {"id": "equity", "label": "Equity"},
    "debt": {"id": "debt", "label": "Debt"},
    "hybrid": {"id": "hybrid", "label": "Hybrid"},
    "gold": {"id": "gold", "label": "Gold"},
    "other": {"id": "other", "label": "Other"},
}


def category_slug_to_bucket(slug: str | None) -> str:
    if not slug:
        return "other"
    normalized = slug.lower()
    if "gold" in normalized or "silver" in normalized:
        return "gold"
    if "debt" in normalized or "liquid" in normalized or "gilt" in normalized or "income" in normalized:
        return "debt"
    if "hybrid" in normalized or "balanced" in normalized or "advantage" in normalized:
        return "hybrid"
    if "equity" in normalized or "cap" in normalized or "elss" in normalized:
        return "equity"
    return "other"


def compute_allocation_slices(
    selected_funds: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Build donut slices from selected fund rows.

    Each fund dict may include:
    - allocation_weight_pct: Decimal | float | None
    - primary_category_slug: str | None
    """
    weighted = [fund for fund in selected_funds if fund.get("allocation_weight_pct") is not None]
    if weighted:
        return _normalize_weighted_slices(selected_funds)

    bucket_weights: dict[str, Decimal] = {}
    per_fund_weight = Decimal("100") / Decimal(len(selected_funds) or 1)
    for fund in selected_funds:
        bucket = category_slug_to_bucket(fund.get("primary_category_slug"))
        bucket_weights[bucket] = bucket_weights.get(bucket, Decimal("0")) + per_fund_weight

    return _bucket_weights_to_slices(bucket_weights)


def _normalize_weighted_slices(selected_funds: list[dict[str, Any]]) -> list[dict[str, Any]]:
    raw_total = Decimal("0")
    bucket_weights: dict[str, Decimal] = {}
    for fund in selected_funds:
        weight = fund.get("allocation_weight_pct")
        if weight is None:
            continue
        amount = Decimal(str(weight))
        raw_total += amount
        bucket = category_slug_to_bucket(fund.get("primary_category_slug"))
        bucket_weights[bucket] = bucket_weights.get(bucket, Decimal("0")) + amount

    if raw_total <= 0:
        return compute_allocation_slices(
            [{**fund, "allocation_weight_pct": None} for fund in selected_funds]
        )

    normalized: dict[str, Decimal] = {
        bucket: (amount / raw_total) * Decimal("100") for bucket, amount in bucket_weights.items()
    }
    return _bucket_weights_to_slices(normalized)


def _bucket_weights_to_slices(bucket_weights: dict[str, Decimal]) -> list[dict[str, Any]]:
    slices: list[dict[str, Any]] = []
    for bucket_id, weight in sorted(bucket_weights.items(), key=lambda item: item[0]):
        meta = ALLOCATION_BUCKETS.get(bucket_id, ALLOCATION_BUCKETS["other"])
        slices.append(
            {
                "id": meta["id"],
                "label": meta["label"],
                "value_pct": float(round(weight, 1)),
            }
        )
    return _adjust_rounding_drift(slices)


def _adjust_rounding_drift(slices: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not slices:
        return slices
    total = sum(float(slice_["value_pct"]) for slice_ in slices)
    drift = round(100.0 - total, 1)
    if drift == 0:
        return slices
    largest = max(slices, key=lambda slice_: slice_["value_pct"])
    adjusted = []
    for slice_ in slices:
        if slice_["id"] == largest["id"]:
            adjusted.append({**slice_, "value_pct": round(float(slice_["value_pct"]) + drift, 1)})
        else:
            adjusted.append(slice_)
    return adjusted
