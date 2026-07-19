from __future__ import annotations

from decimal import Decimal
from types import SimpleNamespace

from app.application.mf.collection_return_score import has_minimum_return_history, weighted_return_score
from app.application.mf.fund_classifier import (
    classify_cap_bucket,
    classify_theme_tags,
    matches_gold_silver_collection,
)


def test_classify_large_cap_from_sebi_category() -> None:
    assert (
        classify_cap_bucket(
            scheme_name="HDFC Top 100 Fund",
            sebi_category="Equity Scheme - Large Cap Fund",
        )
        == "large-cap"
    )


def test_classify_mid_cap_from_scheme_name() -> None:
    assert (
        classify_cap_bucket(
            scheme_name="Axis Midcap Fund - Growth",
            sebi_category="Equity Scheme",
        )
        == "mid-cap"
    )


def test_classify_small_cap() -> None:
    assert (
        classify_cap_bucket(
            scheme_name="Nippon India Small Cap Fund",
            sebi_category=None,
        )
        == "small-cap"
    )


def test_flexi_cap_excluded_from_cap_bucket() -> None:
    assert (
        classify_cap_bucket(
            scheme_name="Parag Parikh Flexi Cap Fund",
            sebi_category="Equity Scheme - Flexi Cap Fund",
        )
        is None
    )


def test_classify_gold_theme_tag() -> None:
    tags = classify_theme_tags(
        scheme_name="SBI Gold Fund",
        sebi_category="Other Scheme - FoF Domestic",
    )
    assert tags == ["gold"]


def test_matches_gold_silver_collection_from_tags() -> None:
    assert matches_gold_silver_collection(
        scheme_name="Some Fund",
        sebi_category=None,
        theme_tags=["silver"],
    )


def test_weighted_return_score_normalizes_available_periods() -> None:
    metrics = SimpleNamespace(
        return_5y=None,
        return_3y=Decimal("30"),
        return_1y=Decimal("12"),
        return_6m=None,
        return_3m=None,
        return_1m=None,
        return_1w=None,
    )
    score = weighted_return_score(metrics)
    assert score is not None
    assert score > Decimal("20")


def test_has_minimum_return_history_requires_1y_or_3y() -> None:
    assert has_minimum_return_history(SimpleNamespace(return_3y=Decimal("10"), return_1y=None))
    assert has_minimum_return_history(SimpleNamespace(return_3y=None, return_1y=Decimal("8")))
    assert not has_minimum_return_history(SimpleNamespace(return_3y=None, return_1y=None))
