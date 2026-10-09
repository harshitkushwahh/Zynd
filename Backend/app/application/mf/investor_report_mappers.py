"""Map Finprim report payloads into Zynd investor-report tables."""

from __future__ import annotations

from datetime import date
from typing import Any

from app.application.mf.investor_report_pdf import ReportColumn, ReportSection
from app.application.mf.portfolio_holdings_service import parse_holdings_report


def current_indian_fy(today: date) -> tuple[date, date]:
    if today.month >= 4:
        start = date(today.year, 4, 1)
        end = date(today.year + 1, 3, 31)
    else:
        start = date(today.year - 1, 4, 1)
        end = date(today.year, 3, 31)
    return start, min(today, end)


def format_inr(value: Any) -> str:
    number = _as_float(value)
    if number is None:
        return "—"
    sign = "-" if number < 0 else ""
    return f"{sign}{abs(number):,.2f}"


def format_qty(value: Any) -> str:
    number = _as_float(value)
    if number is None:
        return "—"
    return f"{number:,.3f}"


def format_date(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return "—"
    return raw[:10]


def format_pct(value: Any) -> str:
    number = _as_float(value)
    if number is None:
        return "—"
    return f"{number:+.2f}%"


def _scheme_cell(name: Any, isin: Any) -> str:
    title = str(name or "").strip() or "—"
    code = str(isin or "").strip().upper()
    if code and code != title:
        return f"{title}\n{code}"
    return title


def period_label(period_from: date, period_to: date) -> str:
    return f"FY {period_from.year}–{str(period_to.year)[-2:]} · {period_from.isoformat()} to {period_to.isoformat()}"


def _as_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _zip_report_rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    data = payload.get("data")
    if not isinstance(data, dict):
        return []
    columns = data.get("columns") or []
    rows = data.get("rows") or []
    mapped: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, list):
            continue
        mapped.append(dict(zip(columns, row)))
    return mapped


def parse_capital_gains_report(payload: dict[str, Any]) -> list[dict[str, Any]]:
    parsed: list[dict[str, Any]] = []
    for row in _zip_report_rows(payload):
        parsed.append(
            {
                "folio": str(row.get("folio_number") or "").strip() or "—",
                "scheme": _scheme_cell(row.get("scheme_name"), row.get("isin")),
                "isin": str(row.get("isin") or "").strip().upper(),
                "type": str(row.get("type") or "").replace("_", " ").strip() or "—",
                "units": format_qty(row.get("units")),
                "traded_on": format_date(row.get("traded_on")),
                "amount": format_inr(row.get("amount")),
                "taxable_gain": format_inr(row.get("source_taxable_gain")),
                "grandfathering": "Yes" if row.get("grand_fathering") else "No",
            }
        )
    return parsed


def parse_statement_transactions(payload: dict[str, Any]) -> list[dict[str, Any]]:
    rows = payload.get("data")
    if not isinstance(rows, list):
        return []

    parsed: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        parsed.append(
            {
                "date": format_date(row.get("traded_on") or row.get("transaction_date") or row.get("date")),
                "type": str(row.get("type") or "").replace("_", " ").strip() or "—",
                "scheme": _scheme_cell(row.get("rta_scheme_name"), row.get("isin")),
                "folio": str(row.get("folio_number") or "").strip() or "—",
                "units": format_qty(row.get("units")),
                "nav": format_inr(row.get("traded_at") or row.get("price") or row.get("nav")),
                "amount": format_inr(row.get("amount")),
                "isin": str(row.get("isin") or "").strip().upper(),
                "reference": str(
                    row.get("rta_reference_number") or row.get("source_ref_id") or row.get("id") or ""
                ).strip(),
                "raw_type": str(row.get("type") or "").strip().lower(),
            }
        )
    parsed.sort(key=lambda item: item["date"], reverse=True)
    return parsed


def holdings_section(holdings_payload: dict[str, Any]) -> ReportSection:
    columns = (
        ReportColumn("folio", "Folio", 0.12),
        ReportColumn("scheme", "Scheme / ISIN", 0.28),
        ReportColumn("units", "Units", 0.10, "right"),
        ReportColumn("nav", "NAV", 0.10, "right"),
        ReportColumn("invested", "Invested", 0.12, "right"),
        ReportColumn("current", "Current", 0.12, "right"),
        ReportColumn("pnl", "P&L", 0.16, "right"),
    )
    rows = []
    invested_total = 0.0
    current_total = 0.0
    for item in parse_holdings_report(holdings_payload):
        invested = _as_float(item.get("invested_inr")) or 0.0
        current = _as_float(item.get("current_value_inr")) or 0.0
        pnl = current - invested
        pct = (pnl / invested * 100.0) if invested else None
        invested_total += invested
        current_total += current
        as_on = format_date(item.get("nav_as_on"))
        pnl_cell = format_inr(pnl) if pct is None else f"{format_inr(pnl)}\n{format_pct(pct)}"
        if as_on != "—":
            pnl_cell = f"{pnl_cell}\nas on {as_on}"
        rows.append(
            {
                "folio": item.get("folio_number") or "—",
                "scheme": _scheme_cell(item.get("fund_name"), item.get("isin")),
                "units": format_qty(item.get("units")),
                "nav": format_inr(item.get("nav")),
                "invested": format_inr(invested),
                "current": format_inr(current),
                "pnl": pnl_cell,
            }
        )
    totals = None
    if rows:
        total_pnl = current_total - invested_total
        totals = {
            "folio": "Total",
            "scheme": "",
            "units": "",
            "nav": "",
            "invested": format_inr(invested_total),
            "current": format_inr(current_total),
            "pnl": format_inr(total_pnl),
        }
    return ReportSection(
        heading="Holdings",
        columns=columns,
        rows=rows,
        totals=totals,
        empty_message="No holdings / transactions for this period.",
    )


