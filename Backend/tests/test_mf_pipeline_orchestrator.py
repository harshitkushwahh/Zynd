from __future__ import annotations

import uuid

import pytest

from app.application.mf.ingestion_run_service import progress_is_fresh
from app.application.mf.mf_pipeline_orchestrator_service import (
    INGESTION_TRIGGERED_BY_MAX_LEN,
    _build_step_plan,
    _check_blockers,
    _execution_tasks,
    _iter_executable_steps,
    _job_step_was_skipped,
    _pipeline_triggered_by,
    _queue_or_launch,
    _step_is_complete,
    start_mf_pipeline_run,
)
from app.application.mf.mf_pipeline_store import pipeline_run_awaits_worker
from app.application.mf.mf_pipeline_types import (
    PAUSE_REASON_JOB_STILL_RUNNING,
    MfPipelineControlledPause,
    MfPipelineRunState,
    MfPipelineRunStatus,
    MfPipelineStepState,
    MfPipelineStepStatus,
    NAV_ANALYTICS_ONLY_JOBS,
    PIPELINE_MODES,
)
from app.application.mf.nav_cold_start_backfill_service import cold_start_resume_date_from_logs


def test_pipeline_modes_include_phase_b():
    assert "nav-analytics-only" in PIPELINE_MODES
    assert "health-repair" in PIPELINE_MODES
    assert "staging-only" in PIPELINE_MODES
    assert "after-ingest" in PIPELINE_MODES
    assert "nfo" in PIPELINE_MODES
    assert "nfo-lifecycle" in PIPELINE_MODES
    assert "nfo-category" in PIPELINE_MODES


@pytest.mark.asyncio
async def test_execute_mf_job_dispatches_nfo_lifecycle(monkeypatch):
    from app.application.mf.mf_job_runner_service import execute_mf_job

    async def fake_nfo(session, job_name, **kwargs):
        return {"job": job_name, "dispatched": True, **kwargs}

    monkeypatch.setattr(
        "app.application.mf.nfo_job_runner_service.execute_nfo_job",
        fake_nfo,
    )
    result = await execute_mf_job(object(), "nfo-lifecycle-sync", triggered_by="PIPELINE:abc")
    assert result["dispatched"] is True
    assert result["job"] == "nfo-lifecycle-sync"
    assert result["skip_mutex"] is True


def test_build_step_plan_nfo_pauses_for_category_approval():
    keys = [key for key, _ in _build_step_plan("nfo")]
    assert keys == [
        "cleanup-stale-runs",
        "nfo-lifecycle-sync",
        "nfo-category-approve",
        "nfo-collection-assign-sync",
        "nfo-final-counts",
    ]
    assert [key for key, _ in _build_step_plan("nfo-lifecycle")] == [
        "cleanup-stale-runs",
        "nfo-lifecycle-sync",
        "nfo-final-counts",
    ]
    assert [key for key, _ in _build_step_plan("nfo-category")] == [
        "cleanup-stale-runs",
        "nfo-category-approve",
        "nfo-collection-assign-sync",
        "nfo-final-counts",
    ]


def test_job_step_was_skipped_distinguishes_bailout_from_record_counts():
    assert _job_step_was_skipped({"skipped": 1, "reason": "already_running"}) is False
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
        steps=[
            MfPipelineStepState(
                key="cybrilla-scheme-promote",
                label="Promote validated schemes",
                status=MfPipelineStepStatus.pending,
            )
        ],
        context={
            "pause_reason": "awaiting_staging_approval",
            "batch_uuid": "batch-123",
        },
    )
    payload = run.to_dict()
    assert payload["pause_reason"] == "awaiting_staging_approval"
    assert payload["staging_batch_uuid"] == "batch-123"
    assert payload["can_approve_staging"] is True


def test_run_state_hides_stale_staging_approval_after_promote():
    run = MfPipelineRunState(
        run_id="run-2",
        mode="full",
        triggered_by="ADMIN",
        status=MfPipelineRunStatus.paused,
        current_step_key="amfi-ter-monthly",
        error="Interrupted by server restart - resume to continue",
        steps=[
            MfPipelineStepState(
                key="cybrilla-scheme-promote",
                label="Promote validated schemes",
                status=MfPipelineStepStatus.succeeded,
            ),
            MfPipelineStepState(
                key="amfi-ter-monthly",
                label="amfi ter monthly",
                status=MfPipelineStepStatus.running,
            ),
        ],
        context={
            "pause_reason": "awaiting_staging_approval",
            "batch_uuid": "batch-123",
        },
    )
    payload = run.to_dict()
    assert payload["can_approve_staging"] is False
    assert payload["auto_resume_pending"] is False
    assert payload["staging_batch_uuid"] is None
    assert payload["can_resume"] is True


def test_run_state_hides_resume_while_backfill_is_still_running():
    run = MfPipelineRunState(
        run_id="run-3",
        mode="full",
        triggered_by="ADMIN",
        status=MfPipelineRunStatus.paused,
        error="NAV backfill is still running.",
        steps=[
            MfPipelineStepState(
                key="nav-cold-start-backfill",
                label="nav cold start backfill",
                status=MfPipelineStepStatus.pending,
            )
        ],
        context={"pause_reason": PAUSE_REASON_JOB_STILL_RUNNING},
    )
    payload = run.to_dict()
    assert payload["can_resume"] is False
    assert payload["pause_reason"] == PAUSE_REASON_JOB_STILL_RUNNING


