from __future__ import annotations

import hashlib
import hmac
import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.ingestion_run_service import begin_ingestion_run, finish_ingestion_run, has_running_job
from app.application.mf.invest_catalog_invalidation import notify_invest_catalog_changed
from app.application.mf.scheme_sql_upsert_service import upsert_fund_from_normalized
from app.core.config import get_settings
from app.infrastructure.mf.scheme_staging_store import (
    BATCH_STATUS_APPROVED,
    BATCH_STATUS_FAILED,
    BATCH_STATUS_PROMOTED,
    BATCH_STATUS_PROMOTING,
    BATCH_STATUS_REJECTED,
    BATCH_STATUS_VALIDATED,
    find_latest_batch_with_status,
    find_latest_promotable_batch,
    get_batch,
    list_rows_for_promote,
    mark_row_promote_failed,
    mark_row_promoted,
    close_staging_store,
    update_batch,
)
from app.infrastructure.persistence.mf_models import IngestionRunStatus

logger = logging.getLogger(__name__)

SCHEDULER_TRIGGER = "SCHEDULER"


def scheduler_accept_marker(batch_uuid: str, secret: str) -> str:
    """Fingerprint of the scheduler accept key for this batch. The secret is not stored."""
    digest = hmac.new(secret.encode("utf-8"), batch_uuid.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"scheduler:{digest[:16]}"


def scheduler_can_accept(*, triggered_by: str, secret: str) -> bool:
    return triggered_by == SCHEDULER_TRIGGER and bool(secret.strip())


def _batch_ready_for_promote(batch: dict, *, auto_promote: bool) -> tuple[bool, str | None]:
    if batch.get("status") == BATCH_STATUS_REJECTED:
        return False, "batch_rejected"
    if batch.get("status") not in {BATCH_STATUS_VALIDATED, BATCH_STATUS_APPROVED, BATCH_STATUS_PROMOTING}:
        return False, "batch_not_validated"
    if batch.get("approved_at") or batch.get("approved_by") or auto_promote:
        return True, None
    return False, "pending_approval"


async def run_cybrilla_scheme_promote(
    session: AsyncSession,
    *,
    triggered_by: str = "SCHEDULER",
    batch_uuid: str | None = None,
    force: bool = False,
) -> dict:
    settings = get_settings()
    if not settings.zynd_mf_scheme_staging_enabled:
        return {"skipped": 1, "reason": "scheme_staging_disabled"}
    if await has_running_job(session, "cybrilla-scheme-promote"):
        return {"skipped": 1, "reason": "already_running"}

    batch = (
        await get_batch(batch_uuid)
        if batch_uuid
        else await find_latest_promotable_batch()
    )
    if not batch:
        return {"skipped": 1, "reason": "no_validated_batch"}

    batch_uuid = batch["batch_uuid"]
    ready, reason = _batch_ready_for_promote(
        batch,
        auto_promote=settings.zynd_mf_scheme_promote_auto,
    )
    accept_key = settings.zynd_mf_scheduler_accept_key.strip()
    if not ready and reason == "pending_approval" and scheduler_can_accept(triggered_by=triggered_by, secret=accept_key):
        marker = scheduler_accept_marker(batch_uuid, accept_key)
        approved_at = datetime.now(timezone.utc)
        await update_batch(
            batch_uuid,
            status=BATCH_STATUS_APPROVED,
            approved_by=marker,
            approved_at=approved_at,
        )
        batch["status"] = BATCH_STATUS_APPROVED
        batch["approved_by"] = marker
        batch["approved_at"] = approved_at
        ready = True
        logger.info("Scheduler accepted scheme batch %s", batch_uuid)
    if not ready and not force:
        return {"skipped": 1, "reason": reason, "batch_uuid": batch_uuid}

    run = await begin_ingestion_run(session, job_name="cybrilla-scheme-promote", triggered_by=triggered_by)
    inserted = updated = failed = processed = 0

    try:
        await update_batch(batch_uuid, status=BATCH_STATUS_PROMOTING)
        for row in await list_rows_for_promote(batch_uuid):
            processed += 1
            normalized = row.get("normalized")
            if not normalized:
                await mark_row_promote_failed(row["_id"], error="missing_normalized")
                failed += 1
                continue
            try:
                action, fund, amc, product = await upsert_fund_from_normalized(session, normalized)
                if action == "inserted":
                    inserted += 1
                else:
                    updated += 1
                await mark_row_promoted(
                    row["_id"],
                    product_id=product.id if product else None,
                    fund_id=fund.id,
                    amc_id=amc.id,
                )
            except Exception as exc:  # noqa: BLE001 — per-row promote errors
                logger.warning("Promote row failed isin=%s error=%s", row.get("isin_growth"), exc)
                await mark_row_promote_failed(row["_id"], error=str(exc))
                failed += 1

        stats = dict(batch.get("stats") or {})
        stats.update({"inserted": inserted, "updated": updated, "promoted": inserted + updated})
        await update_batch(
            batch_uuid,
            status=BATCH_STATUS_PROMOTED,
            finished_at=datetime.now(timezone.utc),
            stats=stats,
        )
        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.succeeded,
            records_processed=processed,
            records_inserted=inserted,
            records_skipped=failed,
            metadata={"batch_uuid": batch_uuid, "updated": updated, "failed": failed},
        )
        await notify_invest_catalog_changed(session, refresh_search_vectors=True)
        return {
            "batch_uuid": batch_uuid,
            "processed": processed,
            "inserted": inserted,
            "updated": updated,
            "failed": failed,
            "run_uuid": str(run.run_uuid),
        }
    except Exception as exc:
        logger.exception("Cybrilla scheme promote failed")
        await update_batch(batch_uuid, status=BATCH_STATUS_FAILED, validation_errors=[str(exc)])
        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.failed,
            records_processed=processed,
            records_inserted=inserted,
            records_skipped=failed,
            error_message=str(exc),
            metadata={"batch_uuid": batch_uuid},
        )
        raise
    finally:
        await close_staging_store()
