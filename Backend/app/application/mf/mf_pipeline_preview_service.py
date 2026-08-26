from __future__ import annotations

from typing import Any

from app.application.mf.catalog_health_service import get_catalog_health
from app.application.mf.mf_pipeline_store import get_running_pipeline_run
from app.application.mf.mf_pipeline_types import PIPELINE_MODES
from app.application.mf.mf_pipeline_window_service import pipeline_manual_window_status
from app.application.mf.mf_scheduler_skip_service import count_stuck_ingestion_runs, scheduler_job_key_for_pipeline_step
from app.core.config import get_settings
from app.core.database import AsyncSessionLocal


def compute_health_diff(before: dict[str, Any] | None, after: dict[str, Any] | None) -> dict[str, Any] | None:
    if not before or not after:
        return None

    before_checks = {item["key"]: item for item in before.get("checks") or []}
    after_checks = {item["key"]: item for item in after.get("checks") or []}
    changes: list[dict[str, Any]] = []

    for key in sorted(set(before_checks) | set(after_checks)):
        before_item = before_checks.get(key, {})
        after_item = after_checks.get(key, {})
        before_count = int(before_item.get("count") or 0)
        after_count = int(after_item.get("count") or 0)
        if before_count == after_count:
            continue
        changes.append(
            {
                "key": key,
                "label": after_item.get("label") or before_item.get("label") or key,
                "severity": after_item.get("severity") or before_item.get("severity"),
                "before": before_count,
                "after": after_count,
                "delta": after_count - before_count,
            }
        )

    def _totals(health: dict[str, Any]) -> dict[str, int]:
        checks = health.get("checks") or []
        summary = health.get("summary") or {}
        return {
            "critical": sum(int(item.get("count") or 0) for item in checks if item.get("severity") == "critical"),
            "warning": sum(int(item.get("count") or 0) for item in checks if item.get("severity") == "warning"),
            "public_blocked": int(summary.get("public_blocked_by_health") or 0),
        }

    before_totals = _totals(before)
    after_totals = _totals(after)
    return {
        "before_totals": before_totals,
        "after_totals": after_totals,
        "totals_delta": {
            key: after_totals[key] - before_totals[key] for key in before_totals if after_totals[key] != before_totals[key]
        },
        "changes": changes,
    }


async def capture_catalog_health_snapshot() -> dict[str, Any]:
    async with AsyncSessionLocal() as session:
        return await get_catalog_health(session)


async def preview_mf_pipeline(mode: str, *, skip_steps: list[str] | None = None) -> dict[str, Any]:
    if mode not in PIPELINE_MODES:
        raise ValueError(f"Unknown pipeline mode: {mode}")

    from app.application.mf.mf_pipeline_orchestrator_service import _build_step_plan

    settings = get_settings()
    steps = _build_step_plan(mode)
    plan_keys = {key for key, _ in steps}
    skip_list = list(dict.fromkeys(skip_steps or []))
    invalid = [key for key in skip_list if key not in plan_keys]
    if invalid:
        raise ValueError(f"Unknown skip_steps for mode {mode}: {invalid}")

    skip_set = set(skip_list)
    blockers: list[str] = []
    window = pipeline_manual_window_status()

    async with AsyncSessionLocal() as session:
        running = await get_running_pipeline_run(session)
        if running:
            blockers.append("Another MF pipeline run is already in progress")
        stuck_count = await count_stuck_ingestion_runs(
            session,
            threshold_hours=settings.zynd_mf_stale_run_cleanup_threshold_hours,
        )
        if stuck_count:
            blockers.append(
                f"{stuck_count} ingestion job(s) appear stuck. Clear stale runs before starting or resuming."
            )

    if window["enforced"] and not window["within_window"]:
        blockers.append(
            f"Manual pipeline runs are only allowed between {window['start']} and {window['end']} IST"
        )

    scheduler_mapped_steps = [
        {
            "key": key,
            "label": label,
            "scheduler_job": mapped,
        }
        for key, label in steps
        if (mapped := scheduler_job_key_for_pipeline_step(key))
    ]
    effective_steps = [
        {"key": key, "label": label, "included": key not in skip_set} for key, label in steps
    ]

    return {
        "mode": mode,
        "dry_run": True,
        "step_count": len(steps),
        "included_step_count": sum(1 for step in effective_steps if step["included"]),
        "steps": [{"key": key, "label": label} for key, label in steps],
        "effective_steps": effective_steps,
        "scheduler_mapped_steps": scheduler_mapped_steps,
        "skip_steps": skip_list,
        "flags": {
            "app_env": settings.app_env,
            "scheme_staging_enabled": settings.zynd_mf_scheme_staging_enabled,
            "scheme_promote_auto": settings.zynd_mf_scheme_promote_auto,
            "requires_production_confirm": settings.app_env == "production",
            "maintenance_window": window,
            "auto_resume_enabled": settings.zynd_mf_pipeline_auto_resume_enabled,
        },
        "blockers": blockers,
        "can_start": not blockers,
    }
