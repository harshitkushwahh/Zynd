from app.application.mf.nfo_detection_service import (
    NfoSignals,
    classify_nfo_status,
    name_looks_like_nfo,
    should_assign_nfo_category,
)
from app.infrastructure.persistence.mf_models import NfoOfferStatus


def _signals(**overrides: object) -> NfoSignals:
    base = dict(
        scheme_name="HDFC Flexi Cap Fund",
        purchase_allowed=True,
        nav_row_count=400,
        product_age_days=800,
        shallow_nav_max=30,
        max_age_days=90,
        allotted_nav_min=60,
    )
    base.update(overrides)
    return NfoSignals(**base)  # type: ignore[arg-type]


def test_name_tokens() -> None:
    assert name_looks_like_nfo("ABC NFO Growth")
    assert name_looks_like_nfo("New Fund Offer Series 1")
    assert not name_looks_like_nfo("Flexi Cap Fund")


def test_mature_fund_is_not_nfo() -> None:
    assert classify_nfo_status(_signals()) is None


def test_open_when_purchase_and_shallow_nav() -> None:
    assert classify_nfo_status(_signals(nav_row_count=5, product_age_days=10)) == NfoOfferStatus.open


def test_upcoming_named_nfo_without_purchase() -> None:
    assert (
        classify_nfo_status(
            _signals(scheme_name="Zynd NFO", purchase_allowed=False, nav_row_count=0, product_age_days=2)
        )
        == NfoOfferStatus.upcoming
    )


def test_allotted_after_nav_depth() -> None:
    assert (
        classify_nfo_status(_signals(scheme_name="Zynd NFO", nav_row_count=80, product_age_days=40))
        == NfoOfferStatus.allotted
    )


def test_category_assignment() -> None:
    assert should_assign_nfo_category(NfoOfferStatus.open, hidden=False)
    assert not should_assign_nfo_category(NfoOfferStatus.allotted, hidden=False)
    assert not should_assign_nfo_category(NfoOfferStatus.open, hidden=True)
