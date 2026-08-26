from __future__ import annotations

import uuid

import pytest

from app.application.mf.mf_pipeline_orchestrator_service import (
    INGESTION_TRIGGERED_BY_MAX_LEN,
    _build_step_plan,
    _check_blockers,
    _job_step_was_skipped,
    _pipeline_triggered_by,
    start_mf_pipeline_run,
)
from app.application.mf.mf_pipeline_types import (
    MfPipelineControlledPause,
    MfPipelineRunState,
    MfPipelineRunStatus,
    MfPipelineStepState,
    MfPipelineStepStatus,
    NAV_ANALYTICS_ONLY_JOBS,
    PIPELINE_MODES,
)


def test_pipeline_modes_include_phase_b():
    assert "nav-analytics-only" in PIPELINE_MODES
    assert "health-repair" in PIPELINE_MODES
    assert "staging-only" in PIPELINE_MODES
    assert "after-ingest" in PIPELINE_MODES


def test_job_step_was_skipped_distinguishes_bailout_from_record_counts():
    assert _job_step_was_skipped({"skipped": 1, "reason": "already_running"}) is True
    assert _job_step_was_skipped({"skipped": 1, "reason": "not_needed", "nav_count": 3_000_000}) is True
    assert _job_step_was_skipped({"skipped": 59969, "run_uuid": "abc", "processed": 61921}) is False
    assert _job_step_was_skipped({"skipped": 4999, "inserted": 100, "run_uuid": "abc"}) is False
    assert _job_step_was_skipped({"processed": 100, "run_uuid": "abc"}) is False


def test_pipeline_triggered_by_fits_ingestion_column():
    run = MfPipelineRunState(
        run_id=str(uuid.uuid4()),
        mode="full",
        triggered_by="ADMIN",
        steps=[MfPipelineStepState(key="cleanup-stale-runs", label="Clean stale ingestion runs")],
    )
    triggered_by = _pipeline_triggered_by(run)
    assert triggered_by.startswith("PIPELINE:")
    assert len(triggered_by) <= INGESTION_TRIGGERED_BY_MAX_LEN


def test_build_step_plan_full_includes_post_processing_steps():
    steps = _build_step_plan("full")
    keys = [key for key, _ in steps]
    assert "catalog-health" in keys
    assert "final-counts" in keys
    assert "seed-tax-compliance" in keys
    assert keys.index("nav-metrics-compute") < keys.index("composite-rank-compute")


def test_build_step_plan_bootstrap_includes_min_amounts_loop():
    steps = _build_step_plan("bootstrap")
    keys = [key for key, _ in steps]
    assert "scheme-min-amounts-backfill-loop" in keys
    assert "cybrilla-scheme-ingest" not in keys


def test_build_step_plan_after_ingest_matches_bootstrap():
    bootstrap_keys = [key for key, _ in _build_step_plan("bootstrap")]
    after_ingest_keys = [key for key, _ in _build_step_plan("after-ingest")]
    assert bootstrap_keys == after_ingest_keys


def test_build_step_plan_staging_only_stops_after_validate():
    steps = _build_step_plan("staging-only")
    keys = [key for key, _ in steps]
    assert keys == ["cleanup-stale-runs", "cybrilla-scheme-ingest", "cybrilla-scheme-validate"]
    assert "cybrilla-scheme-promote" not in keys
    assert "catalog-health" not in keys


def test_build_step_plan_nav_analytics_only():
    steps = _build_step_plan("nav-analytics-only")
    keys = [key for key, _ in steps]
    assert keys[0] == "cleanup-stale-runs"
    assert keys[-2:] == ["final-counts", "catalog-health"]
    for job in NAV_ANALYTICS_ONLY_JOBS:
        assert job in keys
    assert "cybrilla-scheme-ingest" not in keys


def test_build_step_plan_health_repair():
    steps = _build_step_plan("health-repair")
    keys = [key for key, _ in steps]
    assert keys[-1] == "catalog-health"
    assert "catalog-lifecycle-sync" in keys
    assert "cybrilla-scheme-ingest" not in keys


def test_step_state_serializes_ingestion_run_uuid():
    step = MfPipelineStepState(
        key="amfi-nav-daily",
        label="amfi nav daily",
        status=MfPipelineStepStatus.succeeded,
        ingestion_run_uuid="11111111-1111-1111-1111-111111111111",
    )
    assert step.to_dict()["ingestion_run_uuid"] == "11111111-1111-1111-1111-111111111111"


def test_run_state_exposes_staging_pause_metadata():
    run = MfPipelineRunState(
        run_id="run-1",
        mode="full",
        triggered_by="ADMIN",
        status=MfPipelineRunStatus.paused,
        context={
            "pause_reason": "awaiting_staging_approval",
            "batch_uuid": "batch-123",
        },
    )
    payload = run.to_dict()
    assert payload["pause_reason"] == "awaiting_staging_approval"
    assert payload["staging_batch_uuid"] == "batch-123"
    assert payload["can_approve_staging"] is True


@pytest.mark.asyncio
async def test_start_pipeline_rejects_parallel_runs(monkeypatch):
    fake_run = MfPipelineRunState(
        run_id="busy-run",
        mode="full",
        triggered_by="TEST",
        status=MfPipelineRunStatus.running,
    )

    async def fake_get_running(_session):
        return fake_run

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

    with pytest.raises(RuntimeError, match="already in progress"):
        await start_mf_pipeline_run(mode="full", triggered_by="TEST")


@pytest.mark.asyncio
async def test_check_blockers_allows_same_run_id(monkeypatch):
    run_id = "busy-run"
    fake_run = MfPipelineRunState(
        run_id=run_id,
        mode="full",
        triggered_by="TEST",
        status=MfPipelineRunStatus.running,
    )

    async def fake_get_running(_session):
        return fake_run

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

    await _check_blockers(except_run_id=run_id)

    with pytest.raises(RuntimeError, match="already in progress"):
        await _check_blockers(except_run_id="other-run")


def test_controlled_pause_carries_reason():
    exc = MfPipelineControlledPause(
        pause_reason="awaiting_staging_approval",
        message="Approve the staging batch in the Staging tab, then Resume.",
    )
    assert exc.pause_reason == "awaiting_staging_approval"
    assert "Approve" in exc.message
