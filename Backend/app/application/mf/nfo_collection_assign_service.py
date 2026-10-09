from __future__ import annotations

import logging

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.ingestion_run_service import begin_ingestion_run, finish_ingestion_run, has_running_job
from app.application.mf.invest_catalog_invalidation import notify_invest_catalog_changed
from app.application.mf.nfo_detection_service import NFO_CATEGORY_SLUG, should_assign_nfo_category
from app.core.config import get_settings
from app.infrastructure.persistence.mf_models import (
    Category,
    CategoryKind,
    IngestionRunStatus,
    NfoOffer,
    ProductCategory,
)

logger = logging.getLogger(__name__)


async def run_nfo_collection_assign_sync(
    session: AsyncSession,
    *,
    triggered_by: str = "SCHEDULER",
) -> dict[str, int | str]:
    settings = get_settings()
    if not settings.zynd_nfo_ingestion_enabled:
        return {"skipped": 1, "reason": "nfo_disabled"}
    if await has_running_job(session, "nfo-collection-assign-sync"):
        return {"skipped": 1, "reason": "already_running"}

    run = await begin_ingestion_run(session, job_name="nfo-collection-assign-sync", triggered_by=triggered_by)
    linked = 0
    try:
        category = await session.scalar(
            select(Category).where(Category.slug == NFO_CATEGORY_SLUG)
        )
        if category is None:
            category = Category(
                slug=NFO_CATEGORY_SLUG,
                name="NFO",
                display_order=90,
                is_visible=True,
                min_funds_to_show=1,
                category_kind=CategoryKind.browse,
            )
            session.add(category)
            await session.flush()

        delete_result = await session.execute(
            delete(ProductCategory).where(ProductCategory.category_id == category.id)
        )
        removed = int(delete_result.rowcount or 0)

        offers = list(await session.scalars(select(NfoOffer)))
        position = 0
        for offer in offers:
            if not should_assign_nfo_category(offer.status, hidden=offer.is_hidden):
                continue
            position += 1
            session.add(
                ProductCategory(
                    product_id=offer.product_id,
                    category_id=category.id,
                    display_order=position,
                    is_featured=offer.is_featured,
                )
            )
            linked += 1

        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.succeeded,
            records_processed=len(offers),
            records_inserted=linked,
            records_skipped=removed,
        )
        await notify_invest_catalog_changed(session, refresh_search_vectors=False)
        return {"processed": len(offers), "linked": linked, "removed": removed}
    except Exception:
        logger.exception("nfo-collection-assign-sync failed")
        await finish_ingestion_run(session, run, status=IngestionRunStatus.failed)
        raise
