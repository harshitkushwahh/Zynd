from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.application.mf.fund_classifier import CLASSIFICATION_VERSION, classify_cap_bucket, classify_theme_tags
from app.application.mf.ingestion_run_service import begin_ingestion_run, finish_ingestion_run, has_running_job
from app.core.config import get_settings
from app.infrastructure.persistence.mf_models import FundDerivedAttributes, IngestionRunStatus, MutualFund

logger = logging.getLogger(__name__)


async def run_fund_classification_compute(
    session: AsyncSession,
    *,
    triggered_by: str = "SCHEDULER",
) -> dict[str, int | str]:
    settings = get_settings()
    if not settings.zynd_mf_collections_enabled:
        return {"skipped": 1, "reason": "collections_disabled"}

    if await has_running_job(session, "fund-classification-compute"):
        return {"skipped": 1, "reason": "already_running"}

    run = await begin_ingestion_run(session, job_name="fund-classification-compute", triggered_by=triggered_by)
    processed = upserted = skipped = 0
    batch_size = settings.zynd_mf_metrics_batch_size
    now = datetime.now(timezone.utc)

    try:
        fund_rows = (
            await session.execute(
                select(MutualFund.id, MutualFund.scheme_name, MutualFund.sebi_category).where(
                    MutualFund.is_active.is_(True)
                )
            )
        ).all()

        for offset in range(0, len(fund_rows), batch_size):
            chunk = fund_rows[offset : offset + batch_size]
            for fund_id, scheme_name, sebi_category in chunk:
                processed += 1
                cap_bucket = classify_cap_bucket(scheme_name=scheme_name, sebi_category=sebi_category)
                theme_tags = classify_theme_tags(scheme_name=scheme_name, sebi_category=sebi_category)

                stmt = (
                    insert(FundDerivedAttributes)
                    .values(
                        fund_id=fund_id,
                        cap_bucket=cap_bucket,
                        theme_tags=theme_tags,
                        classified_at=now,
                        classification_version=CLASSIFICATION_VERSION,
                    )
                    .on_conflict_do_update(
                        index_elements=[FundDerivedAttributes.fund_id],
                        set_={
                            "cap_bucket": cap_bucket,
                            "theme_tags": theme_tags,
                            "classified_at": now,
                            "classification_version": CLASSIFICATION_VERSION,
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
        return {"processed": processed, "upserted": upserted, "skipped": skipped}
    except Exception:
        logger.exception("fund-classification-compute failed")
        await finish_ingestion_run(session, run, status=IngestionRunStatus.failed)
        raise
