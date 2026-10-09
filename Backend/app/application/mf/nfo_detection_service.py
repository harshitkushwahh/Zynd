from __future__ import annotations

from dataclasses import dataclass

from app.infrastructure.persistence.mf_models import NfoOfferStatus

NFO_NAME_TOKENS = ("nfo", "new fund offer")
NFO_CATEGORY_SLUG = "nfo"
NFO_JOB_NAMES: tuple[str, ...] = ("nfo-lifecycle-sync", "nfo-collection-assign-sync")
LISTABLE_STATUSES = (
    NfoOfferStatus.upcoming,
    NfoOfferStatus.open,
    NfoOfferStatus.closed,
)


@dataclass(frozen=True)
class NfoSignals:
    scheme_name: str
    purchase_allowed: bool
    nav_row_count: int
    product_age_days: int | None
    shallow_nav_max: int
    max_age_days: int
    allotted_nav_min: int


def name_looks_like_nfo(scheme_name: str) -> bool:
    lowered = (scheme_name or "").lower()
    return any(token in lowered for token in NFO_NAME_TOKENS)


def classify_nfo_status(signals: NfoSignals) -> NfoOfferStatus | None:
    """Heuristic NFO phase. Returns None when the fund is a regular catalog scheme."""
    hint = name_looks_like_nfo(signals.scheme_name)
    young = signals.product_age_days is not None and signals.product_age_days <= signals.max_age_days
    shallow = signals.nav_row_count <= signals.shallow_nav_max
    deep = signals.nav_row_count >= signals.allotted_nav_min

    if deep and not hint and not young:
        return None
    if deep and (hint or young):
        return NfoOfferStatus.allotted
    if signals.purchase_allowed and (shallow or young or hint):
        return NfoOfferStatus.open
    if not signals.purchase_allowed and hint and signals.nav_row_count == 0:
        return NfoOfferStatus.upcoming
    if not signals.purchase_allowed and (young or hint) and not deep:
        return NfoOfferStatus.closed
    return None


def should_assign_nfo_category(status: NfoOfferStatus | None, *, hidden: bool) -> bool:
    return status in LISTABLE_STATUSES and not hidden
