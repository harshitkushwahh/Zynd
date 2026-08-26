from __future__ import annotations

import pytest

from app.application.mf.mf_pipeline_preview_service import compute_health_diff, preview_mf_pipeline


def test_compute_health_diff_reports_changes():
    before = {
        "summary": {"stale_nav": 5, "public_blocked_by_health": 2},
        "checks": [
            {"key": "stale_nav", "label": "Stale NAV", "severity": "critical", "count": 5},
            {"key": "missing_3y_metrics", "label": "Missing 3Y metrics", "severity": "warning", "count": 1},
        ],
    }
    after = {
        "summary": {"stale_nav": 2, "public_blocked_by_health": 1},
        "checks": [
            {"key": "stale_nav", "label": "Stale NAV", "severity": "critical", "count": 2},
            {"key": "missing_3y_metrics", "label": "Missing 3Y metrics", "severity": "warning", "count": 1},
        ],
    }

    diff = compute_health_diff(before, after)
    assert diff is not None
    assert diff["before_totals"]["critical"] == 5
    assert diff["after_totals"]["critical"] == 2
    assert diff["totals_delta"]["critical"] == -3
    assert diff["totals_delta"]["public_blocked"] == -1
    assert any(change["key"] == "stale_nav" and change["delta"] == -3 for change in diff["changes"])


@pytest.mark.asyncio
async def test_preview_mf_pipeline_is_dry_run(monkeypatch):
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
    assert preview["dry_run"] is True
    assert preview["step_count"] > 0
    assert preview["effective_steps"][0]["key"] == "cleanup-stale-runs"
    assert preview["can_start"] is True


def test_compute_health_diff_returns_none_without_snapshots():
    assert compute_health_diff(None, {"checks": []}) is None
