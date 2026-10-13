from __future__ import annotations

import uuid
from datetime import date

from app.application.mf.invest_nfo_eligibility import (
    is_invest_nfo_offer,
    subscription_window_allows_invest,
)
from app.infrastructure.persistence.mf_models import NfoOffer, NfoOfferStatus


def _offer(**kwargs: object) -> NfoOffer:
    base = dict(
        id=uuid.uuid4(),
        product_id=uuid.uuid4(),
        mutual_fund_id=1,
        status=NfoOfferStatus.open,
        subscription_open_date=date(2026, 10, 1),
        subscription_close_date=date(2026, 10, 19),
        is_hidden=False,
        is_featured=False,
        source="AMFI",
        admin_override=False,
    )
    base.update(kwargs)
    return NfoOffer(**base)  # type: ignore[arg-type]


def test_subscription_window_open_inside_range() -> None:
    offer = _offer()
    assert subscription_window_allows_invest(offer=offer, today=date(2026, 10, 12))


def test_subscription_window_closed_after_close_date() -> None:
    offer = _offer()
    assert not subscription_window_allows_invest(offer=offer, today=date(2026, 10, 20))


def test_invest_nfo_requires_amfi_source() -> None:
    offer = _offer(source="HEURISTIC")
    assert not is_invest_nfo_offer(offer, today=date(2026, 10, 12))


def test_invest_nfo_amfi_open_in_window() -> None:
    offer = _offer()
    assert is_invest_nfo_offer(offer, today=date(2026, 10, 12))


def test_admin_override_bypasses_source() -> None:
    offer = _offer(source="HEURISTIC", admin_override=True)
    assert is_invest_nfo_offer(offer, today=date(2026, 10, 12))


def test_invest_nfo_excludes_closed_status() -> None:
    offer = _offer(status=NfoOfferStatus.closed)
    assert not is_invest_nfo_offer(offer, today=date(2026, 10, 12))
