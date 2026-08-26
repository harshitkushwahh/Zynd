from __future__ import annotations

from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

import pytest

from app.application.mf.mf_pipeline_preview_service import preview_mf_pipeline
from app.application.mf.mf_pipeline_window_service import pipeline_manual_window_status
from app.application.mf.mf_scheduler_skip_service import IST


def test_pipeline_manual_window_within_day_window():
    noon_ist = datetime(2026, 8, 15, 6, 30, tzinfo=timezone.utc).astimezone(IST)
    status = pipeline_manual_window_status(now=noon_ist)
    assert status["within_window"] is True


def test_pipeline_manual_window_outside_day_window():
    evening_ist = datetime(2026, 8, 15, 15, 0, tzinfo=timezone.utc).astimezone(IST)
    status = pipeline_manual_window_status(now=evening_ist)
    assert status["within_window"] is False
    assert status["opens_at_ist"] is not None


def test_time_within_window_supports_overnight():
    from app.application.mf.mf_pipeline_window_service import _time_within_window

    start = time(22, 0)
    end = time(6, 0)
    assert _time_within_window(time(23, 0), start, end) is True
    assert _time_within_window(time(12, 0), start, end) is False


@pytest.mark.asyncio
async def test_preview_includes_scheduler_mapped_steps(monkeypatch):
    async def fake_get_running(_session):
        return None

    async def fake_count_stuck(_session, threshold_hours):
        _ = threshold_hours
        return 0

    monkeypatch.setattr(
        "app.application.mf.mf_pipeline_preview_service.get_running_pipeline_run",
        fake_get_running,
    )
    monkeypatch.setattr(
        "app.application.mf.mf_pipeline_preview_service.count_stuck_ingestion_runs",
        fake_count_stuck,
    )

    preview = await preview_mf_pipeline("health-repair")
    assert preview["scheduler_mapped_steps"]
    assert preview["effective_steps"]
    assert preview["flags"]["maintenance_window"]["start"] == "00:00"


@pytest.mark.asyncio
async def test_preview_honors_skip_steps(monkeypatch):
    async def fake_get_running(_session):
        return None

    async def fake_count_stuck(_session, threshold_hours):
        _ = threshold_hours
        return 0

    monkeypatch.setattr(
        "app.application.mf.mf_pipeline_preview_service.get_running_pipeline_run",
        fake_get_running,
    )
    monkeypatch.setattr(
        "app.application.mf.mf_pipeline_preview_service.count_stuck_ingestion_runs",
        fake_count_stuck,
    )

    preview = await preview_mf_pipeline("health-repair", skip_steps=["catalog-lifecycle-sync"])
    excluded = [step for step in preview["effective_steps"] if not step["included"]]
    assert len(excluded) == 1
    assert excluded[0]["key"] == "catalog-lifecycle-sync"


@pytest.mark.asyncio
async def test_start_pipeline_rejects_invalid_skip_steps(monkeypatch):
    async def fake_get_running(_session):
        return None

    async def fake_count_stuck(_session, threshold_hours):
        _ = threshold_hours
        return 0

    monkeypatch.setattr(
        "app.application.mf.mf_pipeline_orchestrator_service.get_running_pipeline_run",
        fake_get_running,
    )
    monkeypatch.setattr(
        "app.application.mf.mf_pipeline_orchestrator_service.count_stuck_ingestion_runs",
        fake_count_stuck,
    )

    from app.application.mf.mf_pipeline_orchestrator_service import start_mf_pipeline_run

    with pytest.raises(ValueError, match="Unknown skip_steps"):
        await start_mf_pipeline_run(mode="full", triggered_by="TEST", skip_steps=["not-a-real-step"])
