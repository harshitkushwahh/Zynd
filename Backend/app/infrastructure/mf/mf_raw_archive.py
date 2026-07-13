from __future__ import annotations

import gzip
import hashlib
import logging
import re
import uuid
from datetime import datetime, timezone

from app.core.config import Settings, get_settings
from app.infrastructure.storage.documents.factory import get_document_storage

logger = logging.getLogger(__name__)

_JOB_SLUG_RE = re.compile(r"[^a-z0-9._-]+")


def _job_slug(job_name: str) -> str:
    slug = job_name.strip().lower().replace(" ", "-")
    slug = _JOB_SLUG_RE.sub("-", slug)
    return slug.strip("-") or "unknown-job"


def build_raw_archive_storage_key(*, job_name: str, run_uuid: str) -> str:
    return f"ingestions/{_job_slug(job_name)}/{run_uuid}/{uuid.uuid4().hex}.bin.gz"


def compress_raw_payload(payload: str | bytes) -> tuple[bytes, int]:
    body = payload if isinstance(payload, bytes) else payload.encode("utf-8")
    compressed = gzip.compress(body, compresslevel=6)
    return compressed, len(body)


def sha256_hex(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def store_raw_payload_object(
    *,
    job_name: str,
    run_uuid: str,
    payload: str | bytes,
    content_type: str = "text/plain",
    settings: Settings | None = None,
) -> dict[str, object]:
    settings = settings or get_settings()
    compressed, original_size = compress_raw_payload(payload)
    storage_key = build_raw_archive_storage_key(job_name=job_name, run_uuid=run_uuid)
    storage = get_document_storage(settings)
    storage.write_bytes(
        bucket=settings.zynd_mf_raw_bucket,
        storage_key=storage_key,
        content=compressed,
        encrypt_at_rest=False,
    )
    original_body = payload if isinstance(payload, bytes) else payload.encode("utf-8")
    return {
        "job_name": job_name,
        "run_uuid": run_uuid,
        "content_type": content_type,
        "size_bytes": original_size,
        "compressed_size_bytes": len(compressed),
        "sha256": sha256_hex(original_body),
        "compression": "gzip",
        "storage_provider": storage.provider,
        "storage_bucket": settings.zynd_mf_raw_bucket,
        "storage_key": storage_key,
        "stored_at": datetime.now(timezone.utc),
    }


def read_raw_payload_object(*, storage_bucket: str, storage_key: str, settings: Settings | None = None) -> bytes:
    settings = settings or get_settings()
    storage = get_document_storage(settings)
    compressed = storage.read_bytes(
        bucket=storage_bucket,
        storage_key=storage_key,
        decrypt_at_rest=False,
    )
    return gzip.decompress(compressed)
