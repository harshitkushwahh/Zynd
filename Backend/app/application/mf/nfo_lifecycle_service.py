from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.ingestion_run_service import begin_ingestion_run, finish_ingestion_run, has_running_job
from app.application.mf.invest_catalog_invalidation import notify_invest_catalog_changed
from app.application.mf.nfo_detection_service import NfoSignals, classify_nfo_status
from app.core.config import get_settings
from app.infrastructure.persistence.mf_models import (
    IngestionRunStatus,
    MutualFund,
    NfoOffer,
    Product,
    ProductLifecycleStatus,
    SchemeNav,
)

logger = logging.getLogger(__name__)


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
    upserted = skipped = processed = 0
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
        existing = {
            offer.product_id: offer
            for offer in (await session.scalars(select(NfoOffer))).all()
        }

        for fund, product, nav_count in rows:
            processed += 1
            age_days = (now - product.created_at).days if product.created_at else None
            status = classify_nfo_status(
                NfoSignals(
                    scheme_name=fund.scheme_name or product.name,
                    purchase_allowed=bool(fund.fp_oms_purchase_allowed),
                    nav_row_count=int(nav_count or 0),
                    product_age_days=age_days,
                    shallow_nav_max=settings.zynd_nfo_shallow_nav_max,
                    max_age_days=settings.zynd_nfo_max_age_days,
                    allotted_nav_min=settings.zynd_nfo_allotted_nav_min,
                )
            )
            offer = existing.get(product.id)
            if status is None:
                if offer is not None and not offer.admin_override:
                    await session.delete(offer)
                    skipped += 1
                continue
            if offer is None:
                offer = NfoOffer(
                    product_id=product.id,
                    mutual_fund_id=fund.id,
                    status=status,
                    source="HEURISTIC",
                )
                session.add(offer)
                upserted += 1
                continue
            if offer.admin_override:
                skipped += 1
                continue
            offer.status = status
            offer.mutual_fund_id = fund.id
            if offer.source != "ADMIN":
                offer.source = "HEURISTIC"
            upserted += 1

        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.succeeded,
            records_processed=processed,
            records_inserted=upserted,
            records_skipped=skipped,
        )
        await notify_invest_catalog_changed(session, refresh_search_vectors=False)
        return {"processed": processed, "upserted": upserted, "removed_or_skipped": skipped}
    except Exception:
        logger.exception("nfo-lifecycle-sync failed")
        await finish_ingestion_run(session, run, status=IngestionRunStatus.failed)
        raise
