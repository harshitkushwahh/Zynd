from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.ingestion_run_service import begin_ingestion_run, finish_ingestion_run, has_running_job
from app.application.mf.nav_metrics_calculator import compute_metrics_for_history
from app.core.config import get_settings
from app.infrastructure.persistence.mf_models import FundNavMetrics, IngestionRunStatus, MutualFund, SchemeNav

logger = logging.getLogger(__name__)


async def _load_nav_histories(
    session: AsyncSession, fund_ids: list[int]
) -> dict[int, list[tuple]]:
    if not fund_ids:
        return {}
    result = await session.execute(
        select(SchemeNav.fund_id, SchemeNav.nav_date, SchemeNav.nav_value)
        .where(SchemeNav.fund_id.in_(fund_ids))
        .order_by(SchemeNav.fund_id, SchemeNav.nav_date)
    )
    grouped: dict[int, list[tuple]] = defaultdict(list)
    for fund_id, nav_date, nav_value in result.all():
        grouped[fund_id].append((nav_date, Decimal(str(nav_value))))
    return grouped


async def run_nav_metrics_compute(
    session: AsyncSession,
    *,
    triggered_by: str = "SCHEDULER",
) -> dict[str, int | str]:
    settings = get_settings()
    if not settings.zynd_mf_metrics_enabled:
        return {"skipped": 1, "reason": "metrics_disabled"}

    if await has_running_job(session, "nav-metrics-compute"):
        return {"skipped": 1, "reason": "already_running"}

    run = await begin_ingestion_run(session, job_name="nav-metrics-compute", triggered_by=triggered_by)
    processed = upserted = skipped = 0
    batch_size = settings.zynd_mf_metrics_batch_size

    try:
        fund_ids = [
            row[0]
            for row in (
                await session.execute(select(MutualFund.id).where(MutualFund.is_active.is_(True)))
            ).all()
        ]

        for offset in range(0, len(fund_ids), batch_size):
            chunk = fund_ids[offset : offset + batch_size]
            histories = await _load_nav_histories(session, chunk)

            for fund_id in chunk:
                processed += 1
                history = histories.get(fund_id, [])
                computed = compute_metrics_for_history(history)
                if not computed:
                    skipped += 1
                    continue

                as_of_date, metrics = computed
                stmt = (
                    insert(FundNavMetrics)
                    .values(
                        fund_id=fund_id,
                        as_of_date=as_of_date,
                        return_1d=metrics.get("return_1d"),
                        return_1w=metrics.get("return_1w"),
                        return_1m=metrics.get("return_1m"),
                        return_3m=metrics.get("return_3m"),
                        return_6m=metrics.get("return_6m"),
                        return_1y=metrics.get("return_1y"),
                        return_3y=metrics.get("return_3y"),
                        return_5y=metrics.get("return_5y"),
                        computed_at=datetime.now(timezone.utc),
                    )
                    .on_conflict_do_update(
                        index_elements=["fund_id"],
                        set_={
                            "as_of_date": as_of_date,
                            "return_1d": metrics.get("return_1d"),
                            "return_1w": metrics.get("return_1w"),
                            "return_1m": metrics.get("return_1m"),
                            "return_3m": metrics.get("return_3m"),
                            "return_6m": metrics.get("return_6m"),
                            "return_1y": metrics.get("return_1y"),
                            "return_3y": metrics.get("return_3y"),
                            "return_5y": metrics.get("return_5y"),
                            "computed_at": datetime.now(timezone.utc),
                        },
                    )
                )
                await session.execute(stmt)
                upserted += 1

        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.succeeded,
            records_processed=processed,
            records_inserted=upserted,
            records_skipped=skipped,
        )
        return {
            "processed": processed,
            "upserted": upserted,
            "skipped": skipped,
            "run_uuid": str(run.run_uuid),
        }
    except Exception as exc:
        logger.exception("NAV metrics compute failed")
        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.failed,
            records_processed=processed,
            records_inserted=upserted,
            records_skipped=skipped,
            error_message=str(exc),
        )
        raise
