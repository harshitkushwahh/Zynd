from __future__ import annotations

import logging

from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.ingestion_run_service import begin_ingestion_run, finish_ingestion_run, has_running_job
from app.application.mf.scheme_row_normalizer import normalize_scheme_row, normalized_for_mongo
from app.core.config import get_settings
from app.infrastructure.mf.fp_oms_client import list_fund_schemes
from app.infrastructure.mf.mongo_raw_store import store_raw_ingestion
from app.infrastructure.mf.scheme_staging_store import (
    BATCH_STATUS_FAILED,
    BATCH_STATUS_INGESTED,
    BATCH_STATUS_INGESTING,
    ROW_VALIDATION_EXCLUDED,
    ROW_VALIDATION_PENDING,
    bulk_upsert_staging_rows,
    close_staging_store,
    create_ingest_batch,
    update_batch,
)
from app.infrastructure.persistence.mf_models import IngestionRunStatus

logger = logging.getLogger(__name__)


async def run_cybrilla_scheme_ingest(
    session: AsyncSession,
    *,
    triggered_by: str = "SCHEDULER",
) -> dict:
    settings = get_settings()
    if not settings.zynd_mf_scheme_staging_enabled:
        return {"skipped": 1, "reason": "scheme_staging_disabled"}
    if not settings.zynd_mf_scheme_sync_enabled:
        return {"skipped": 1, "reason": "scheme_sync_disabled"}
    if await has_running_job(session, "cybrilla-scheme-ingest"):
        return {"skipped": 1, "reason": "already_running"}

    run = await begin_ingestion_run(session, job_name="cybrilla-scheme-ingest", triggered_by=triggered_by)
    batch_uuid = str(run.run_uuid)
    processed = excluded = normalized_count = skipped = 0
    pages = 0

    try:
        if not settings.resolved_fp_enabled:
            raise RuntimeError("FP_ENABLED is false or FinPrim credentials are missing")

        await create_ingest_batch(batch_uuid=batch_uuid, triggered_by=triggered_by)

        page = 1
        batch_size = settings.zynd_mf_scheme_sync_batch_size
        last_page = False

        while not last_page:
            payload = await list_fund_schemes(page=page, size=batch_size)
            rows = payload.get("data") or payload.get("fund_schemes") or payload.get("objects") or []
            if not isinstance(rows, list):
                rows = []

            if page == 1:
                total_pages = payload.get("total_pages")
                total_elements = payload.get("total_elements")
                print(
                    f"Cybrilla ingest: fetching schemes "
                    f"(total_elements={total_elements}, total_pages={total_pages}, batch_size={batch_size})",
                    flush=True,
                )
                archive_id = await store_raw_ingestion(
                    job_name="cybrilla-scheme-ingest",
                    run_uuid=batch_uuid,
                    payload=str(payload)[:500_000],
                    content_type="application/json",
                )
                if archive_id:
                    await update_batch(batch_uuid, raw_archive_id=archive_id)

            if not rows:
                last_page = True
                break

            pages += 1
            page_rows: list[dict] = []
            for raw in rows:
                if not isinstance(raw, dict):
                    skipped += 1
                    continue
                processed += 1
                isin = str(raw.get("isin") or raw.get("isin_growth") or "").strip().upper()
                if not isin.startswith("INF"):
                    excluded += 1
                    page_rows.append(
                        {
                            "isin_growth": isin or f"invalid-{processed}",
                            "normalized": None,
                            "raw": raw,
                            "validation_status": ROW_VALIDATION_EXCLUDED,
                            "validation_reason": "invalid_isin",
                        }
                    )
                    continue

                normalized = normalize_scheme_row(raw)
                if not normalized:
                    excluded += 1
                    page_rows.append(
                        {
                            "isin_growth": isin,
                            "normalized": None,
                            "raw": raw,
                            "validation_status": ROW_VALIDATION_EXCLUDED,
                            "validation_reason": "catalog_excluded",
                        }
                    )
                    continue

                normalized_count += 1
                page_rows.append(
                    {
                        "isin_growth": normalized["isin_growth"],
                        "normalized": normalized_for_mongo(normalized),
                        "raw": raw,
                        "validation_status": ROW_VALIDATION_PENDING,
                    }
                )

            await bulk_upsert_staging_rows(batch_uuid, page_rows)
            print(
                f"Cybrilla ingest: page {pages} done "
                f"(rows={len(page_rows)}, normalized_total={normalized_count}, processed_total={processed})",
                flush=True,
            )
            logger.info(
                "Cybrilla scheme ingest page=%s rows=%s total_processed=%s normalized=%s",
                pages,
                len(page_rows),
                processed,
                normalized_count,
            )

            last_page = bool(
                payload.get("last")
                or payload.get("is_last")
                or len(rows) < batch_size
                or (
                    payload.get("total_pages") is not None
                    and page >= int(payload["total_pages"])
                )
            )
            page += 1

        finished_at = datetime.now(timezone.utc)
        await update_batch(
            batch_uuid,
            status=BATCH_STATUS_INGESTED,
            finished_at=finished_at,
            stats={
                "pages": pages,
                "raw_rows": processed,
                "normalized": normalized_count,
                "excluded": excluded,
                "invalid": 0,
                "promoted": 0,
                "updated": 0,
                "inserted": 0,
                "skipped": skipped,
            },
        )
        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.succeeded,
            records_processed=processed,
            records_inserted=normalized_count,
            records_skipped=excluded + skipped,
            metadata={"batch_uuid": batch_uuid, "pages": pages, "excluded": excluded},
        )
        return {
            "batch_uuid": batch_uuid,
            "processed": processed,
            "normalized": normalized_count,
            "excluded": excluded,
            "skipped": skipped,
            "pages": pages,
            "run_uuid": batch_uuid,
        }
    except Exception as exc:
        logger.exception("Cybrilla scheme ingest failed")
        await update_batch(batch_uuid, status=BATCH_STATUS_FAILED, validation_errors=[str(exc)])
        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.failed,
            records_processed=processed,
            records_inserted=normalized_count,
            records_skipped=excluded + skipped,
            error_message=str(exc),
            metadata={"batch_uuid": batch_uuid},
        )
        raise
    finally:
        await close_staging_store()
