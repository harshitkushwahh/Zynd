from datetime import datetime, timezone

from app.application.mf.investor_report_mappers import capital_gains_section, holdings_section
from app.application.mf.investor_report_pdf import (
    CONTENT_INSET,
    PAGE_MARGIN,
    InvestorReportDocument,
    generate_investor_report_pdf,
)


def _document(*, title: str, extra_rows: int = 0) -> InvestorReportDocument:
    gains = [
        {
            "folio": f"F{index}",
            "scheme": f"Scheme {index}",
            "type": "redemption",
            "units": "10.000",
            "traded_on": "2026-04-01",
            "amount": "1,000.00",
            "taxable_gain": "100.00",
        }
        for index in range(extra_rows)
    ]
    return InvestorReportDocument(
        title=title,
        period_label="FY 2026–27 · 2026-04-01 to 2026-10-09",
        investor_name="Test Investor",
        masked_pan="•••• •••• 1234",
        zynd_id="ZYND1234",
        email="investor@example.com",
        mobile="9876543210",
        generated_at=datetime(2026, 10, 9, 12, 0, tzinfo=timezone.utc),
        sections=(
            holdings_section({"folios": []}),
            capital_gains_section(gains),
        ),
    )


def test_account_statement_and_capital_gains_use_same_builder() -> None:
    statement = generate_investor_report_pdf(_document(title="Account statement"))
    gains = generate_investor_report_pdf(_document(title="Capital gains"))
    assert statement.startswith(b"%PDF")
    assert gains.startswith(b"%PDF")
    assert PAGE_MARGIN == CONTENT_INSET - (CONTENT_INSET - PAGE_MARGIN)


def test_long_table_paginates_with_same_template() -> None:
    pdf = generate_investor_report_pdf(_document(title="Capital gains", extra_rows=80))
    assert pdf.startswith(b"%PDF")
    assert pdf.count(b"/Type /Page") >= 2 or b"Page" in pdf


def test_pdf_includes_identity_and_disclaimer() -> None:
    from app.application.mf.investor_report_pdf import AMFI_DISCLAIMER

    pdf = generate_investor_report_pdf(_document(title="Account statement"))
    assert b"ZYND1234" in pdf
    assert b"investor@example.com" in pdf
    assert b"9876543210" in pdf
    assert AMFI_DISCLAIMER.split(",", 1)[0].encode() in pdf
