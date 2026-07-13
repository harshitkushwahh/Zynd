from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.catalog_metrics_service import collect_catalog_prometheus_stats
from app.application.mf.ingestion_run_service import list_recent_runs
from app.infrastructure.persistence.mf_models import IngestionRunLog, IngestionRunStatus


def _duration_seconds(run: IngestionRunLog) -> float | None:
    if run.started_at and run.finished_at:
        return max((run.finished_at - run.started_at).total_seconds(), 0.0)
    metadata = run.metadata_ or {}
    duration = metadata.get("duration_seconds")
    if isinstance(duration, (int, float)):
        return float(duration)
    return None


async def get_mf_prometheus_metrics(session: AsyncSession, *, limit: int = 200) -> str:
    runs = await list_recent_runs(session, limit=limit)
    catalog_stats = await collect_catalog_prometheus_stats(session)
    return render_prometheus_metrics(runs, catalog_stats)


def render_catalog_prometheus_metrics(stats: dict[str, float | int]) -> str:
    lines = [
        "# HELP zynd_mf_active_products Number of ACTIVE mutual fund products.",
        "# TYPE zynd_mf_active_products gauge",
        "# HELP zynd_mf_total_products Total mutual fund products in catalog.",
        "# TYPE zynd_mf_total_products gauge",
        "# HELP zynd_mf_stale_nav_funds Funds flagged with stale NAV.",
        "# TYPE zynd_mf_stale_nav_funds gauge",
        "# HELP zynd_mf_orders_24h MF orders created in the last 24 hours.",
        "# TYPE zynd_mf_orders_24h gauge",
        "# HELP zynd_mf_nav_job_last_success Whether the latest amfi-nav-daily run succeeded (1/0).",
        "# TYPE zynd_mf_nav_job_last_success gauge",
        "# HELP zynd_mf_nav_job_last_failed Whether the latest amfi-nav-daily run failed (1/0).",
        "# TYPE zynd_mf_nav_job_last_failed gauge",
        "# HELP zynd_mf_invest_cache_hits Invest catalog cache hits.",
        "# TYPE zynd_mf_invest_cache_hits counter",
        "# HELP zynd_mf_invest_cache_misses Invest catalog cache misses.",
        "# TYPE zynd_mf_invest_cache_misses counter",
        "# HELP zynd_mf_invest_cache_hit_rate Invest catalog cache hit rate (0-1).",
        "# TYPE zynd_mf_invest_cache_hit_rate gauge",
        "# HELP zynd_mf_zero_active_funds_alert Alert when catalog has products but zero ACTIVE (1/0).",
        "# TYPE zynd_mf_zero_active_funds_alert gauge",
    ]
    lines.append(f"zynd_mf_active_products {stats['active_products']}")
    lines.append(f"zynd_mf_total_products {stats['total_products']}")
    lines.append(f"zynd_mf_stale_nav_funds {stats['stale_nav_funds']}")
    lines.append(f"zynd_mf_orders_24h {stats['orders_24h']}")
    lines.append(f"zynd_mf_nav_job_last_success {stats['nav_job_success']}")
    lines.append(f"zynd_mf_nav_job_last_failed {stats['nav_job_failed']}")
    lines.append(f"zynd_mf_invest_cache_hits {stats['cache_hits']}")
    lines.append(f"zynd_mf_invest_cache_misses {stats['cache_misses']}")
    lines.append(f"zynd_mf_invest_cache_hit_rate {stats['cache_hit_rate']:.6f}")
    lines.append(f"zynd_mf_zero_active_funds_alert {stats['zero_active_funds_alert']}")
    return "\n".join(lines) + "\n"


def render_prometheus_metrics(
    runs: list[IngestionRunLog],
    catalog_stats: dict[str, float | int] | None = None,
) -> str:
    lines = [
        "# HELP zynd_mf_job_last_run_timestamp_seconds Unix timestamp of the last finished MF job run.",
        "# TYPE zynd_mf_job_last_run_timestamp_seconds gauge",
        "# HELP zynd_mf_job_last_duration_seconds Duration of the last finished MF job run.",
        "# TYPE zynd_mf_job_last_duration_seconds gauge",
        "# HELP zynd_mf_job_last_records_processed Records processed in the last finished MF job run.",
        "# TYPE zynd_mf_job_last_records_processed gauge",
        "# HELP zynd_mf_job_last_records_inserted Records inserted in the last finished MF job run.",
        "# TYPE zynd_mf_job_last_records_inserted gauge",
        "# HELP zynd_mf_job_last_success Whether the last finished MF job run succeeded (1/0).",
        "# TYPE zynd_mf_job_last_success gauge",
    ]

    latest_by_job: dict[str, IngestionRunLog] = {}
    for run in runs:
        if run.finished_at is None:
            continue
        existing = latest_by_job.get(run.job_name)
        if existing is None or (existing.finished_at and run.finished_at > existing.finished_at):
            latest_by_job[run.job_name] = run

    for job_name, run in sorted(latest_by_job.items()):
        labels = f'job="{job_name}"'
        finished_ts = run.finished_at.timestamp() if run.finished_at else 0
        duration = _duration_seconds(run) or 0.0
        success = 1 if run.status == IngestionRunStatus.succeeded else 0
        lines.append(f"zynd_mf_job_last_run_timestamp_seconds{{{labels}}} {finished_ts:.3f}")
        lines.append(f"zynd_mf_job_last_duration_seconds{{{labels}}} {duration:.3f}")
        lines.append(f"zynd_mf_job_last_records_processed{{{labels}}} {run.records_processed}")
        lines.append(f"zynd_mf_job_last_records_inserted{{{labels}}} {run.records_inserted}")
        lines.append(f"zynd_mf_job_last_success{{{labels}}} {success}")

    if catalog_stats:
        lines.append(render_catalog_prometheus_metrics(catalog_stats).strip())

    return "\n".join(lines) + "\n"
