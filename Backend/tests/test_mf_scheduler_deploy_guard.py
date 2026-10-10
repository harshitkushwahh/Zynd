from __future__ import annotations

import pytest

from app.application.mf.mf_pipeline_types import (
    MfPipelineRunState,
    MfPipelineRunStatus,
    MfPipelineStepState,
    MfPipelineStepStatus,
)
from app.application.mf.mf_scheduler_deploy_guard import (
    live_mf_scheduler_work,
    worker_should_skip_recreate,
)


class _EmptyScalars:
    def __iter__(self):
        return iter(())


class _FakeSession:
    async def scalars(self, _stmt):
        return _EmptyScalars()


def test_only_scheduler_skips_when_busy():
    assert worker_should_skip_recreate("mf-scheduler", busy=True) is True
    assert worker_should_skip_recreate("mf-scheduler", busy=False) is False
    assert worker_should_skip_recreate("mf-order-worker", busy=True) is False


@pytest.mark.asyncio
async def test_live_work_includes_running_pipeline(monkeypatch):
    run = MfPipelineRunState(
        run_id="11111111-1111-1111-1111-111111111111",
        mode="full",
        triggered_by="TEST",
        status=MfPipelineRunStatus.running,
        current_step_key="amfi-ter-monthly",
        steps=[
            MfPipelineStepState(
                key="amfi-ter-monthly",
                label="amfi ter monthly",
                status=MfPipelineStepStatus.running,
            )
        ],
    )

    async def fake_list(_session):
        return [run]

    monkeypatch.setattr(
        "app.application.mf.mf_scheduler_deploy_guard.list_running_pipeline_runs",
        fake_list,
    )
    busy, reasons = await live_mf_scheduler_work(_FakeSession())
    assert busy is True
    assert "pipeline:11111111-1111-1111-1111-111111111111:amfi-ter-monthly" in reasons


@pytest.mark.asyncio
async def test_live_work_ignores_queued_pipeline_waiting_for_worker(monkeypatch):
    run = MfPipelineRunState(
        run_id="22222222-2222-2222-2222-222222222222",
        mode="full",
        triggered_by="ADMIN",
        status=MfPipelineRunStatus.running,
        steps=[MfPipelineStepState(key="cleanup-stale-runs", label="Clean stale ingestion runs")],
    )

    async def fake_list(_session):
        return [run]

    monkeypatch.setattr(
        "app.application.mf.mf_scheduler_deploy_guard.list_running_pipeline_runs",
        fake_list,
    )
    busy, reasons = await live_mf_scheduler_work(_FakeSession())
    assert busy is False
    assert reasons == []


@pytest.mark.asyncio
async def test_live_work_empty_when_idle(monkeypatch):
    async def fake_list(_session):
        return []

    monkeypatch.setattr(
        "app.application.mf.mf_scheduler_deploy_guard.list_running_pipeline_runs",
        fake_list,
    )
    busy, reasons = await live_mf_scheduler_work(_FakeSession())
    assert busy is False
    assert reasons == []