def transactions_section(rows: list[dict[str, Any]], *, heading: str = "Transactions") -> ReportSection:
    visible = [
        {
            "date": row["date"],
            "type": row["type"],
            "scheme": row["scheme"],
            "folio": row["folio"],
            "units": row["units"],
            "nav": row["nav"],
            "amount": row["amount"],
            "reference": row.get("reference") or "—",
        }
        for row in rows
    ]
    return ReportSection(
        heading=heading,
        columns=(
            ReportColumn("date", "Date", 0.10),
            ReportColumn("type", "Type", 0.12),
            ReportColumn("scheme", "Scheme / ISIN", 0.24),
            ReportColumn("folio", "Folio", 0.11),
            ReportColumn("units", "Units", 0.09, "right"),
            ReportColumn("nav", "NAV", 0.10, "right"),
            ReportColumn("amount", "Amount", 0.12, "right"),
            ReportColumn("reference", "Ref", 0.12),
        ),
        rows=visible,
        empty_message="No holdings / transactions for this period.",
    )


def capital_gains_section(rows: list[dict[str, Any]], *, heading: str = "Capital gains") -> ReportSection:
    return ReportSection(
        heading=heading,
        columns=(
            ReportColumn("folio", "Folio", 0.12),
            ReportColumn("scheme", "Scheme", 0.28),
            ReportColumn("type", "Type", 0.12),
            ReportColumn("units", "Units", 0.10, "right"),
            ReportColumn("traded_on", "Traded on", 0.12),
            ReportColumn("amount", "Amount", 0.12, "right"),
            ReportColumn("taxable_gain", "Taxable gain", 0.14, "right"),
        ),
        rows=rows,
        empty_message="No capital gains for this period.",
    )


def elss_purchase_rows(transactions: list[dict[str, Any]], *, elss_isins: set[str]) -> list[dict[str, Any]]:
    if not elss_isins:
        return []
    purchase_types = {"purchase", "sip"}
    return [
        row
        for row in transactions
        if row.get("isin") in elss_isins and row.get("raw_type") in purchase_types
    ]


def dividend_rows(transactions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [row for row in transactions if row.get("raw_type") in {"dividend_payout", "dividend_reinvestment"}]


def summary_section(returns: dict[str, Any], holdings_payload: dict[str, Any]) -> ReportSection:
    invested = returns.get("invested_inr")
    current = returns.get("current_value_inr")
    pnl = returns.get("total_return_inr")
    xirr = returns.get("xirr_pct")
    if invested is None or current is None:
        invested_total = 0.0
        current_total = 0.0
        for item in parse_holdings_report(holdings_payload):
            invested_total += _as_float(item.get("invested_inr")) or 0.0
            current_total += _as_float(item.get("current_value_inr")) or 0.0
        invested = invested if invested is not None else invested_total
        current = current if current is not None else current_total
        if pnl is None:
            pnl = current_total - invested_total
    return ReportSection(
        heading="Summary",
        columns=(
            ReportColumn("invested", "Invested (₹)", 0.25, "right"),
            ReportColumn("current", "Current (₹)", 0.25, "right"),
            ReportColumn("pnl", "Unrealised P&L (₹)", 0.25, "right"),
            ReportColumn("xirr", "XIRR", 0.25, "right"),
        ),
        rows=[
            {
                "invested": format_inr(invested),
                "current": format_inr(current),
                "pnl": format_inr(pnl),
                "xirr": format_pct(xirr),
            }
        ],
    )


def folios_section(folio_payload: dict[str, Any]) -> ReportSection:
    rows: list[dict[str, Any]] = []
    data = folio_payload.get("data")
    if isinstance(data, list):
        for folio in data:
            if not isinstance(folio, dict):
                continue
            number = str(folio.get("number") or folio.get("folio_number") or "").strip()
            if not number:
                continue
            holding = "Demat" if folio.get("dp_id") and folio.get("client_id") else "Physical"
            nominee_name = "—"
            nominee = folio.get("nominee1")
            if isinstance(nominee, dict):
                nominee_name = str(nominee.get("name") or nominee.get("nominee_name") or "—")
            elif isinstance(nominee, str) and nominee.strip():
                nominee_name = nominee.strip()
            bank_label = "—"
            payout_details = folio.get("payout_details")
            if isinstance(payout_details, list):
                for detail in payout_details:
                    if not isinstance(detail, dict):
                        continue
                    bank = detail.get("bank_account") if isinstance(detail.get("bank_account"), dict) else detail
                    if not isinstance(bank, dict):
                        continue
                    account_number = str(bank.get("account_number") or bank.get("number") or "")
                    last4 = account_number[-4:] if len(account_number) >= 4 else account_number
                    name = str(bank.get("bank_name") or bank.get("name") or "Bank").strip()
                    if last4:
                        bank_label = f"{name} ·••{last4}"
                        break
            rows.append(
                {
                    "folio": number,
                    "holding": holding,
                    "nominee": nominee_name,
                    "bank": bank_label,
                }
            )
    return ReportSection(
        heading="Folios",
        columns=(
            ReportColumn("folio", "Folio", 0.22),
            ReportColumn("holding", "Holding", 0.16),
            ReportColumn("nominee", "Nominee", 0.32),
            ReportColumn("bank", "Payout bank", 0.30),
        ),
        rows=rows,
        empty_message="No folio snapshot for this account.",
    )
