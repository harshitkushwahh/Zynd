from __future__ import annotations

from datetime import date


def _build_date_windows(from_date: date, to_date: date, *, days_per_window: int) -> list[tuple[date, date]]:
    from datetime import timedelta

    windows: list[tuple[date, date]] = []
    cursor = from_date
    while cursor <= to_date:
        window_end = min(cursor + timedelta(days=days_per_window - 1), to_date)
        windows.append((cursor, window_end))
        cursor = window_end + timedelta(days=1)
    return windows


def test_build_date_windows_splits_range() -> None:
    windows = _build_date_windows(date(2024, 1, 1), date(2024, 3, 1), days_per_window=31)
    assert windows[0] == (date(2024, 1, 1), date(2024, 1, 31))
    assert windows[-1][1] == date(2024, 3, 1)


def test_prometheus_metrics_renders_latest_job_stats() -> None:
    from datetime import datetime, timezone

    from app.application.mf.mf_scheduler_metrics import render_prometheus_metrics
    from app.infrastructure.persistence.mf_models import IngestionRunLog, IngestionRunStatus

    finished = datetime(2026, 1, 1, tzinfo=timezone.utc)
    run = IngestionRunLog(
        job_name="amfi-nav-daily",
        status=IngestionRunStatus.succeeded,
        triggered_by="SCHEDULER",
        started_at=finished,
        finished_at=finished,
        records_processed=100,
        records_inserted=50,
        records_skipped=50,
    )
    body = render_prometheus_metrics([run])
    assert 'job="amfi-nav-daily"' in body
    assert "zynd_mf_job_last_success" in body
    assert "zynd_mf_job_last_records_inserted" in body
