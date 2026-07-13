from __future__ import annotations

from decimal import Decimal
from types import SimpleNamespace

from app.application.mf.popular_funds_service import compute_popularity_score


def test_popularity_score_requires_return_history() -> None:
    metrics = SimpleNamespace(return_3y=None, return_1y=None, return_5y=None)
    assert compute_popularity_score(metrics, latest_aum_inr=None, best_rank=1, is_featured=True) is None


def test_popularity_score_weights_returns_rank_and_featured() -> None:
    metrics = SimpleNamespace(
        return_5y=Decimal("40"),
        return_3y=Decimal("30"),
        return_1y=Decimal("12"),
        return_6m=None,
        return_3m=None,
        return_1m=None,
        return_1w=None,
    )
    base = compute_popularity_score(
        metrics,
        latest_aum_inr=None,
        best_rank=None,
        is_featured=False,
    )
    boosted = compute_popularity_score(
        metrics,
        latest_aum_inr=Decimal("5000000000"),
        best_rank=3,
        is_featured=True,
    )
    assert base is not None
    assert boosted is not None
    assert boosted > base
