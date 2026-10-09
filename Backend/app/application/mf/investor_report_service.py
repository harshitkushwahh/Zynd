"""Generate, persist, and download investor A4 reports from Finprim data."""

from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.kyc.bootstrap_redaction import mask_pan_display
from app.application.mf.investor_report_mappers import (
    capital_gains_section,
    current_indian_fy,
    dividend_rows,
    elss_purchase_rows,
    folios_section,
    holdings_section,
    parse_capital_gains_report,
    parse_statement_transactions,
    period_label,
    summary_section,
    transactions_section,
)
from app.application.mf.investor_report_pdf import InvestorReportDocument, generate_investor_report_pdf
from app.application.mf.mf_investment_account_service import ensure_fp_mfia, ensure_mfia_old_id
from app.application.mf.mf_order_service import get_or_create_mf_investment_account
from app.application.mf.portfolio_holdings_service import parse_holdings_report, parse_investment_account_returns
from app.core.config import Settings, get_settings
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.mf.fp_oms_client import (
    get_capital_gains_report,
    get_holdings_report,
    get_investment_account_wise_returns,
    list_mf_folios,
    list_mf_transactions,
)
from app.infrastructure.persistence.mf_models import MutualFund
from app.infrastructure.persistence.mf_transaction_models import (
    MfGeneratedReport,
    MfGeneratedReportKind,
    MfGeneratedReportStatus,
)
from app.infrastructure.persistence.models import KycJourneyState, User
from app.infrastructure.storage.documents.factory import get_document_storage

logger = logging.getLogger(__name__)

REPORT_TITLES = {
    MfGeneratedReportKind.account_statement: "Account statement",
    MfGeneratedReportKind.capital_gains: "Capital gains",
    MfGeneratedReportKind.tax: "Tax reports",
}

_TXN_TYPES = (
    "purchase,sip,redemption,dividend_payout,dividend_reinvestment,"
    "switch_in,switch_out,transfer_in,transfer_out,bonus"
)


class InvestorReportError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def _investor_name(user: User) -> str:
    parts = [user.first_name, user.middle_name, user.last_name]
    name = " ".join(part.strip() for part in parts if part and part.strip())
    return name or user.email.split("@", 1)[0]


async def _masked_pan(db: AsyncSession, *, user_id: UUID) -> str | None:
    try:
        async with db.begin_nested():
            journey = await db.get(KycJourneyState, user_id)
    except Exception:
        logger.warning("Could not load PAN for investor report user=%s", user_id, exc_info=True)
        return None
    pan = ""
    if journey and isinstance(journey.pan_draft_json, dict):
        pan = str(journey.pan_draft_json.get("panNumber") or "")
    return mask_pan_display(pan)


def _storage_key(*, user_id: UUID, report_id: UUID) -> str:
    return f"mf-investor-reports/v1/{user_id}/{report_id}.pdf"


def _filename(kind: MfGeneratedReportKind, period_to: date) -> str:
    return f"zynd-{kind.value}-{period_to.isoformat()}.pdf"


def _serialize(row: MfGeneratedReport) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "kind": row.kind.value,
        "status": row.status.value,
        "period_from": row.period_from.isoformat(),
        "period_to": row.period_to.isoformat(),
        "error_message": row.error_message,
        "filename": row.filename,
        "generated_at": row.generated_at.isoformat() if row.generated_at else None,
        "downloadable": row.status == MfGeneratedReportStatus.completed and bool(row.storage_key),
    }


async def list_investor_reports(db: AsyncSession, *, user_id: UUID) -> list[dict[str, Any]]:
    result = await db.execute(
        select(MfGeneratedReport)
        .where(MfGeneratedReport.user_id == user_id)
        .order_by(MfGeneratedReport.generated_at.desc())
    )
    return [_serialize(row) for row in result.scalars().all()]


async def _resolve_mfia(
    db: AsyncSession, *, user_id: UUID
) -> tuple[int | None, str | None]:
    mfia = await get_or_create_mf_investment_account(db, user_id=user_id)
    fp_mfia_id = mfia.fp_mfia_id or await ensure_fp_mfia(db, user_id=user_id, mfia=mfia)
    if not fp_mfia_id:
        return None, None
    old_id = await ensure_mfia_old_id(db, mfia=mfia)
    return old_id, fp_mfia_id


