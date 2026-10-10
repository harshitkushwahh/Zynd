from __future__ import annotations

from datetime import date, datetime, timezone
from types import SimpleNamespace
import pytest

from app.application.mf.mf_pipeline_types import MfPipelineRunState, MfPipelineRunStatus
from app.application.mf.nfo_chain_trigger_service import (
    cron_fires_every_calendar_day,
    mf_ready_for_auto_nfo,
)


def test_ter_monthly_cron_is_not_every_calendar_day():
    assert cron_fires_every_calendar_day("0 10 1 * *") is False
    assert cron_fires_every_calendar_day("0 22 * * *") is True
    assert cron_fires_every_calendar_day("30 20 * * 0") is False


@pytest.mark.asyncio
async def test_ready_blocks_while_ter_monthly_is_running(monkeypatch):
    async def fake_running_pipeline(_session, nfo_only=False):
        _ = nfo_only
        return None

    async def fake_running_jobs(_session):
        return ["amfi-ter-monthly"]

    monkeypatch.setattr(
        "app.application.mf.nfo_chain_trigger_service.get_running_pipeline_run",
        fake_running_pipeline,
    )
    monkeypatch.setattr(
        "app.application.mf.nfo_chain_trigger_service.running_mf_family_jobs",
        fake_running_jobs,
    )

    ready, reason = await mf_ready_for_auto_nfo(SimpleNamespace())
    assert ready is False
    assert "amfi-ter-monthly" in reason


@pytest.mark.asyncio
async def test_ready_blocks_while_mf_pipeline_is_running(monkeypatch):
    async def fake_running_pipeline(_session, nfo_only=False):
        _ = nfo_only
        return MfPipelineRunState(
            run_id="pipe-1",
            mode="full",
            triggered_by="ADMIN",
            status=MfPipelineRunStatus.running,
        )

    async def fake_running_jobs(_session):
        return []

    monkeypatch.setattr(
        "app.application.mf.nfo_chain_trigger_service.get_running_pipeline_run",
        fake_running_pipeline,
    )
    monkeypatch.setattr(
        "app.application.mf.nfo_chain_trigger_service.running_mf_family_jobs",
        fake_running_jobs,
    )

    ready, reason = await mf_ready_for_auto_nfo(SimpleNamespace())
    assert ready is False
    assert reason.startswith("mf_pipeline_running")


@pytest.mark.asyncio
async def test_ready_requires_due_monthly_job_success(monkeypatch):
    now = datetime(2026, 10, 1, 6, 30, tzinfo=timezone.utc)

    async def fake_running_pipeline(_session, nfo_only=False):
        _ = nfo_only
        return None

    async def fake_running_jobs(_session):
        return []

    async def fake_skipped(_session, job_name):
        return job_name != "amfi-ter-monthly"

    async def fake_success(_session, job_name, since=None):
        _ = since
        return None if job_name == "amfi-ter-monthly" else object()

    monkeypatch.setattr(
        "app.application.mf.nfo_chain_trigger_service.get_running_pipeline_run",
        fake_running_pipeline,
    )
    monkeypatch.setattr(
        "app.application.mf.nfo_chain_trigger_service.running_mf_family_jobs",
        fake_running_jobs,
    )
    monkeypatch.setattr(
        "app.application.mf.nfo_chain_trigger_service.is_scheduler_job_skipped_today",
        fake_skipped,
    )
    monkeypatch.setattr(
        "app.application.mf.nfo_chain_trigger_service.latest_successful_run",
        fake_success,
    )
    monkeypatch.setattr(
        "app.application.mf.nfo_chain_trigger_service.build_scheduled_jobs",
        lambda: [
            SimpleNamespace(name="nav-metrics-compute", cron="0 22 * * *", enabled=True),
            SimpleNamespace(name="amfi-ter-monthly", cron="0 10 1 * *", enabled=True),
        ],
    )

    ready, reason = await mf_ready_for_auto_nfo(
        SimpleNamespace(),
        as_of=date(2026, 10, 1),
        now=now,
    )
    assert ready is False
    assert "amfi-ter-monthly" in reason
