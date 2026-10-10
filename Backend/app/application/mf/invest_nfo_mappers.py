from __future__ import annotations

from app.infrastructure.persistence.mf_models import NfoOffer, NfoOfferStatus

INVEST_NFO_STATUSES = {NfoOfferStatus.upcoming, NfoOfferStatus.open}

NFO_DISCLAIMER = (
    "Apply during the NFO window. Units are allotted after close at the allotment NAV. "
    "Chart, Max, and return calculators stay off until the scheme has real NAV history. "
    "Mutual fund investments are subject to market risks. "
    "Read all scheme-related documents carefully."
)


def serialize_nfo_block(offer: NfoOffer | None, *, catalog_only: bool = True) -> dict | None:
    if offer is None or offer.is_hidden:
        return None
    if catalog_only and offer.status not in INVEST_NFO_STATUSES:
        return None
    return {
        "status": offer.status.value,
        "subscription_open_date": offer.subscription_open_date.isoformat() if offer.subscription_open_date else None,
        "subscription_close_date": offer.subscription_close_date.isoformat() if offer.subscription_close_date else None,
        "allotment_date": offer.allotment_date.isoformat() if offer.allotment_date else None,
        "is_featured": offer.is_featured,
        "headline": offer.marketing_headline,
        "body": offer.marketing_body,
        "source": offer.source,
        "disclaimer": NFO_DISCLAIMER,
    }
