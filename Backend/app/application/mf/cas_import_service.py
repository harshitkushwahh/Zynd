from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.mf_order_errors import MfCasError
from app.application.mf.public_asset_service import resolve_amc_logo_url
from app.core.config import get_settings
from app.infrastructure.mf.mf_central_client import MfCentralClientError, fetch_cas_payload, request_cas_import
from app.infrastructure.persistence.mf_models import FundAmc, MutualFund
from app.infrastructure.persistence.mf_transaction_models import (
    MfCasImport,
    MfCasImportStatus,
    MfExternalHolding,
)
from app.infrastructure.persistence.models import KycJourneyState, User

logger = logging.getLogger(__name__)


def _parse_holdings(payload: dict) -> list[dict]:
    rows = payload.get("holdings")
    if isinstance(rows, list):
        return rows
    data = payload.get("data")
    if isinstance(data, dict) and isinstance(data.get("holdings"), list):
        return data["holdings"]
    schemes = payload.get("schemes")
    if isinstance(schemes, list):
        return schemes
    return []


def _parse_decimal(value) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


async def request_user_cas_import(session: AsyncSession, *, user: User) -> MfCasImport:
    journey = await session.get(KycJourneyState, user.id)
    pan = None
    if journey and journey.pan_draft_json:
        pan = str((journey.pan_draft_json or {}).get("panNumber") or "").upper().strip() or None

    if not pan:
        raise MfCasError(code="pan_missing", message="Complete KYC before importing external holdings")

    mobile = user.phone or ""
    if not mobile:
        raise MfCasError(code="mobile_missing", message="Verified mobile number is required for CAS import")

    try:
        response = await request_cas_import(pan=pan, mobile=mobile, email=user.email)
    except MfCentralClientError as exc:
        raise MfCasError(code="mf_central_unavailable", message=str(exc), status_code=503) from exc

    import_row = MfCasImport(
        user_id=user.id,
        status=MfCasImportStatus.pending,
        external_request_id=str(response.get("request_id") or response.get("id") or uuid.uuid4()),
        metadata_=response,
    )
    session.add(import_row)
    await session.flush()
    return import_row


async def process_cas_import(session: AsyncSession, import_row: MfCasImport) -> dict[str, int]:
    if import_row.status in {MfCasImportStatus.succeeded, MfCasImportStatus.failed}:
        return {"skipped": 1}

    import_row.status = MfCasImportStatus.processing
    await session.flush()

    try:
        payload = await fetch_cas_payload(external_request_id=import_row.external_request_id or "")
        holdings = _parse_holdings(payload)
        isin_to_fund_id = {
            row[0]: row[1]
            for row in (await session.execute(select(MutualFund.isin_growth, MutualFund.id))).all()
        }

        await session.execute(delete(MfExternalHolding).where(MfExternalHolding.cas_import_id == import_row.id))
        inserted = 0
        for item in holdings:
            isin = str(item.get("isin") or item.get("ISIN") or "").upper()
            if not isin:
                continue
            units = _parse_decimal(item.get("units") or item.get("closingBalance"))
            if units is None:
                continue
            holding = MfExternalHolding(
                user_id=import_row.user_id,
                cas_import_id=import_row.id,
                isin=isin,
                scheme_name=str(item.get("scheme_name") or item.get("schemeName") or item.get("name") or isin),
                folio_number=str(item.get("folio") or item.get("folio_number") or item.get("folioNo") or ""),
                units=units,
                nav_value=_parse_decimal(item.get("nav") or item.get("nav_value")),
                market_value_inr=_parse_decimal(item.get("market_value") or item.get("value")),
                as_of_date=_parse_date(item.get("as_of") or item.get("asOfDate")),
                amc_name=item.get("amc_name") or item.get("amcName"),
                matched_fund_id=isin_to_fund_id.get(isin),
            )
            session.add(holding)
            inserted += 1

        import_row.status = MfCasImportStatus.succeeded
        import_row.holdings_count = inserted
        import_row.completed_at = datetime.now(timezone.utc)
        return {"inserted": inserted}
    except Exception as exc:
        logger.exception("CAS import failed id=%s", import_row.id)
        import_row.status = MfCasImportStatus.failed
        import_row.failure_reason = str(exc)
        import_row.completed_at = datetime.now(timezone.utc)
        raise


def _parse_date(raw) -> date | None:
    if not raw:
        return None
    if isinstance(raw, date):
        return raw
    try:
        return date.fromisoformat(str(raw)[:10])
    except ValueError:
        return None


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
            "as_of_date": holding.as_of_date.isoformat() if holding.as_of_date else None,
            "amc_name": holding.amc_name,
            "amc_logo_url": resolve_amc_logo_url(logo_url, slug, settings) if slug else None,
            "source": holding.source,
        }
        for holding, matched_name, logo_url, slug in rows
    ]
