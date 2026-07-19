from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.ingestion_run_service import begin_ingestion_run, finish_ingestion_run, has_running_job
from app.application.mf.nav_metrics_calculator import compute_metrics_for_history
from app.core.config import get_settings
from app.infrastructure.persistence.mf_models import (
    FundNavMetrics,
    FundReturnCalculatorSnapshot,
    IngestionRunStatus,
    MutualFund,
    SchemeNav,
)

logger = logging.getLogger(__name__)


async def _load_history(session: AsyncSession, fund_id: int) -> list[tuple]:
    rows = await session.execute(
        select(SchemeNav.nav_date, SchemeNav.nav_value)
        .where(SchemeNav.fund_id == fund_id)
        .order_by(SchemeNav.nav_date)
    )
    return [(nav_date, Decimal(str(nav_value))) for nav_date, nav_value in rows.all()]


async def _load_metrics(session: AsyncSession, fund_id: int) -> FundNavMetrics | None:
    return await session.scalar(
        select(FundNavMetrics)
        .where(FundNavMetrics.fund_id == fund_id)
        .order_by(FundNavMetrics.as_of_date.desc())
        .limit(1)
    )


def _build_horizons_from_history(history: list[tuple]) -> tuple[date | None, dict[str, dict]]:
    computed = compute_metrics_for_history(history)
    if not computed:
        return None, {}
    as_of_date, metrics = computed
    horizons: dict[str, dict] = {}
    for key in ("return_3m", "return_6m", "return_1y", "return_3y", "return_5y"):
        horizon_key = key.replace("return_", "")
        pct = metrics.get(key)
        if pct is None:
            continue
        multiplier = float(Decimal("1") + (pct / Decimal("100")))
        horizons[horizon_key] = {"return_pct": float(pct), "multiplier": multiplier}
    return as_of_date, horizons


def _build_horizons_from_metrics(metrics: FundNavMetrics) -> tuple[date, dict[str, dict]]:
    horizons: dict[str, dict] = {}
    mapping = {
        "3m": metrics.return_3m,
        "6m": metrics.return_6m,
        "1y": metrics.return_1y,
        "3y": metrics.return_3y,
        "5y": metrics.return_5y,
    }
    for horizon_key, pct in mapping.items():
        if pct is None:
            continue
        pct_val = Decimal(str(pct))
        multiplier = float(Decimal("1") + (pct_val / Decimal("100")))
        horizons[horizon_key] = {"return_pct": float(pct_val), "multiplier": multiplier}
    return metrics.as_of_date, horizons


async def run_return_calculator_snapshot(
    session: AsyncSession,
    *,
    triggered_by: str = "SCHEDULER",
) -> dict[str, int | str]:
    settings = get_settings()
    if not settings.zynd_mf_return_calculator_enabled:
        return {"skipped": 1, "reason": "return_calculator_disabled"}

    if await has_running_job(session, "return-calculator-snapshot"):
        return {"skipped": 1, "reason": "already_running"}

    run = await begin_ingestion_run(session, job_name="return-calculator-snapshot", triggered_by=triggered_by)
    processed = upserted = skipped = 0

    try:
        fund_ids = [row[0] for row in (await session.execute(select(MutualFund.id))).all()]
        for fund_id in fund_ids:
            processed += 1
            history = await _load_history(session, fund_id)
            as_of_date, horizons = _build_horizons_from_history(history)
            if not horizons:
                metrics = await _load_metrics(session, fund_id)
                if metrics:
                    as_of_date, horizons = _build_horizons_from_metrics(metrics)
            if not horizons or as_of_date is None:
                skipped += 1
                continue

            stmt = (
                insert(FundReturnCalculatorSnapshot)
                .values(fund_id=fund_id, as_of_date=as_of_date, horizons=horizons)
                .on_conflict_do_update(
                    index_elements=["fund_id"],
                    set_={"as_of_date": as_of_date, "horizons": horizons},
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
        from app.application.mf.invest_catalog_invalidation import notify_invest_catalog_changed

        await notify_invest_catalog_changed(session, refresh_search_vectors=False)
        return {"processed": processed, "upserted": upserted, "skipped": skipped, "run_uuid": str(run.run_uuid)}
    except Exception as exc:
        logger.exception("Return calculator snapshot failed")
        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.failed,
            records_processed=processed,
            error_message=str(exc),
        )
        raise
