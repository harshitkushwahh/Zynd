from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.catalog_governance_service import invest_visibility_sql_clause
from app.application.mf.invest_nfo_mappers import INVEST_NFO_STATUSES
from app.application.mf.nfo_dates import today_ist
from app.infrastructure.persistence.mf_models import FundAmc, MutualFund, NfoOffer, Product


def subscription_window_allows_invest(*, offer: NfoOffer, today: date) -> bool:
    """True when today (IST) is inside the offer subscription window for OPEN/UPCOMING."""
    if offer.status not in INVEST_NFO_STATUSES:
        return False
    open_date = offer.subscription_open_date
    close_date = offer.subscription_close_date
    if offer.status.value == "UPCOMING":
        if open_date is not None and today >= open_date:
            if close_date is not None and today > close_date:
                return False
            return True
        return open_date is None or today < open_date
    # OPEN
    if close_date is not None and today > close_date:
        return False
    if open_date is not None and today < open_date:
        return False
    return True


def is_invest_nfo_offer(
    offer: NfoOffer,
    *,
    today: date | None = None,
) -> bool:
    if offer.is_hidden or offer.status not in INVEST_NFO_STATUSES:
        return False
    day = today or today_ist()
    if not subscription_window_allows_invest(offer=offer, today=day):
        return False
    if offer.admin_override:
        return True
    source = (offer.source or "").upper()
    return source in {"AMFI", "ADMIN"}


async def count_investable_nfo_offers(session: AsyncSession, *, today: date | None = None) -> int:
    day = today or today_ist()
    rows = (
        await session.execute(
            select(NfoOffer)
            .join(Product, Product.id == NfoOffer.product_id)
            .join(MutualFund, MutualFund.id == NfoOffer.mutual_fund_id)
            .join(FundAmc, FundAmc.id == MutualFund.amc_id)
            .where(
                invest_visibility_sql_clause(),
                NfoOffer.is_hidden.is_(False),
                NfoOffer.status.in_(tuple(INVEST_NFO_STATUSES)),
            )
        )
    ).scalars()
    return sum(1 for offer in rows if is_invest_nfo_offer(offer, today=day))


def filter_invest_nfo_offers(
    offers: list[NfoOffer],
    *,
    today: date | None = None,
) -> list[NfoOffer]:
    day = today or today_ist()
    return [offer for offer in offers if is_invest_nfo_offer(offer, today=day)]
