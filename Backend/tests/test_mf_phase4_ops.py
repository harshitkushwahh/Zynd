from __future__ import annotations

from datetime import date

from app.application.mf.nav_cold_start_backfill_service import (
    evaluate_nav_history_depth,
    resolve_gap_fill_bounds,
)


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


def test_evaluate_nav_history_depth_needs_gap_fill_when_oldest_is_recent() -> None:
    needed, stats = evaluate_nav_history_depth(
        nav_count=5_000_000,
        mf_count=5000,
        oldest_nav_date=date(2025, 10, 1),
        newest_nav_date=date(2026, 10, 9),
        target_from=date(2006, 4, 1),
        row_threshold=1000,
    )
    assert needed is True
    assert stats["reason"] == "history_span_below_5y"


def test_evaluate_nav_history_depth_skips_when_oldest_already_at_amfi_floor() -> None:
    needed, stats = evaluate_nav_history_depth(
        nav_count=5_000_000,
        mf_count=5000,
        oldest_nav_date=date(2006, 4, 3),
        newest_nav_date=date(2026, 10, 9),
        target_from=date(2006, 4, 1),
        row_threshold=1000,
    )
    assert needed is False
    assert stats["oldest_nav_date"] == "2006-04-03"


def test_resolve_gap_fill_bounds_stops_before_existing_rows() -> None:
    backfill_from, backfill_to = resolve_gap_fill_bounds(
        target_from=date(2006, 4, 1),
        oldest_nav_date=date(2025, 10, 1),
        newest_nav_date=date(2026, 10, 9),
        today=date(2026, 10, 9),
        force=False,
        from_date=None,
        to_date=None,
    )
    assert backfill_from == date(2006, 4, 1)
    assert backfill_to == date(2025, 9, 30)


def test_resolve_gap_fill_bounds_force_runs_through_today() -> None:
    backfill_from, backfill_to = resolve_gap_fill_bounds(
        target_from=date(2006, 4, 1),
        oldest_nav_date=date(2025, 10, 1),
        newest_nav_date=date(2026, 10, 9),
        today=date(2026, 10, 9),
        force=True,
        from_date=None,
        to_date=None,
    )
    assert backfill_from == date(2006, 4, 1)
    assert backfill_to == date(2026, 10, 9)
