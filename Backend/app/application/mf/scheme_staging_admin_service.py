from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from app.infrastructure.mf.scheme_staging_store import (
    BATCH_STATUS_APPROVED,
    BATCH_STATUS_REJECTED,
    BATCH_STATUS_VALIDATED,
    get_batch,
    list_batches,
    list_staging_rows,
    update_batch,
)


def _serialize_batch(doc: dict) -> dict:
    return {
        "batch_uuid": doc["batch_uuid"],
        "source": doc.get("source"),
        "status": doc.get("status"),
        "triggered_by": doc.get("triggered_by"),
        "stats": doc.get("stats") or {},
        "validation_errors": doc.get("validation_errors") or [],
        "rejection_reason": doc.get("rejection_reason"),
        "approved_by": doc.get("approved_by"),
        "approved_at": doc.get("approved_at").isoformat() if doc.get("approved_at") else None,
        "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
        "finished_at": doc.get("finished_at").isoformat() if doc.get("finished_at") else None,
    }


async def list_scheme_staging_batches(*, limit: int = 50, status: str | None = None) -> list[dict]:
    rows = await list_batches(limit=limit, status=status)
    return [_serialize_batch(row) for row in rows]


async def get_scheme_staging_batch(batch_uuid: str) -> dict | None:
    doc = await get_batch(batch_uuid)
    if not doc:
        return None
    return _serialize_batch(doc)


async def list_scheme_staging_batch_rows(
    batch_uuid: str,
    *,
    validation_status: str | None = None,
    promote_status: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> dict:
    doc = await get_batch(batch_uuid)
    if not doc:
        raise ValueError("Staging batch not found")
    payload = await list_staging_rows(
        batch_uuid,
        validation_status=validation_status,
        promote_status=promote_status,
        page=page,
        page_size=page_size,
    )
    items = []
    for row in payload["items"]:
        promote = row.get("promote") or {}
        validation = row.get("validation") or {}
        normalized = row.get("normalized") or {}
        items.append(
            {
                "mongo_id": row.get("mongo_id"),
                "isin_growth": row.get("isin_growth"),
                "scheme_name": normalized.get("scheme_name"),
                "amc_name": normalized.get("amc_name"),
                "validation_status": validation.get("status"),
                "validation_reason": validation.get("reason"),
                "validation_flags": validation.get("flags") or [],
                "promote_status": promote.get("status"),
                "product_id": promote.get("product_id"),
                "fund_id": promote.get("fund_id"),
                "amc_id": promote.get("amc_id"),
                "promote_error": promote.get("error"),
            }
        )
    return {**payload, "items": items}


async def approve_scheme_staging_batch(
    batch_uuid: str,
    *,
    admin_user_id: UUID,
    auto_resume_pipeline: bool = True,
) -> dict:
    doc = await get_batch(batch_uuid)
    if not doc:
        raise ValueError("Staging batch not found")
    if doc.get("status") != BATCH_STATUS_VALIDATED:
        raise ValueError(f"Batch cannot be approved (status={doc.get('status')})")
    now = datetime.now(timezone.utc)
    await update_batch(
        batch_uuid,
        status=BATCH_STATUS_APPROVED,
        approved_by=str(admin_user_id),
        approved_at=now,
    )
    refreshed = await get_batch(batch_uuid)
    if auto_resume_pipeline:
        from app.application.mf.mf_pipeline_auto_resume_service import try_auto_resume_for_batch

        await try_auto_resume_for_batch(batch_uuid, source="staging_approve")
    return _serialize_batch(refreshed or doc)


async def reject_scheme_staging_batch(
    batch_uuid: str,
    *,
    admin_user_id: UUID,
    reason: str,
) -> dict:
    doc = await get_batch(batch_uuid)
    if not doc:
        raise ValueError("Staging batch not found")
    if doc.get("status") in {BATCH_STATUS_PROMOTED, BATCH_STATUS_REJECTED}:
        raise ValueError(f"Batch cannot be rejected (status={doc.get('status')})")
    await update_batch(
        batch_uuid,
        status=BATCH_STATUS_REJECTED,
        rejection_reason=reason.strip() or "Rejected by admin",
        approved_by=str(admin_user_id),
        approved_at=datetime.now(timezone.utc),
    )
    refreshed = await get_batch(batch_uuid)
    return _serialize_batch(refreshed or doc)