def _folio_csv(holdings_payload: dict[str, Any], folio_payload: dict[str, Any]) -> str:
    numbers: list[str] = []
    seen: set[str] = set()
    for row in parse_holdings_report(holdings_payload):
        number = str(row.get("folio_number") or "").strip()
        if number and number not in seen:
            seen.add(number)
            numbers.append(number)
    data = folio_payload.get("data")
    if isinstance(data, list):
        for item in data:
            if not isinstance(item, dict):
                continue
            number = str(item.get("number") or item.get("folio_number") or "").strip()
            if number and number not in seen:
                seen.add(number)
                numbers.append(number)
    return ",".join(numbers)


async def _load_elss_isins(db: AsyncSession) -> set[str]:
    result = await db.execute(
        select(MutualFund.isin_growth, MutualFund.isin_div_reinvestment, MutualFund.sebi_category).where(
            or_(
                MutualFund.sebi_category.ilike("%elss%"),
                MutualFund.sebi_category.ilike("%tax%"),
            )
        )
    )
    isins: set[str] = set()
    for growth, reinvest, _category in result.all():
        if growth:
            isins.add(str(growth).upper())
        if reinvest:
            isins.add(str(reinvest).upper())
    return isins


async def _load_statement_transactions(
    *,
    folios: str,
    fp_mfia_id: str,
    period_from: date,
    period_to: date,
) -> dict[str, Any]:
    if not folios:
        return {"data": []}
    span = period_to - period_from
    start = period_from
    if span.days > 365:
        start = period_to - timedelta(days=365)
    return await list_mf_transactions(
        folios=folios,
        fp_mfia_id=fp_mfia_id,
        types=_TXN_TYPES,
        from_date=start.isoformat(),
        to_date=period_to.isoformat(),
    )


async def _build_document(
    db: AsyncSession,
    *,
    user: User,
    kind: MfGeneratedReportKind,
    period_from: date,
    period_to: date,
    generated_at: datetime,
) -> InvestorReportDocument:
    old_id, fp_mfia_id = await _resolve_mfia(db, user_id=user.id)
    holdings_payload: dict[str, Any] = {"folios": []}
    folio_payload: dict[str, Any] = {"data": []}
    txn_payload: dict[str, Any] = {"data": []}
    gains_payload: dict[str, Any] = {"data": {"rows": [], "columns": []}}
    returns_payload: dict[str, Any] = {"data": {"rows": [], "columns": []}}

    if old_id is not None and fp_mfia_id:
        holdings_payload = await get_holdings_report(
            investment_account_id=old_id,
            as_on=period_to.isoformat(),
        )
        folio_payload = await list_mf_folios(fp_mfia_id=fp_mfia_id)
        try:
            returns_payload = await get_investment_account_wise_returns(
                fp_mfia_id=fp_mfia_id,
                traded_on_to=period_to.isoformat(),
            )
        except FpClientError:
            logger.warning("Account-wise returns unavailable for investor report user=%s", user.id)
        folios = _folio_csv(holdings_payload, folio_payload)
        txn_payload = await _load_statement_transactions(
            folios=folios,
            fp_mfia_id=fp_mfia_id,
            period_from=period_from,
            period_to=period_to,
        )
        if kind in {MfGeneratedReportKind.capital_gains, MfGeneratedReportKind.tax}:
            gains_payload = await get_capital_gains_report(
                fp_mfia_id=fp_mfia_id,
                traded_on_from=period_from.isoformat(),
                traded_on_to=period_to.isoformat(),
            )

    transactions = parse_statement_transactions(txn_payload)
    gains_rows = parse_capital_gains_report(gains_payload)

    returns = parse_investment_account_returns(returns_payload)
    summary = summary_section(returns, holdings_payload)

    if kind == MfGeneratedReportKind.account_statement:
        sections = (
            summary,
            holdings_section(holdings_payload),
            transactions_section(transactions),
            folios_section(folio_payload),
        )
    elif kind == MfGeneratedReportKind.capital_gains:
        sections = (summary, capital_gains_section(gains_rows))
    else:
        elss_isins = await _load_elss_isins(db)
        sections = (
            summary,
            capital_gains_section(gains_rows, heading="Capital gains"),
            transactions_section(elss_purchase_rows(transactions, elss_isins=elss_isins), heading="ELSS purchases"),
            transactions_section(dividend_rows(transactions), heading="Dividends"),
        )

    return InvestorReportDocument(
        title=REPORT_TITLES[kind],
        period_label=period_label(period_from, period_to),
        investor_name=_investor_name(user),
        masked_pan=await _masked_pan(db, user_id=user.id),
        generated_at=generated_at,
        zynd_id=user.client_id,
        email=user.email,
        mobile=user.phone,
        sections=sections,
    )


