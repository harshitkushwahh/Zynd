from app.application.mf.category_mapping import scheme_category_for_nfo
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


def test_nfo_scheme_category_comes_from_sebi() -> None:
    assert scheme_category_for_nfo(None)["scheme_category_name"] == "Unclassified"
    assert scheme_category_for_nfo("Equity Scheme - Large Cap Fund")["scheme_category_slug"] == "equity-funds"
    assert scheme_category_for_nfo("ELSS")["scheme_category_slug"] == "elss-tax-saving"


def test_nfo_calendar_name_match_and_dates() -> None:
    from datetime import date

    from app.application.mf.nfo_calendar_service import (
        NfoCalendarWindow,
        calendar_status_for_window,
        match_nfo_calendar_window,
        normalize_nfo_scheme_name,
        parse_nfo_calendar_date,
    )

    assert normalize_nfo_scheme_name("ICICI PRUDENTIAL LIFE CYCLE FUND 2041 - REGULAR PLAN - GROWTH") == (
        "icici prudential life cycle fund 2041"
    )
    window = NfoCalendarWindow(
        scheme_name="Icici Prudential Life Cycle Fund 2041",
        open_date=date(2026, 8, 26),
        close_date=date(2026, 9, 9),
        allotment_date=date(2026, 9, 15),
        normalized_name="icici prudential life cycle fund 2041",
    )
    matched = match_nfo_calendar_window(
        "ICICI PRUDENTIAL LIFE CYCLE FUND 2041 - REGULAR PLAN - GROWTH",
        [window],
    )
    assert matched is window
    assert calendar_status_for_window(window, date(2026, 9, 1)) == "OPEN"
    assert calendar_status_for_window(window, date(2026, 9, 10)) == "CLOSED"
    assert parse_nfo_calendar_date("09 Sep 2026") == date(2026, 9, 9)


def test_nfo_job_library_has_schedule_fields() -> None:
    from app.application.mf.nfo_scheduler_jobs import nfo_jobs_for_cli

    jobs = nfo_jobs_for_cli()
    names = {job["name"] for job in jobs}
    assert names == {"nfo-lifecycle-sync", "nfo-collection-assign-sync"}
    for job in jobs:
        assert job["sequence"] >= 1
        assert job["phase"] == 1
        assert job["cron"]
        assert job["description"]
