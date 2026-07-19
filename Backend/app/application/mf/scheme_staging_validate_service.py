from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.ingestion_run_service import begin_ingestion_run, finish_ingestion_run, has_running_job
from app.core.config import get_settings
from app.infrastructure.mf.scheme_staging_store import (
    BATCH_STATUS_FAILED,
    BATCH_STATUS_INGESTED,
    BATCH_STATUS_VALIDATED,
    BATCH_STATUS_VALIDATING,
    ROW_VALIDATION_EXCLUDED,
    ROW_VALIDATION_INVALID,
    ROW_VALIDATION_PENDING,
    ROW_VALIDATION_VALID,
    bulk_update_row_validations,
    close_staging_store,
    find_latest_batch_with_status,
    get_batch,
    list_rows_for_validation,
    update_batch,
)
from app.infrastructure.persistence.mf_models import IngestionRunStatus

logger = logging.getLogger(__name__)


def _validate_normalized(normalized: dict | None) -> tuple[str, str | None, list[str]]:
    if not normalized:
        return ROW_VALIDATION_INVALID, "missing_normalized_payload", ["missing_normalized"]
    flags: list[str] = []
    isin = str(normalized.get("isin_growth") or "")
    if not isin.startswith("INF"):
        flags.append("invalid_isin")
    if not str(normalized.get("scheme_name") or "").strip():
        flags.append("missing_scheme_name")
    if not str(normalized.get("fp_scheme_id") or "").strip():
        flags.append("missing_fp_scheme_id")
    if flags:
        return ROW_VALIDATION_INVALID, "validation_failed", flags
    return ROW_VALIDATION_VALID, None, []


async def run_cybrilla_scheme_validate(
    session: AsyncSession,
    *,
    triggered_by: str = "SCHEDULER",
    batch_uuid: str | None = None,
) -> dict:
    settings = get_settings()
    if not settings.zynd_mf_scheme_staging_enabled:
        return {"skipped": 1, "reason": "scheme_staging_disabled"}
    if await has_running_job(session, "cybrilla-scheme-validate"):
        return {"skipped": 1, "reason": "already_running"}

    batch = await get_batch(batch_uuid) if batch_uuid else await find_latest_batch_with_status(BATCH_STATUS_INGESTED)
    if not batch:
        return {"skipped": 1, "reason": "no_ingested_batch"}

    batch_uuid = batch["batch_uuid"]
    run = await begin_ingestion_run(session, job_name="cybrilla-scheme-validate", triggered_by=triggered_by)
    valid = invalid = excluded = processed = 0
    seen_isins: set[str] = set()

    try:
        await update_batch(batch_uuid, status=BATCH_STATUS_VALIDATING)

        validation_updates: list[tuple[Any, str, str | None, list[str]]] = []
        for row in await list_rows_for_validation(batch_uuid):
            processed += 1
            validation = row.get("validation") or {}
            current_status = validation.get("status")
            if current_status == ROW_VALIDATION_EXCLUDED:
                excluded += 1
                continue
            if current_status != ROW_VALIDATION_PENDING:
                continue

            normalized = row.get("normalized")
            isin = str(row.get("isin_growth") or "")
            if isin in seen_isins:
                validation_updates.append(
                    (row["_id"], ROW_VALIDATION_INVALID, "duplicate_isin_in_batch", ["duplicate_isin"])
                )
                invalid += 1
                continue
            seen_isins.add(isin)

            status, reason, flags = _validate_normalized(normalized)
            validation_updates.append((row["_id"], status, reason, flags))
            if status == ROW_VALIDATION_VALID:
                valid += 1
            else:
                invalid += 1

        await bulk_update_row_validations(validation_updates)

        now = datetime.now(timezone.utc)
        batch_stats = dict(batch.get("stats") or {})
        batch_stats["invalid"] = invalid
        update_fields: dict = {
            "status": BATCH_STATUS_VALIDATED,
            "finished_at": now,
            "stats": {**batch_stats, "invalid": invalid, "normalized": batch_stats.get("normalized", valid + invalid)},
        }

        if settings.zynd_mf_scheme_promote_auto:
            update_fields["approved_at"] = now
            update_fields["approved_by"] = "AUTO"

        await update_batch(batch_uuid, **update_fields)

        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.succeeded,
            records_processed=processed,
            records_inserted=valid,
            records_skipped=invalid + excluded,
            metadata={"batch_uuid": batch_uuid, "valid": valid, "invalid": invalid},
        )
        return {
            "batch_uuid": batch_uuid,
            "processed": processed,
            "valid": valid,
            "invalid": invalid,
            "excluded": excluded,
            "run_uuid": str(run.run_uuid),
        }
    except Exception as exc:
        logger.exception("Cybrilla scheme validate failed")
        await update_batch(batch_uuid, status=BATCH_STATUS_FAILED, validation_errors=[str(exc)])
        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.failed,
            records_processed=processed,
            error_message=str(exc),
            metadata={"batch_uuid": batch_uuid},
        )
        raise
    finally:
        await close_staging_store()