async def generate_investor_report(
    db: AsyncSession,
    *,
    user: User,
    kind: MfGeneratedReportKind,
    settings: Settings | None = None,
) -> dict[str, Any]:
    if kind not in REPORT_TITLES:
        raise InvestorReportError("unsupported_report_kind", "This report type cannot be generated.")

    today = datetime.now(timezone.utc).date()
    period_from, period_to = current_indian_fy(today)
    generated_at = datetime.now(timezone.utc)
    row = MfGeneratedReport(
        id=uuid.uuid4(),
        user_id=user.id,
        kind=kind,
        period_from=period_from,
        period_to=period_to,
        status=MfGeneratedReportStatus.pending,
        generated_at=generated_at,
        filename=_filename(kind, period_to),
    )
    db.add(row)
    await db.flush()

    settings = settings or get_settings()
    storage = get_document_storage(settings)
    bucket = settings.pii_documents_bucket
    storage_key = _storage_key(user_id=user.id, report_id=row.id)

    try:
        document = await _build_document(
            db,
            user=user,
            kind=kind,
            period_from=period_from,
            period_to=period_to,
            generated_at=generated_at,
        )
        pdf_bytes = generate_investor_report_pdf(document)
        storage.write_bytes(
            bucket=bucket,
            storage_key=storage_key,
            content=pdf_bytes,
            encrypt_at_rest=settings.documents_local_encrypt_pii,
        )
        row.status = MfGeneratedReportStatus.completed
        row.storage_key = storage_key
        row.error_message = None
    except FpClientError as exc:
        logger.exception("Finprim report fetch failed for kind=%s user=%s", kind.value, user.id)
        row.status = MfGeneratedReportStatus.failed
        row.error_message = exc.message
        row.storage_key = None
    except Exception as exc:
        logger.exception("Investor report generation failed for kind=%s user=%s", kind.value, user.id)
        row.status = MfGeneratedReportStatus.failed
        row.error_message = str(exc) or "Could not generate this report."
        row.storage_key = None

    await db.flush()
    return _serialize(row)


async def download_investor_report(
    db: AsyncSession,
    *,
    user_id: UUID,
    report_id: UUID,
    settings: Settings | None = None,
) -> tuple[bytes, str]:
    row = await db.get(MfGeneratedReport, report_id)
    if row is None or row.user_id != user_id:
        raise InvestorReportError("report_not_found", "Report not found.", status_code=404)
    if row.status != MfGeneratedReportStatus.completed or not row.storage_key:
        raise InvestorReportError("report_not_ready", "This report is not available to download.", status_code=409)

    settings = settings or get_settings()
    storage = get_document_storage(settings)
    if not storage.exists(bucket=settings.pii_documents_bucket, storage_key=row.storage_key):
        raise InvestorReportError("report_file_missing", "Report file is no longer available.", status_code=404)

    pdf_bytes = storage.read_bytes(
        bucket=settings.pii_documents_bucket,
        storage_key=row.storage_key,
        decrypt_at_rest=settings.documents_local_encrypt_pii,
    )
    return pdf_bytes, row.filename or _filename(row.kind, row.period_to)
