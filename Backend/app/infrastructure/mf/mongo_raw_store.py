from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.core.config import get_settings
from app.infrastructure.mf.mf_raw_archive import (
    compress_raw_payload,
    sha256_hex,
    store_raw_payload_object,
)

logger = logging.getLogger(__name__)

# Leave headroom under MongoDB's 16 MB document cap for metadata fields.
_MAX_INLINE_GZIP_BYTES = 12 * 1024 * 1024


def _payload_bytes(payload: str | bytes) -> bytes:
    return payload if isinstance(payload, bytes) else payload.encode("utf-8")


def _base_metadata(
    *,
    job_name: str,
    run_uuid: str,
    content_type: str,
    original_size: int,
    compressed: bytes,
    payload: str | bytes,
) -> dict[str, object]:
    return {
        "job_name": job_name,
        "run_uuid": run_uuid,
        "content_type": content_type,
        "size_bytes": original_size,
        "compressed_size_bytes": len(compressed),
        "sha256": sha256_hex(_payload_bytes(payload)),
        "compression": "gzip",
        "stored_at": datetime.now(timezone.utc),
    }


async def store_raw_ingestion(
    *,
    job_name: str,
    run_uuid: str,
    payload: str | bytes,
    content_type: str = "text/plain",
) -> str | None:
    settings = get_settings()
    mongo_url = settings.resolved_mongo_url
    if not mongo_url:
        return None

    try:
        from motor.motor_asyncio import AsyncIOMotorClient
    except ImportError:
        logger.warning("motor not installed; skipping MF raw archive")
        return None

    compressed, original_size = compress_raw_payload(payload)
    doc: dict[str, object] | None = None
    archive_error: str | None = None

    if settings.zynd_mf_raw_archive_object_storage_enabled:
        try:
            doc = store_raw_payload_object(
                job_name=job_name,
                run_uuid=run_uuid,
                payload=payload,
                content_type=content_type,
                settings=settings,
            )
        except Exception as exc:
            archive_error = str(exc)
            logger.warning(
                "MF raw archive object storage failed for job=%s run=%s size=%s bytes: %s",
                job_name,
                run_uuid,
                original_size,
                exc,
            )

    if doc is None:
        doc = _base_metadata(
            job_name=job_name,
            run_uuid=run_uuid,
            content_type=content_type,
            original_size=original_size,
            compressed=compressed,
            payload=payload,
        )
        if archive_error:
            doc["archive_error"] = archive_error
        if len(compressed) <= _MAX_INLINE_GZIP_BYTES:
            doc["body_gzip"] = compressed
        else:
            doc["body_omitted"] = True
            logger.warning(
                "MF raw archive omitted body for job=%s run=%s size=%s bytes compressed=%s bytes",
                job_name,
                run_uuid,
                original_size,
                len(compressed),
            )

    client = AsyncIOMotorClient(mongo_url)
    collection = client[settings.mongo_mf_raw_db]["raw_ingestions"]
    result = await collection.insert_one(doc)
    client.close()
    return str(result.inserted_id)
