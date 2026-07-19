from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.application.mf.mf_transaction_retry import (
    bump_transient_retry,
    is_transient_error,
    should_skip_retry,
)
from app.application.mf.mf_scheduler_metrics import render_catalog_prometheus_metrics
from app.infrastructure.kyc.fp_clients import FpClientError


def test_is_transient_error_timeout() -> None:
    assert is_transient_error(TimeoutError("timed out")) is True


def test_is_transient_error_fp_5xx() -> None:
    assert is_transient_error(FpClientError("down", code="fp_client_error", status_code=503)) is True


def test_is_transient_error_fp_4xx_not_transient() -> None:
    assert is_transient_error(FpClientError("bad request", code="validation_error", status_code=400)) is False


def test_should_skip_retry_before_deadline() -> None:
    future = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    assert should_skip_retry({"ops": {"next_retry_at": future}}) is True


def test_should_skip_retry_after_deadline() -> None:
    past = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    assert should_skip_retry({"ops": {"next_retry_at": past}}) is False


def test_bump_transient_retry_schedules_backoff() -> None:
    meta, terminal = bump_transient_retry(None, error_code="fp_submit_failed", error_message="timeout")
    assert terminal is False
    ops = meta["ops"]
    assert ops["retry_count"] == 1
    assert ops["next_retry_at"] is not None


def test_bump_transient_retry_terminal_after_max() -> None:
    meta = {"ops": {"retry_count": 4}}
    updated, terminal = bump_transient_retry(meta, error_code="fp_submit_failed", error_message="timeout")
    assert terminal is True
    assert updated["ops"]["retry_count"] == 5
    assert updated["ops"]["next_retry_at"] is None


def test_prometheus_metrics_include_transaction_gauges() -> None:
    body = render_catalog_prometheus_metrics(
        {
            "active_products": 10,
            "total_products": 12,
            "stale_nav_funds": 1,
            "orders_24h": 3,
            "nav_job_success": 1,
            "nav_job_failed": 0,
            "cache_hits": 5,
            "cache_misses": 2,
            "cache_hit_rate": 0.714285,
            "zero_active_funds_alert": 0,
            "stuck_orders": 2,
            "stuck_checkouts": 1,
            "stuck_mandates": 0,
            "stuck_sip_plans": 1,
            "failed_orders_24h": 4,
            "failed_webhooks_24h": 2,
        }
    )
    assert "zynd_mf_stuck_orders 2" in body
    assert "zynd_mf_failed_webhooks_24h 2" in body
