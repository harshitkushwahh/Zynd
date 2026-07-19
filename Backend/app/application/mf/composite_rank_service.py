from __future__ import annotations

import logging
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.ingestion_run_service import begin_ingestion_run, finish_ingestion_run, has_running_job
from app.application.mf.invest_catalog_invalidation import notify_invest_catalog_changed
from app.core.config import get_settings
from app.infrastructure.persistence.mf_models import (
    Category,
    FundCompositeRank,
    FundNavMetrics,
    IngestionRunStatus,
    MutualFund,
    Product,
    ProductCategory,
    ProductLifecycleStatus,
)

logger = logging.getLogger(__name__)


async def run_composite_rank_compute(
    session: AsyncSession,
    *,
    triggered_by: str = "SCHEDULER",
) -> dict[str, int | str]:
    settings = get_settings()
    if not settings.zynd_mf_metrics_enabled:
        return {"skipped": 1, "reason": "metrics_disabled"}

    if await has_running_job(session, "composite-rank-compute"):
        return {"skipped": 1, "reason": "already_running"}

    run = await begin_ingestion_run(session, job_name="composite-rank-compute", triggered_by=triggered_by)
    processed = ranked = skipped = 0

    try:
        rows = (
            await session.execute(
                select(
                    FundNavMetrics.fund_id,
                    FundNavMetrics.return_3y,
                    ProductCategory.category_id,
                    Category.slug,
                )
                .join(MutualFund, MutualFund.id == FundNavMetrics.fund_id)
                .join(Product, Product.id == MutualFund.product_id)
                .join(ProductCategory, ProductCategory.product_id == Product.id)
                .join(Category, Category.id == ProductCategory.category_id)
                .where(
                    FundNavMetrics.return_3y.is_not(None),
                    Product.lifecycle_status == ProductLifecycleStatus.active,
                )
            )
        ).all()

        by_category: dict[int, list[tuple[int, Decimal]]] = {}
        for fund_id, return_3y, category_id, _slug in rows:
            processed += 1
            if return_3y is None:
                skipped += 1
                continue
            by_category.setdefault(category_id, []).append((fund_id, Decimal(str(return_3y))))

        await session.execute(delete(FundCompositeRank))
        now = datetime.now(timezone.utc)

        for category_id, entries in by_category.items():
            entries.sort(key=lambda item: item[1], reverse=True)
            for position, (fund_id, score) in enumerate(entries, start=1):
                session.add(
                    FundCompositeRank(
                        fund_id=fund_id,
                        category_id=category_id,
                        rank_score=score,
                        rank_position=position,
                        computed_at=now,
                    )
                )
                ranked += 1

        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.succeeded,
            records_processed=processed,
            records_inserted=ranked,
            records_skipped=skipped,
            metadata={"categories": len(by_category)},
        )
        await notify_invest_catalog_changed(session)
        return {
            "processed": processed,
            "ranked": ranked,
            "skipped": skipped,
            "categories": len(by_category),
            "run_uuid": str(run.run_uuid),
        }
    except Exception as exc:
        logger.exception("Composite rank compute failed")
        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.failed,
            records_processed=processed,
            records_inserted=ranked,
            records_skipped=skipped,
            error_message=str(exc),
        )
        raise
