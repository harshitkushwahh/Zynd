from __future__ import annotations

from app.infrastructure.persistence.mf_models import NfoOffer

NFO_DISCLAIMER = (
    "NFO units are allotted after the offer closes, at the allotment NAV. "
    "Past performance is not available for new schemes. "
    "Mutual fund investments are subject to market risks."
)


def serialize_nfo_block(offer: NfoOffer | None) -> dict | None:
    if offer is None or offer.is_hidden:
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
