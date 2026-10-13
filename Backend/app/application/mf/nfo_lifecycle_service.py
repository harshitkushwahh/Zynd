from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.ingestion_run_service import begin_ingestion_run, finish_ingestion_run, has_running_job
from app.application.mf.invest_catalog_invalidation import notify_invest_catalog_changed
from app.application.mf.nfo_calendar_service import (
    calendar_status_for_window,
    extract_nfo_dates_from_scheme,
    fetch_nfo_calendar_windows,
    match_nfo_calendar_window,
)
from app.application.mf.nfo_dates import today_ist
from app.application.mf.nfo_detection_service import NfoSignals, classify_nfo_status, name_looks_like_nfo
from app.core.config import get_settings
from app.infrastructure.persistence.mf_models import (
    IngestionRunStatus,
    MutualFund,
    NfoOffer,
    NfoOfferStatus,
    Product,
    ProductLifecycleStatus,
    SchemeNav,
)

logger = logging.getLogger(__name__)

_INVEST_STATUSES = frozenset({NfoOfferStatus.upcoming, NfoOfferStatus.open})


def _apply_status_timestamps(
    offer: NfoOffer,
    *,
    previous: NfoOfferStatus | None,
    new_status: NfoOfferStatus,
    today,
) -> None:
    if new_status in _INVEST_STATUSES and offer.first_listed_at is None:
        offer.first_listed_at = today
    if new_status == NfoOfferStatus.closed and previous != NfoOfferStatus.closed:
        offer.subscription_closed_at = today
    if new_status == NfoOfferStatus.allotted and offer.graduated_at is None:
        offer.graduated_at = today


def _finalize_status_for_nav(
    status: NfoOfferStatus | None,
    *,
    nav_count: int,
    allotted_nav_min: int,
    close_date,
    today,
) -> NfoOfferStatus | None:
    if status is None:
        return None
    if status == NfoOfferStatus.open and close_date and today > close_date:
        status = NfoOfferStatus.closed
    if nav_count >= allotted_nav_min:
        if status == NfoOfferStatus.closed:
            status = NfoOfferStatus.allotted
        elif status == NfoOfferStatus.open and close_date and today > close_date:
            status = NfoOfferStatus.allotted
    return status


async def run_nfo_lifecycle_sync(
    session: AsyncSession,
    *,
    triggered_by: str = "SCHEDULER",
) -> dict[str, int | str]:
    settings = get_settings()
    if not settings.zynd_nfo_ingestion_enabled:
        return {"skipped": 1, "reason": "nfo_disabled"}
    if await has_running_job(session, "nfo-lifecycle-sync"):
        return {"skipped": 1, "reason": "already_running"}

    run = await begin_ingestion_run(session, job_name="nfo-lifecycle-sync", triggered_by=triggered_by)
    upserted = skipped = processed = graduated = 0
    logger.info("nfo-lifecycle-sync started run=%s triggered_by=%s", run.run_uuid, triggered_by)
    try:
        rows = (
            await session.execute(
                select(MutualFund, Product, func.count(SchemeNav.id))
                .join(Product, Product.id == MutualFund.product_id)
                .outerjoin(SchemeNav, SchemeNav.fund_id == MutualFund.id)
                .where(
                    MutualFund.product_id.is_not(None),
                    Product.lifecycle_status == ProductLifecycleStatus.active,
                )
                .group_by(MutualFund.id, Product.id)
            )
        ).all()

        now = datetime.now(timezone.utc)
        today = today_ist()
        calendar_windows = await fetch_nfo_calendar_windows()
        existing = {
            offer.product_id: offer
            for offer in (await session.scalars(select(NfoOffer))).all()
        }

        for fund, product, nav_count in rows:
            processed += 1
            scheme_name = fund.scheme_name or product.name
            age_days = (now - product.created_at).days if product.created_at else None
            window = match_nfo_calendar_window(scheme_name, calendar_windows)
            scheme_dates = extract_nfo_dates_from_scheme(fund.investment_constraints)
            status: NfoOfferStatus | None = None
            source = "HEURISTIC"
            if window:
                mapped = calendar_status_for_window(window, today)
                if mapped:
                    status = NfoOfferStatus(mapped)
                    source = "AMFI"
            if status is None:
                status = classify_nfo_status(
                    NfoSignals(
                        scheme_name=scheme_name,
                        purchase_allowed=bool(fund.fp_oms_purchase_allowed),
                        nav_row_count=int(nav_count or 0),
                        product_age_days=age_days,
                        shallow_nav_max=settings.zynd_nfo_shallow_nav_max,
                        max_age_days=settings.zynd_nfo_max_age_days,
                        allotted_nav_min=settings.zynd_nfo_allotted_nav_min,
                    )
                )
                if status is not None and not name_looks_like_nfo(scheme_name) and window is None:
                    status = None

            close_date = window.close_date if window else scheme_dates["close_date"]
            status = _finalize_status_for_nav(
                status,
                nav_count=int(nav_count or 0),
                allotted_nav_min=settings.zynd_nfo_allotted_nav_min,
                close_date=close_date,
                today=today,
            )

            offer = existing.get(product.id)
            if status is None:
                if offer is not None and not offer.admin_override:
                    if offer.first_listed_at or offer.status in {
                        NfoOfferStatus.closed,
                        NfoOfferStatus.allotted,
                    }:
                        previous = offer.status
                        offer.status = NfoOfferStatus.allotted
                        _apply_status_timestamps(
                            offer,
                            previous=previous,
                            new_status=NfoOfferStatus.allotted,
                            today=today,
                        )
                        graduated += 1
                        upserted += 1
                    else:
                        await session.delete(offer)
                        existing.pop(product.id, None)
                    skipped += 1
                continue

            if offer is None:
                offer = NfoOffer(
                    product_id=product.id,
                    mutual_fund_id=fund.id,
                    status=status,
                    source=source,
                )
                session.add(offer)
                existing[product.id] = offer
                _apply_status_timestamps(offer, previous=None, new_status=status, today=today)
                upserted += 1
            elif offer.admin_override:
                skipped += 1
                continue
            else:
                previous = offer.status
                offer.status = status
                offer.mutual_fund_id = fund.id
                if offer.source != "ADMIN":
                    offer.source = source
                _apply_status_timestamps(offer, previous=previous, new_status=status, today=today)
                upserted += 1

            if not offer.admin_override:
                open_date = window.open_date if window else scheme_dates["open_date"]
                close_date = window.close_date if window else scheme_dates["close_date"]
                allotment_date = window.allotment_date if window else scheme_dates["allotment_date"]
                if open_date:
                    offer.subscription_open_date = open_date
                if close_date:
                    offer.subscription_close_date = close_date
                if allotment_date:
                    offer.allotment_date = allotment_date

        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.succeeded,
            records_processed=processed,
            records_inserted=upserted,
            records_skipped=skipped,
            metadata={"upserted": upserted, "graduated": graduated, "removed_or_skipped": skipped},
        )
        await notify_invest_catalog_changed(session, refresh_search_vectors=False)
        logger.info(
            "nfo-lifecycle-sync succeeded run=%s processed=%s upserted=%s skipped=%s graduated=%s",
            run.run_uuid,
            processed,
            upserted,
            skipped,
            graduated,
        )
        return {
            "processed": processed,
            "upserted": upserted,
            "graduated": graduated,
            "removed_or_skipped": skipped,
            "run_uuid": str(run.run_uuid),
        }
    except Exception:
        logger.exception("nfo-lifecycle-sync failed")
        await finish_ingestion_run(session, run, status=IngestionRunStatus.failed)
        raise