def test_already_running_skip_is_not_a_finished_step():
    skipped = MfPipelineStepState(
        key="nav-cold-start-backfill",
        label="nav cold start backfill",
        status=MfPipelineStepStatus.skipped,
        result={"skipped": 1, "reason": "already_running"},
    )
    done = MfPipelineStepState(
        key="nav-metrics-compute",
        label="nav metrics compute",
        status=MfPipelineStepStatus.succeeded,
    )
    assert _step_is_complete(skipped) is False
    assert _step_is_complete(done) is True
    run = MfPipelineRunState(
        run_id="run-4",
        mode="full",
        triggered_by="ADMIN",
        steps=[skipped, done],
    )
    assert [step.key for step in _iter_executable_steps(run)] == ["nav-cold-start-backfill"]


def test_cold_start_resume_date_retries_the_open_window():
    messages = [
        "NAV cold-start backfill: window 48/84 (2017-10-30 .. 2018-01-27)",
        "NAV cold-start backfill: window 48/84 parsed=0 inserted_so_far=0 bytes=10",
        "NAV cold-start backfill: window 49/84 (2018-01-28 .. 2018-04-27)",
    ]
    assert cold_start_resume_date_from_logs(messages).isoformat() == "2018-01-28"


def test_cold_start_resume_date_advances_after_a_parsed_window():
    messages = [
        "NAV cold-start backfill: window 49/84 (2018-01-28 .. 2018-04-27)",
        "NAV cold-start backfill: window 49/84 parsed=12 inserted_so_far=0 bytes=10",
    ]
    assert cold_start_resume_date_from_logs(messages).isoformat() == "2018-04-28"


def test_progress_is_fresh_uses_latest_activity_not_start_time():
    from datetime import datetime, timedelta, timezone

    now = datetime(2026, 10, 4, 12, 0, tzinfo=timezone.utc)
    assert progress_is_fresh(
        last_progress_at=None,
        activity_at=now - timedelta(minutes=1),
        started_at=now - timedelta(hours=6),
        now=now,
    )
    assert not progress_is_fresh(
        last_progress_at=None,
        activity_at=now - timedelta(minutes=10),
        started_at=now - timedelta(minutes=1),
        now=now,
    )


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


def test_queued_pipeline_awaits_worker():
    run = MfPipelineRunState(
        run_id="queued-run",
        mode="full",
        triggered_by="TEST",
        status=MfPipelineRunStatus.running,
        steps=[MfPipelineStepState(key="amfi-ter-monthly", label="TER")],
    )
    assert pipeline_run_awaits_worker(run) is True


def test_mid_step_pipeline_does_not_await_worker():
    run = MfPipelineRunState(
        run_id="mid-run",
        mode="full",
        triggered_by="TEST",
        status=MfPipelineRunStatus.running,
        current_step_key="amfi-ter-monthly",
        steps=[
            MfPipelineStepState(
                key="amfi-ter-monthly",
                label="TER",
                status=MfPipelineStepStatus.running,
            )
        ],
    )
    assert pipeline_run_awaits_worker(run) is False


@pytest.mark.asyncio
async def test_queue_or_launch_does_not_start_in_api_process(monkeypatch):
    logged: list[str] = []

    async def fake_append(run, message, *, level="info"):
        _ = run
        _ = level
        logged.append(message)

    monkeypatch.setattr(
        "app.application.mf.mf_pipeline_orchestrator_service.pipeline_executes_in_this_process",
        lambda: False,
    )
    monkeypatch.setattr(
        "app.application.mf.mf_pipeline_orchestrator_service._append_log",
        fake_append,
    )
    run = MfPipelineRunState(
        run_id="queue-run",
        mode="full",
        triggered_by="TEST",
        status=MfPipelineRunStatus.running,
    )
    await _queue_or_launch(run)
    assert logged == ["Queued for MF scheduler"]
    existing = _execution_tasks.get(run.run_id)
    assert existing is None or existing.done()


@pytest.mark.asyncio
async def test_queue_or_launch_runs_nfo_in_api(monkeypatch):
    launched: list[str] = []
    logged: list[str] = []

    async def fake_append(run, message, *, level="info"):
        _ = run
        _ = level
        logged.append(message)

    async def fake_launch(run, *, from_step_key=None):
        _ = from_step_key
        launched.append(run.run_id)

    monkeypatch.setattr(
        "app.application.mf.mf_pipeline_orchestrator_service.pipeline_executes_in_this_process",
        lambda: False,
    )
    monkeypatch.setattr(
        "app.application.mf.mf_pipeline_orchestrator_service._append_log",
        fake_append,
    )
    monkeypatch.setattr(
        "app.application.mf.mf_pipeline_orchestrator_service._launch_execution",
        fake_launch,
    )
    run = MfPipelineRunState(
        run_id="nfo-run",
        mode="nfo",
        triggered_by="TEST",
        status=MfPipelineRunStatus.running,
    )
    await _queue_or_launch(run)
    assert logged == ["Running NFO pipeline in API"]
    assert launched == ["nfo-run"]


def test_controlled_pause_carries_reason():
    exc = MfPipelineControlledPause(
        pause_reason="awaiting_staging_approval",
        message="Approve the staging batch in the Staging tab, then Resume.",
    )
    assert exc.pause_reason == "awaiting_staging_approval"
    assert "Approve" in exc.message
