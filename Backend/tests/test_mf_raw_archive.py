from __future__ import annotations

import gzip
from pathlib import Path

import pytest

from app.core.config import Settings
from app.infrastructure.mf.mf_raw_archive import (
    build_raw_archive_storage_key,
    compress_raw_payload,
    read_raw_payload_object,
    store_raw_payload_object,
)


def test_compress_raw_payload_reduces_large_text() -> None:
    payload = ("NAV line\n" * 200_000).encode("utf-8")
    compressed, original_size = compress_raw_payload(payload)
    assert original_size == len(payload)
    assert len(compressed) < original_size


def test_build_raw_archive_storage_key_sanitizes_job_name() -> None:
    key = build_raw_archive_storage_key(job_name="nav cold start backfill", run_uuid="run-1")
    assert key.startswith("ingestions/nav-cold-start-backfill/run-1/")
    assert key.endswith(".bin.gz")


def test_store_and_read_raw_payload_object_roundtrip(tmp_path: Path) -> None:
    settings = Settings(
        document_storage_provider="local",
        documents_root=str(tmp_path / "storage"),
        zynd_mf_raw_bucket="zynd-mf-raw",
    )
    payload = b"scheme;isin;nav\n" * 50_000
    metadata = store_raw_payload_object(
        job_name="nav-cold-start-backfill",
        run_uuid="abc-123",
        payload=payload,
        content_type="text/plain",
        settings=settings,
    )
    assert metadata["storage_provider"] == "local"
    assert metadata["storage_bucket"] == "zynd-mf-raw"
    assert metadata["size_bytes"] == len(payload)
    assert metadata["compressed_size_bytes"] < len(payload)
    assert "body" not in metadata
    assert "body_gzip" not in metadata

    restored = read_raw_payload_object(
        storage_bucket=str(metadata["storage_bucket"]),
        storage_key=str(metadata["storage_key"]),
        settings=settings,
    )
    assert restored == payload


@pytest.mark.asyncio
async def test_store_raw_ingestion_writes_metadata_only_for_large_payload(tmp_path: Path, monkeypatch) -> None:
    from app.core.config import get_settings as real_get_settings
    from app.infrastructure.mf import mongo_raw_store

    settings = Settings(
        document_storage_provider="local",
        documents_root=str(tmp_path / "storage"),
        zynd_mf_raw_bucket="zynd-mf-raw",
        mongo_conn="mongodb://localhost:27017",
        zynd_mf_raw_archive_object_storage_enabled=True,
    )
    monkeypatch.setattr(mongo_raw_store, "get_settings", lambda: settings)

    inserted: dict = {}

    class _FakeCollection:
        async def insert_one(self, doc):
            inserted.update(doc)
            return type("Result", (), {"inserted_id": "fake-id"})()

    class _FakeDB:
        def __getitem__(self, _name):
            return _FakeCollection()

    class _FakeClient:
        def __getitem__(self, _name):
            return _FakeDB()

        def close(self):
            return None

    import motor.motor_asyncio

    monkeypatch.setattr(
        motor.motor_asyncio,
        "AsyncIOMotorClient",
        lambda *_args, **_kwargs: _FakeClient(),
    )
    monkeypatch.setattr(real_get_settings, "cache_clear", lambda: None)

    huge_payload = ("x" * 1024 * 1024 * 18).encode("utf-8")
    archive_id = await mongo_raw_store.store_raw_ingestion(
        job_name="nav-cold-start-backfill",
        run_uuid="run-xyz",
        payload=huge_payload,
    )

    assert archive_id == "fake-id"
    assert inserted["size_bytes"] == len(huge_payload)
    assert inserted["storage_key"]
    assert inserted["storage_bucket"] == "zynd-mf-raw"
    assert "body" not in inserted
    assert "body_gzip" not in inserted
    assert inserted.get("body_omitted") is not True

    restored = read_raw_payload_object(
        storage_bucket=str(inserted["storage_bucket"]),
        storage_key=str(inserted["storage_key"]),
        settings=settings,
    )
    assert restored == huge_payload
    assert gzip.decompress(
        (tmp_path / "storage" / "zynd-mf-raw" / str(inserted["storage_key"])).read_bytes()
    ) == huge_payload
