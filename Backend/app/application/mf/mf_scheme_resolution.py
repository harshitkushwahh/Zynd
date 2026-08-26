"""Resolve Cybrilla/FinPrim scheme identifiers for purchase and SIP plan APIs."""

from __future__ import annotations

from sqlalchemy import ColumnElement, func, or_

from app.infrastructure.persistence.mf_models import MutualFund


def normalize_fp_scheme(value: str | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    upper = text.upper()
    if upper.startswith("INF"):
        return upper
    return text


def resolve_mf_purchase_scheme(
    fund: MutualFund | None,
    *,
    stored_scheme: str | None = None,
) -> tuple[str | None, str | None]:
    """Return primary and fallback scheme ids, preferring ISINs over internal numeric ids."""
    candidates: list[str] = []
    for raw in (
        stored_scheme,
        fund.isin_growth if fund else None,
        fund.isin_div_reinvestment if fund else None,
        fund.fp_scheme_id if fund else None,
    ):
        scheme = normalize_fp_scheme(raw)
        if scheme and scheme not in candidates:
            candidates.append(scheme)

    isins = [scheme for scheme in candidates if scheme.startswith("INF")]
    others = [scheme for scheme in candidates if not scheme.startswith("INF")]
    ordered = isins + others
    if not ordered:
        return None, None

    primary = ordered[0]
    fallback = next((scheme for scheme in ordered[1:] if scheme != primary), None)
    return primary, fallback


def mutual_fund_isin_equals(isin: str) -> ColumnElement[bool]:
    normalized = str(isin).strip().upper()
    return or_(
        func.upper(MutualFund.isin_growth) == normalized,
        func.upper(MutualFund.isin_div_reinvestment) == normalized,
    )


def mutual_fund_isin_in(isins: set[str] | list[str]) -> ColumnElement[bool]:
    normalized = sorted({str(isin).strip().upper() for isin in isins if isin})
    return or_(
        func.upper(MutualFund.isin_growth).in_(normalized),
        func.upper(MutualFund.isin_div_reinvestment).in_(normalized),
    )


def matching_fund_isins(
    *,
    isin_growth: str | None,
    isin_div_reinvestment: str | None,
    requested: set[str],
) -> list[str]:
    matched: list[str] = []
    for raw in (isin_growth, isin_div_reinvestment):
        if not raw:
            continue
        key = str(raw).upper()
        if key in requested and key not in matched:
            matched.append(key)
    return matched


def is_scheme_unavailable_for_transaction(exc: Exception) -> bool:
    message = str(exc).strip().lower()
    return "scheme" in message and "not available" in message
