from __future__ import annotations

import logging

from sqlalchemy import case, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.ingestion_run_service import begin_ingestion_run, finish_ingestion_run, has_running_job
from app.application.mf.invest_catalog_invalidation import notify_invest_catalog_changed
from app.application.mf.investment_constraints import extract_investment_constraints_from_scheme
from app.application.mf.scheme_row_normalizer import extract_min_amounts_from_scheme
from app.core.config import get_settings
from app.infrastructure.mf.fp_oms_client import get_fund_scheme_by_isin
from app.infrastructure.persistence.mf_models import IngestionRunStatus, MutualFund

logger = logging.getLogger(__name__)


async def run_scheme_min_amounts_backfill(
    session: AsyncSession,
    *,
    triggered_by: str = "SCHEDULER",
    limit: int | None = None,
    only_missing: bool = True,
) -> dict[str, int | str]:
    settings = get_settings()
    if not settings.zynd_mf_scheme_min_amounts_backfill_enabled:
        return {"skipped": 1, "reason": "scheme_min_amounts_backfill_disabled"}
    if not settings.resolved_fp_enabled:
        return {"skipped": 1, "reason": "fp_not_configured"}

    if await has_running_job(session, "scheme-min-amounts-backfill"):
        return {"skipped": 1, "reason": "already_running"}

    batch_size = limit or settings.zynd_mf_scheme_min_amounts_backfill_batch_size
    run = await begin_ingestion_run(session, job_name="scheme-min-amounts-backfill", triggered_by=triggered_by)
    processed = updated = skipped = failed = 0

    try:
        query = select(MutualFund).where(MutualFund.is_active.is_(True))
        if only_missing:
            query = query.where(
                or_(
                    MutualFund.min_sip_amount.is_(None),
                    MutualFund.min_lumpsum_amount.is_(None),
                    MutualFund.investment_constraints.is_(None),
                )
            )
        funds = (
            await session.scalars(
                query.order_by(
                    case((MutualFund.investment_constraints.is_(None), 0), else_=1),
                    MutualFund.id,
                ).limit(batch_size)
            )
        ).all()

        for fund in funds:
            processed += 1
            try:
                cybrilla_raw = await get_fund_scheme_by_isin(fund.isin_growth)
            except Exception as exc:
                failed += 1
                logger.debug("Cybrilla min-amount fetch failed isin=%s: %s", fund.isin_growth, exc)
                continue

            amounts = extract_min_amounts_from_scheme(cybrilla_raw)
            constraints = extract_investment_constraints_from_scheme(cybrilla_raw)
            changed = False
            if amounts["min_sip_amount"] is not None and fund.min_sip_amount != amounts["min_sip_amount"]:
                fund.min_sip_amount = amounts["min_sip_amount"]
                changed = True
            if amounts["min_lumpsum_amount"] is not None and fund.min_lumpsum_amount != amounts["min_lumpsum_amount"]:
                fund.min_lumpsum_amount = amounts["min_lumpsum_amount"]
                changed = True
            if constraints is not None and fund.investment_constraints != constraints:
                fund.investment_constraints = constraints
                changed = True

            if changed:
                updated += 1
            else:
                skipped += 1

        status = IngestionRunStatus.succeeded if updated else IngestionRunStatus.partial
        if processed and not updated and failed == processed:
            status = IngestionRunStatus.failed

        await finish_ingestion_run(
            session,
            run,
            status=status,
            records_processed=processed,
            records_inserted=updated,
            records_skipped=skipped,
            metadata={"failed": failed, "only_missing": only_missing, "batch_size": batch_size},
            error_message=None if updated else "No investment constraints or min amounts updated",
        )
        if updated:
            await notify_invest_catalog_changed(session, refresh_search_vectors=False)
        return {
            "processed": processed,
            "updated": updated,
            "skipped": skipped,
            "failed": failed,
            "run_uuid": str(run.run_uuid),
        }
    except Exception as exc:
        logger.exception("Scheme min amounts backfill failed")
        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.failed,
            records_processed=processed,
            records_inserted=updated,
            records_skipped=skipped,
            error_message=str(exc),
        )
        raise
