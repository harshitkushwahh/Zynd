from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.application.mf.mf_mandate_service import record_mandate_sync, should_skip_mandate_sync
from app.infrastructure.mf.fp_mandate_client import extract_mandate_status


def test_extract_mandate_status_reads_nested_payload() -> None:
    payload = {"data": {"mandate_status": "APPROVED"}}
    assert extract_mandate_status(payload) == "APPROVED"


def test_should_skip_mandate_sync_within_interval() -> None:
    recent = datetime.now(timezone.utc) - timedelta(seconds=30)
    metadata = record_mandate_sync({"mandate_sync": {"last_sync_at": recent.isoformat()}})
    assert should_skip_mandate_sync(metadata) is True


def test_should_not_skip_mandate_sync_when_forced() -> None:
    recent = datetime.now(timezone.utc).isoformat()
    metadata = record_mandate_sync({"mandate_sync": {"last_sync_at": recent}})
    assert should_skip_mandate_sync(metadata, force=True) is False


def test_should_not_skip_mandate_sync_after_interval() -> None:
    stale = datetime.now(timezone.utc) - timedelta(seconds=600)
    metadata = {"mandate_sync": {"last_sync_at": stale.isoformat()}}
    assert should_skip_mandate_sync(metadata) is False
