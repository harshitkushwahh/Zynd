from __future__ import annotations

import logging
import re
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.mf_order_errors import MfCasError
from app.application.mf.public_asset_service import resolve_amc_logo_url
from app.core.config import get_settings
from app.infrastructure.mf.mf_central_client import MfCentralClientError, create_cas_request, validate_cas_qr
from app.infrastructure.persistence.mf_models import FundAmc, MutualFund
from app.infrastructure.persistence.mf_transaction_models import (
    MfCasImport,
    MfCasImportStatus,
    MfExternalHolding,
    MfOrder,
    MfOrderStatus,
    MfOrderType,
)
from app.infrastructure.persistence.models import KycJourneyState, User

logger = logging.getLogger(__name__)


async def user_has_allotted_platform_investment(session: AsyncSession, user_id: uuid.UUID) -> bool:
    """True after a Zynd lumpsum or SIP has allotted units at least once."""
    row = await session.scalar(
        select(MfOrder.id)
        .where(
            MfOrder.user_id == user_id,
            MfOrder.order_type.in_((MfOrderType.lumpsum, MfOrderType.sip)),
            MfOrder.status == MfOrderStatus.succeeded,
        )
        .limit(1)
    )
    return row is not None


_MONTHS = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}


def normalize_cas_mobile(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if digits.startswith("91") and len(digits) == 12:
        return f"+{digits}"
    if len(digits) == 10:
        return f"+91{digits}"
    if digits:
        return f"+{digits}"
    return ""


def parse_cas_date(raw) -> date | None:
    if not raw:
        return None
    if isinstance(raw, datetime):
        return raw.date()
    if isinstance(raw, date):
        return raw
    text = str(raw).strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        pass
    parts = text.split("-")
    if len(parts) != 3:
        return None
    month = _MONTHS.get(parts[1][:3].lower())
    if month is None:
        return None
    try:
        return date(int(parts[2]), month, int(parts[0]))
    except ValueError:
        return None


def parse_cas_schemes(payload: dict) -> list[dict]:
    blocks = payload.get("data")
    rows: list[dict] = []
    if isinstance(blocks, list):
        for block in blocks:
            if not isinstance(block, dict):
                continue
            schemes = block.get("schemes")
            if isinstance(schemes, list):
                rows.extend(_scheme_row(item) for item in schemes if isinstance(item, dict))
            summary = block.get("dtSummary")
            if isinstance(summary, list):
                rows.extend(_scheme_row(item) for item in summary if isinstance(item, dict))
    if rows:
        return rows
    legacy = payload.get("holdings") or payload.get("schemes")
    if isinstance(legacy, list):
        return [_scheme_row(item) for item in legacy if isinstance(item, dict)]
    data = payload.get("data")
    if isinstance(data, dict) and isinstance(data.get("holdings"), list):
        return [_scheme_row(item) for item in data["holdings"] if isinstance(item, dict)]
    return []


def _scheme_row(item: dict) -> dict:
    return {
        "isin": str(item.get("isin") or item.get("ISIN") or "").upper().strip(),
        "scheme_name": str(item.get("schemeName") or item.get("scheme_name") or item.get("name") or "").strip(),
        "folio_number": str(item.get("folio") or item.get("folio_number") or item.get("folioNo") or "").strip(),
        "units": item.get("closingBalance") if item.get("closingBalance") is not None else item.get("availableUnits") or item.get("units"),
        "nav_value": item.get("nav") if item.get("nav") is not None else item.get("nav_value"),
        "market_value_inr": item.get("currentMktValue")
        if item.get("currentMktValue") is not None
        else item.get("marketValue")
        if item.get("marketValue") is not None
        else item.get("market_value")
        if item.get("market_value") is not None
        else item.get("value"),
        "cost_value_inr": item.get("costValue") if item.get("costValue") is not None else item.get("cost_value"),
        "as_of_date": item.get("navDate") or item.get("lastNavDate") or item.get("as_of") or item.get("asOfDate"),
        "amc_name": item.get("amcName") or item.get("amc_name"),
    }


def _parse_decimal(value) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _strip_qr_prefix(qr_code: str) -> str:
    text = qr_code.strip()
    if "," in text and text.lower().startswith("data:"):
        return text.split(",", 1)[1].strip()
    return text


async def request_user_cas_import(session: AsyncSession, *, user: User) -> MfCasImport:
    journey = await session.get(KycJourneyState, user.id)
    pan = None
    if journey and journey.pan_draft_json:
        pan = str((journey.pan_draft_json or {}).get("panNumber") or "").upper().strip() or None
    if not pan:
        raise MfCasError(code="pan_missing", message="Complete KYC before importing external holdings")

    if not await user_has_allotted_platform_investment(session, user.id):
        raise MfCasError(
            code="investment_required",
            message="Import external funds after your first Zynd investment is allotted.",
            status_code=403,
        )

    mobile = normalize_cas_mobile(user.phone or "")
    if not mobile:
        raise MfCasError(code="mobile_missing", message="Verified mobile number is required for CAS import")

    settings = get_settings()
    import_row = MfCasImport(
        user_id=user.id,
        status=MfCasImportStatus.pending,
        metadata_={},
    )
    session.add(import_row)
    await session.flush()

    try:
        started = await create_cas_request(
            client_ref_no=str(import_row.id),
            pan=pan,
            mobile=mobile,
            redirect_url=settings.resolved_mf_cas_callback_url,
        )
    except MfCentralClientError as exc:
        raise MfCasError(code="mf_central_unavailable", message=str(exc), status_code=503) from exc

    import_row.external_request_id = started["req_id"]
    import_row.metadata_ = {
        "req_id": started["req_id"],
        "client_ref_no": started["client_ref_no"],
        "otp_ref": started["otp_ref"],
        "launch_url": started["launch_url"],
    }
    await session.flush()
    return import_row


async def validate_user_cas_qr(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    import_id: uuid.UUID,
    qr_code: str,
) -> MfCasImport:
    if not await user_has_allotted_platform_investment(session, user_id):
        raise MfCasError(
            code="investment_required",
            message="Import external funds after your first Zynd investment is allotted.",
            status_code=403,
        )

    import_row = await session.get(MfCasImport, import_id)
    if import_row is None or import_row.user_id != user_id:
        raise MfCasError(code="cas_import_not_found", message="CAS import was not found", status_code=404)
    if import_row.status == MfCasImportStatus.succeeded:
        return import_row
    if import_row.status == MfCasImportStatus.failed:
        raise MfCasError(code="cas_import_closed", message="Start a new CAS import", status_code=409)

    metadata = import_row.metadata_ or {}
    req_id = str(import_row.external_request_id or metadata.get("req_id") or "").strip()
    client_ref_no = str(metadata.get("client_ref_no") or import_row.id)
    qr = _strip_qr_prefix(qr_code)
    if not req_id or not qr:
        raise MfCasError(code="cas_qr_missing", message="Upload the QR code from MF Central")

    import_row.status = MfCasImportStatus.processing
    await session.flush()
    try:
        payload = await validate_cas_qr(req_id=req_id, client_ref_no=client_ref_no, qr_code=qr)
        inserted = await _replace_external_holdings(session, import_row=import_row, payload=payload)
    except MfCentralClientError as exc:
        import_row.status = MfCasImportStatus.pending
        await session.flush()
        raise MfCasError(code="mf_central_unavailable", message=str(exc), status_code=503) from exc
    except Exception as exc:
        logger.exception("CAS QR validation failed id=%s", import_row.id)
        import_row.status = MfCasImportStatus.failed
        import_row.failure_reason = "CAS import failed"
        import_row.completed_at = datetime.now(timezone.utc)
        await session.flush()
        raise MfCasError(code="cas_import_failed", message="CAS import failed", status_code=502) from exc

    import_row.status = MfCasImportStatus.succeeded
    import_row.holdings_count = inserted
    import_row.failure_reason = None
    import_row.completed_at = datetime.now(timezone.utc)
    import_row.metadata_ = {
        "req_id": req_id,
        "client_ref_no": client_ref_no,
        "scheme_count": inserted,
    }
    await session.flush()
    return import_row


async def _replace_external_holdings(session: AsyncSession, *, import_row: MfCasImport, payload: dict) -> int:
    schemes = parse_cas_schemes(payload)
    isin_to_fund_id = {
        row[0]: row[1]
        for row in (await session.execute(select(MutualFund.isin_growth, MutualFund.id))).all()
        if row[0]
    }
    await session.execute(
        delete(MfExternalHolding).where(
            MfExternalHolding.user_id == import_row.user_id,
            MfExternalHolding.source == "MF_CENTRAL",
        )
    )
    inserted = 0
    seen: set[tuple[str, str]] = set()
    for item in schemes:
        isin = item["isin"]
        folio = item["folio_number"]
        if not isin or not folio:
            continue
        key = (isin, folio)
        if key in seen:
            continue
        units = _parse_decimal(item["units"])
        if units is None:
            continue
        seen.add(key)
        session.add(
            MfExternalHolding(
                user_id=import_row.user_id,
                cas_import_id=import_row.id,
                isin=isin,
                scheme_name=item["scheme_name"] or isin,
                folio_number=folio,
                units=units,
                nav_value=_parse_decimal(item["nav_value"]),
                market_value_inr=_parse_decimal(item["market_value_inr"]),
                cost_value_inr=_parse_decimal(item["cost_value_inr"]),
                as_of_date=parse_cas_date(item["as_of_date"]),
                amc_name=item["amc_name"],
                matched_fund_id=isin_to_fund_id.get(isin),
                source="MF_CENTRAL",
            )
        )
        inserted += 1
    await session.flush()
    return inserted


async def expire_stale_cas_imports(session: AsyncSession) -> dict[str, int]:
    settings = get_settings()
    cutoff = datetime.now(timezone.utc) - timedelta(hours=max(settings.zynd_mf_cas_consent_timeout_hours, 1))
    rows = list(
        (
            await session.execute(
                select(MfCasImport)
                .where(
                    MfCasImport.status.in_((MfCasImportStatus.pending, MfCasImportStatus.processing)),
                    MfCasImport.requested_at < cutoff,
                )
                .order_by(MfCasImport.requested_at)
                .limit(settings.zynd_mf_cas_worker_batch_size)
            )
        ).scalars()
    )
    for row in rows:
        row.status = MfCasImportStatus.failed
        row.failure_reason = "consent_expired"
        row.completed_at = datetime.now(timezone.utc)
    await session.flush()
    return {"expired": len(rows)}


async def list_user_cas_imports(session: AsyncSession, *, user_id: uuid.UUID, limit: int = 20) -> list[MfCasImport]:
    result = await session.execute(
        select(MfCasImport)
        .where(MfCasImport.user_id == user_id)
        .order_by(MfCasImport.requested_at.desc())
        .limit(limit)
    )
    return list(result.scalars())


async def list_user_external_holdings(session: AsyncSession, *, user_id: uuid.UUID) -> list[dict]:
    rows = (
        await session.execute(
            select(MfExternalHolding, MutualFund.scheme_name, FundAmc.logo_url, FundAmc.slug)
            .outerjoin(MutualFund, MutualFund.id == MfExternalHolding.matched_fund_id)
            .outerjoin(FundAmc, FundAmc.id == MutualFund.amc_id)
            .where(MfExternalHolding.user_id == user_id)
            .order_by(MfExternalHolding.scheme_name)
        )
    ).all()
    settings = get_settings()
    return [
        {
            "isin": holding.isin,
            "scheme_name": holding.scheme_name,
            "matched_scheme_name": matched_name,
            "folio_number": holding.folio_number,
            "units": float(holding.units),
            "nav_value": float(holding.nav_value) if holding.nav_value is not None else None,
            "market_value_inr": float(holding.market_value_inr) if holding.market_value_inr is not None else None,
            "cost_value_inr": float(holding.cost_value_inr) if holding.cost_value_inr is not None else None,
            "as_of_date": holding.as_of_date.isoformat() if holding.as_of_date else None,
            "amc_name": holding.amc_name,
            "amc_logo_url": resolve_amc_logo_url(logo_url, slug, settings) if slug else None,
            "source": holding.source,
        }
        for holding, matched_name, logo_url, slug in rows
    ]
