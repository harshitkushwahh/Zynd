from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from pymongo import UpdateOne

from app.core.config import get_settings

logger = logging.getLogger(__name__)

BATCHES = "scheme_ingest_batches"
ROWS = "scheme_staging_rows"

BATCH_STATUS_INGESTING = "ingesting"
BATCH_STATUS_INGESTED = "ingested"
BATCH_STATUS_VALIDATING = "validating"
BATCH_STATUS_VALIDATED = "validated"
BATCH_STATUS_APPROVED = "approved"
BATCH_STATUS_PROMOTING = "promoting"
BATCH_STATUS_PROMOTED = "promoted"
BATCH_STATUS_REJECTED = "rejected"
BATCH_STATUS_FAILED = "failed"

ROW_VALIDATION_PENDING = "pending"
ROW_VALIDATION_VALID = "valid"
ROW_VALIDATION_EXCLUDED = "excluded"
ROW_VALIDATION_INVALID = "invalid"

ROW_PROMOTE_PENDING = "pending"
ROW_PROMOTE_PROMOTED = "promoted"
ROW_PROMOTE_FAILED = "failed"
ROW_PROMOTE_SKIPPED = "skipped"

_mongo_client = None


def _require_mongo_url() -> str:
    settings = get_settings()
    mongo_url = settings.resolved_mongo_url
    if not mongo_url:
        raise RuntimeError("MongoDB is required for scheme staging (set MONGO_URL or MONGO_CONN)")
    return mongo_url


def _content_hash(normalized: dict[str, Any]) -> str:
    body = json.dumps(normalized, sort_keys=True, default=str)
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def _get_mongo_client():
    global _mongo_client
    if _mongo_client is None:
        try:
            from motor.motor_asyncio import AsyncIOMotorClient
        except ImportError as exc:
            raise RuntimeError("motor is required for scheme staging") from exc
        _mongo_client = AsyncIOMotorClient(_require_mongo_url())
    return _mongo_client


def _get_db():
    settings = get_settings()
    return _get_mongo_client()[settings.mongo_mf_raw_db]


async def close_staging_store() -> None:
    global _mongo_client
    if _mongo_client is not None:
        _mongo_client.close()
        _mongo_client = None


async def create_ingest_batch(*, batch_uuid: str, triggered_by: str) -> dict[str, Any]:
    db = _get_db()
    now = datetime.now(timezone.utc)
    doc = {
        "batch_uuid": batch_uuid,
        "source": "cybrilla",
        "status": BATCH_STATUS_INGESTING,
        "triggered_by": triggered_by,
        "stats": {
            "pages": 0,
            "raw_rows": 0,
            "normalized": 0,
            "excluded": 0,
            "invalid": 0,
            "promoted": 0,
            "updated": 0,
            "inserted": 0,
            "skipped": 0,
        },
        "raw_archive_id": None,
        "validation_errors": [],
        "rejection_reason": None,
        "approved_by": None,
        "approved_at": None,
        "created_at": now,
        "finished_at": None,
    }
    await db[BATCHES].insert_one(doc)
    return doc


async def update_batch(batch_uuid: str, **fields: Any) -> None:
    db = _get_db()
    await db[BATCHES].update_one({"batch_uuid": batch_uuid}, {"$set": fields})


async def increment_batch_stats(batch_uuid: str, increments: dict[str, int]) -> None:
    db = _get_db()
    payload = {f"stats.{key}": value for key, value in increments.items()}
    await db[BATCHES].update_one({"batch_uuid": batch_uuid}, {"$inc": payload})


async def get_batch(batch_uuid: str) -> dict[str, Any] | None:
    db = _get_db()
    return await db[BATCHES].find_one({"batch_uuid": batch_uuid}, {"_id": 0})


async def list_batches(*, limit: int = 50, status: str | None = None) -> list[dict[str, Any]]:
    db = _get_db()
    query: dict[str, Any] = {}
    if status:
        query["status"] = status
    cursor = db[BATCHES].find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    rows = await cursor.to_list(length=limit)
    return rows


async def find_latest_batch_with_status(status: str) -> dict[str, Any] | None:
    db = _get_db()
    return await db[BATCHES].find_one({"status": status}, {"_id": 0}, sort=[("created_at", -1)])


async def find_latest_promotable_batch() -> dict[str, Any] | None:
    for status in (BATCH_STATUS_APPROVED, BATCH_STATUS_VALIDATED):
        doc = await find_latest_batch_with_status(status)
        if doc:
            return doc
    return None


async def upsert_staging_row(
    *,
    batch_uuid: str,
    isin_growth: str,
    normalized: dict[str, Any] | None,
    raw: dict[str, Any] | None,
    validation_status: str,
    validation_reason: str | None = None,
) -> None:
    await bulk_upsert_staging_rows(
        batch_uuid,
        [
            {
                "isin_growth": isin_growth,
                "normalized": normalized,
                "raw": raw,
                "validation_status": validation_status,
                "validation_reason": validation_reason,
            }
        ],
    )


