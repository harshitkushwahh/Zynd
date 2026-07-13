from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.ingestion_run_service import begin_ingestion_run, finish_ingestion_run, has_running_job
from app.infrastructure.persistence.mf_models import AmcAumRanking, IngestionRunStatus, MutualFund, SchemeAum

logger = logging.getLogger(__name__)


async def run_amc_aum_rank_compute(
    session: AsyncSession,
    *,
    triggered_by: str = "SCHEDULER",
) -> dict[str, int | str]:
    if await has_running_job(session, "amc-aum-rank-compute"):
        return {"skipped": 1, "reason": "already_running"}

    run = await begin_ingestion_run(session, job_name="amc-aum-rank-compute", triggered_by=triggered_by)
    upserted = 0

    try:
        latest_date = await session.scalar(select(func.max(SchemeAum.as_of_date)))
        if not latest_date:
            await finish_ingestion_run(
                session,
                run,
                status=IngestionRunStatus.partial,
                error_message="No scheme_aums rows",
            )
            return {"skipped": 1, "reason": "no_aum_data"}

        totals = (
            await session.execute(
                select(MutualFund.amc_id, func.sum(SchemeAum.aum_inr).label("total_aum"))
                .join(SchemeAum, SchemeAum.fund_id == MutualFund.id)
                .where(SchemeAum.as_of_date == latest_date)
                .group_by(MutualFund.amc_id)
                .order_by(func.sum(SchemeAum.aum_inr).desc())
            )
        ).all()

        peer_count = len(totals)
        for rank, (amc_id, total_aum) in enumerate(totals, start=1):
            stmt = (
                insert(AmcAumRanking)
                .values(
                    amc_id=amc_id,
                    as_of_date=latest_date,
                    total_aum_inr=Decimal(str(total_aum)),
                    rank_india=rank,
                    peer_count=peer_count,
                    source="AMFI_MONTHLY",
                )
                .on_conflict_do_update(
                    index_elements=["amc_id", "as_of_date"],
                    set_={
                        "total_aum_inr": Decimal(str(total_aum)),
                        "rank_india": rank,
                        "peer_count": peer_count,
                    },
                )
            )
            await session.execute(stmt)
            upserted += 1

        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.succeeded,
            records_processed=peer_count,
            records_inserted=upserted,
            metadata={"as_of_date": str(latest_date)},
        )
        return {"upserted": upserted, "as_of_date": str(latest_date), "run_uuid": str(run.run_uuid)}
    except Exception as exc:
        logger.exception("AMC AUM rank compute failed")
        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.failed,
            error_message=str(exc),
        )
        raise