async def bulk_upsert_staging_rows(batch_uuid: str, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return

    db = _get_db()
    now = datetime.now(timezone.utc)
    ops: list[UpdateOne] = []
    for row in rows:
        isin_growth = str(row["isin_growth"])
        normalized = row.get("normalized")
        raw = row.get("raw")
        validation_status = row["validation_status"]
        validation_reason = row.get("validation_reason")
        content_hash = _content_hash(normalized) if normalized else None
        ops.append(
            UpdateOne(
                {"batch_uuid": batch_uuid, "isin_growth": isin_growth},
                {
                    "$set": {
                        "batch_uuid": batch_uuid,
                        "isin_growth": isin_growth,
                        "normalized": normalized,
                        "raw": raw,
                        "validation": {
                            "status": validation_status,
                            "reason": validation_reason,
                            "flags": [],
                        },
                        "promote": {
                            "status": ROW_PROMOTE_PENDING,
                            "product_id": None,
                            "fund_id": None,
                            "amc_id": None,
                            "promoted_at": None,
                            "error": None,
                        },
                        "content_hash": content_hash,
                        "updated_at": now,
                    },
                    "$setOnInsert": {"created_at": now},
                },
                upsert=True,
            )
        )

    await db[ROWS].bulk_write(ops, ordered=False)


async def list_staging_rows(
    batch_uuid: str,
    *,
    validation_status: str | None = None,
    promote_status: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> dict[str, Any]:
    db = _get_db()
    query: dict[str, Any] = {"batch_uuid": batch_uuid}
    if validation_status:
        query["validation.status"] = validation_status
    if promote_status:
        query["promote.status"] = promote_status
    page = max(page, 1)
    page_size = min(max(page_size, 1), 200)
    offset = (page - 1) * page_size
    total = await db[ROWS].count_documents(query)
    cursor = db[ROWS].find(query, {"_id": 1, "raw": 0}).sort("isin_growth", 1).skip(offset).limit(page_size)
    items = []
    async for doc in cursor:
        doc["mongo_id"] = str(doc.pop("_id"))
        items.append(doc)
    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "has_more": offset + len(items) < total,
    }


async def list_rows_for_validation(batch_uuid: str) -> list[dict[str, Any]]:
    db = _get_db()
    return await db[ROWS].find(
        {"batch_uuid": batch_uuid},
        {"_id": 1, "isin_growth": 1, "normalized": 1, "validation": 1},
    ).to_list(length=None)


async def list_rows_for_promote(batch_uuid: str) -> list[dict[str, Any]]:
    db = _get_db()
    return await db[ROWS].find(
        {
            "batch_uuid": batch_uuid,
            "validation.status": ROW_VALIDATION_VALID,
            "promote.status": ROW_PROMOTE_PENDING,
        }
    ).to_list(length=None)


async def update_row_validation(
    mongo_id: Any,
    *,
    status: str,
    reason: str | None = None,
    flags: list[str] | None = None,
) -> None:
    await bulk_update_row_validations(
        [(mongo_id, status, reason, flags or [])],
    )


async def bulk_update_row_validations(
    updates: list[tuple[Any, str, str | None, list[str]]],
) -> None:
    if not updates:
        return

    from bson import ObjectId

    db = _get_db()
    now = datetime.now(timezone.utc)
    ops: list[UpdateOne] = []
    for mongo_id, status, reason, flags in updates:
        ops.append(
            UpdateOne(
                {"_id": ObjectId(mongo_id)},
                {
                    "$set": {
                        "validation.status": status,
                        "validation.reason": reason,
                        "validation.flags": flags,
                        "updated_at": now,
                    }
                },
            )
        )
    await db[ROWS].bulk_write(ops, ordered=False)


async def mark_row_promoted(
    mongo_id: Any,
    *,
    product_id: UUID | None,
    fund_id: int | None,
    amc_id: int | None,
) -> None:
    from bson import ObjectId

    db = _get_db()
    await db[ROWS].update_one(
        {"_id": ObjectId(mongo_id)},
        {
            "$set": {
                "promote.status": ROW_PROMOTE_PROMOTED,
                "promote.product_id": str(product_id) if product_id else None,
                "promote.fund_id": fund_id,
                "promote.amc_id": amc_id,
                "promote.promoted_at": datetime.now(timezone.utc),
                "promote.error": None,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )


async def mark_row_promote_failed(mongo_id: Any, *, error: str) -> None:
    from bson import ObjectId

    db = _get_db()
    await db[ROWS].update_one(
        {"_id": ObjectId(mongo_id)},
        {
            "$set": {
                "promote.status": ROW_PROMOTE_FAILED,
                "promote.error": error,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )
