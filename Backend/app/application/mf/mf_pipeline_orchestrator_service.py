from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.catalog_health_service import get_catalog_health
from app.application.mf.ingestion_run_service import cleanup_stale_runs
from app.application.mf.mf_pipeline_notify_service import notify_pipeline_event
from app.infrastructure.mf.pipeline_progress import pipeline_progress_sink
from app.application.mf.mf_pipeline_preview_service import (
    capture_catalog_health_snapshot,
    compute_health_diff,
)
from app.application.mf.mf_pipeline_window_service import assert_admin_pipeline_window_allowed
from app.application.mf.mf_pipeline_store import (
    create_pipeline_run,
    get_latest_resumable_pipeline_run,
    get_pipeline_run,
    get_running_pipeline_run,
    recover_interrupted_pipeline_runs,
    save_pipeline_run,
)
from app.application.mf.mf_pipeline_types import (
    BOOTSTRAP_AFTER_INGEST_JOBS,
    FULL_PIPELINE_SEQUENTIAL_JOBS,
    HEALTH_REPAIR_JOBS,
    MAX_MIN_AMOUNTS_BATCHES,
    MfPipelineControlledPause,
    MfPipelineLogLine,
    MfPipelineRunState,
    MfPipelineRunStatus,
    MfPipelineStepState,
    MfPipelineStepStatus,
    NAV_ANALYTICS_ONLY_JOBS,
    PIPELINE_MODES,
    normalize_pipeline_mode,
)
from app.application.mf.mf_scheduler_jobs import build_scheduled_jobs, run_job_once
from app.application.mf.mf_scheduler_skip_service import (
    count_stuck_ingestion_runs,
    is_scheduler_job_skipped_today,
    mark_scheduler_jobs_skipped,
    scheduler_job_key_for_pipeline_step,
)
from app.application.mf.scheme_compliance_service import seed_all_tax_compliance
from app.application.mf.scheme_staging_ingest_service import run_cybrilla_scheme_ingest
from app.application.mf.scheme_staging_promote_service import run_cybrilla_scheme_promote
from app.application.mf.scheme_staging_validate_service import run_cybrilla_scheme_validate
from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.infrastructure.persistence.mf_models import IngestionRunLog

logger = logging.getLogger(__name__)

_pipeline_lock = asyncio.Lock()
_execution_tasks: dict[str, asyncio.Task] = {}
INGESTION_TRIGGERED_BY_MAX_LEN = 64


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _pipeline_triggered_by(run: MfPipelineRunState) -> str:
    value = f"PIPELINE:{run.run_id}"
    if len(value) > INGESTION_TRIGGERED_BY_MAX_LEN:
        raise ValueError(f"Pipeline triggered_by value exceeds {INGESTION_TRIGGERED_BY_MAX_LEN} characters")
    return value


def _job_step_was_skipped(result: dict) -> bool:
    """True when a scheduler job bailed out early (not record-level skip counts)."""
    return bool(result.get("reason")) and bool(result.get("skipped"))


def _capture_ingestion_link(step: MfPipelineStepState, result: dict | None) -> None:
    if not result:
        return
    run_uuid = result.get("run_uuid")
    if run_uuid:
        step.ingestion_run_uuid = str(run_uuid)


async def _tag_ingestion_run_pipeline(
    session: AsyncSession,
    ingestion_run_uuid: str,
    pipeline_run_id: str,
) -> None:
    row = await session.scalar(
        select(IngestionRunLog).where(IngestionRunLog.run_uuid == uuid.UUID(ingestion_run_uuid))
    )
    if row is None:
        return
    metadata = dict(row.metadata_ or {})
    metadata["pipeline_run_uuid"] = pipeline_run_id
    row.metadata_ = metadata


async def _finalize_step_success(
    run: MfPipelineRunState,
    step: MfPipelineStepState,
    *,
    result: dict | None,
    session: AsyncSession | None = None,
) -> None:
    _capture_ingestion_link(step, result)
    if step.ingestion_run_uuid and session is not None:
        await _tag_ingestion_run_pipeline(session, step.ingestion_run_uuid, run.run_id)
    await _set_step_status(run, step, MfPipelineStepStatus.succeeded, result=result)


def _append_job_steps(steps: list[tuple[str, str]], job_names: tuple[str, ...]) -> None:
    for job_name in job_names:
        steps.append((job_name, job_name.replace("-", " ")))


def _build_step_plan(mode: str) -> list[tuple[str, str]]:
    normalized = normalize_pipeline_mode(mode)
    settings = get_settings()
    steps: list[tuple[str, str]] = [("cleanup-stale-runs", "Clean stale ingestion runs")]

    if normalized == "staging-only":
        if settings.zynd_mf_scheme_staging_enabled:
            steps.extend(
                [
                    ("cybrilla-scheme-ingest", "Cybrilla scheme ingest → Mongo staging"),
                    ("cybrilla-scheme-validate", "Validate staged Cybrilla schemes"),
                ]
            )
        elif settings.zynd_mf_scheme_sync_enabled:
            steps.append(("cybrilla-scheme-sync", "Cybrilla scheme sync → SQL"))
        return steps

    if normalized == "nav-analytics-only":
        _append_job_steps(steps, NAV_ANALYTICS_ONLY_JOBS)
        steps.extend(
            [
                ("final-counts", "Collect final catalog counts"),
                ("catalog-health", "Run catalog health check"),
            ]
        )
        return steps

    if normalized == "health-repair":
        _append_job_steps(steps, HEALTH_REPAIR_JOBS)
        steps.append(("catalog-health", "Run catalog health check"))
        return steps

    if normalized == "full" and settings.zynd_mf_scheme_staging_enabled:
        steps.extend(
            [
                ("cybrilla-scheme-ingest", "Cybrilla scheme ingest → Mongo staging"),
                ("cybrilla-scheme-validate", "Validate staged Cybrilla schemes"),
                ("cybrilla-scheme-promote", "Promote validated schemes → SQL (draft)"),
            ]
        )
    elif normalized == "full":
        steps.append(("cybrilla-scheme-sync", "Cybrilla scheme sync → SQL"))
    elif normalized == "bootstrap":
        steps.extend(
            [
                ("cybrilla-scheme-validate", "Validate staged Cybrilla schemes"),
                ("cybrilla-scheme-promote", "Promote validated schemes → SQL (draft)"),
            ]
        )

    if settings.app_env == "development":
        steps.append(("empanel-amcs", "Empanel AMCs (development)"))

    job_list = FULL_PIPELINE_SEQUENTIAL_JOBS if normalized == "full" else BOOTSTRAP_AFTER_INGEST_JOBS
    for job_name in job_list:
        steps.append((job_name, job_name.replace("-", " ")))

    if normalized == "bootstrap":
        steps.append(("scheme-min-amounts-backfill-loop", "Backfill scheme min amounts (batched)"))

    steps.extend(
        [
            ("seed-tax-compliance", "Seed tax and compliance templates"),
            ("final-counts", "Collect final catalog counts"),
            ("catalog-health", "Run catalog health check"),
        ]
    )
    return steps


async def _persist_run(run: MfPipelineRunState) -> None:
    async with AsyncSessionLocal() as session:
        await save_pipeline_run(session, run)
        await session.commit()


async def _append_log(run: MfPipelineRunState, message: str, *, level: str = "info") -> None:
    run.logs.append(MfPipelineLogLine(timestamp=_utc_now_iso(), level=level, message=message))
    if run.log_sink:
        run.log_sink(message, level)
    await _persist_run(run)


async def _set_step_status(
    run: MfPipelineRunState,
    step: MfPipelineStepState,
    status: MfPipelineStepStatus,
    *,
    result: dict | None = None,
    error: str | None = None,
) -> None:
    step.status = status
    step.result = result
    step.error = error
    if status == MfPipelineStepStatus.running:
        run.current_step_key = step.key
        await _append_log(run, f"▶ {step.label}")
    elif status == MfPipelineStepStatus.succeeded:
        await _append_log(run, f"✓ {step.label}", level="success")
    elif status == MfPipelineStepStatus.skipped:
        await _append_log(run, f"○ {step.label} (skipped)", level="warning")
    elif status == MfPipelineStepStatus.failed:
        await _append_log(run, f"✗ {step.label}: {error or 'failed'}", level="error")
    else:
        await _persist_run(run)


async def _check_blockers(*, auto_cleanup_stale: bool = False, except_run_id: str | None = None) -> None:
    settings = get_settings()
    async with AsyncSessionLocal() as session:
        running = await get_running_pipeline_run(session)
        if running and (except_run_id is None or running.run_id != except_run_id):
            raise RuntimeError("Another MF pipeline run is already in progress")

        stuck = await cleanup_stale_runs(session, threshold_hours=0) if auto_cleanup_stale else 0
        if auto_cleanup_stale:
            await session.commit()
            if stuck:
                logger.info("Auto-cleaned %s stale ingestion run(s) before pipeline", stuck)

        stuck_count = await count_stuck_ingestion_runs(
            session,
            threshold_hours=settings.zynd_mf_stale_run_cleanup_threshold_hours,
        )
        if stuck_count:
            raise RuntimeError(
                f"{stuck_count} ingestion job(s) appear stuck. Clear stale runs before starting or resuming."
            )


async def clear_stuck_ingestion_runs(*, threshold_hours: int | None = None) -> int:
    settings = get_settings()
    hours = settings.zynd_mf_stale_run_cleanup_threshold_hours if threshold_hours is None else threshold_hours
    async with AsyncSessionLocal() as session:
        cleaned = await cleanup_stale_runs(session, threshold_hours=hours)
        await session.commit()

    from app.application.mf.mf_pipeline_auto_resume_service import try_auto_resume_latest_eligible

    await try_auto_resume_latest_eligible(source="clear_stuck")
    return cleaned


async def _run_job_step(session: AsyncSession, job_name: str, *, triggered_by: str) -> dict:
    return await run_job_once(
        session,
        job_name,
        triggered_by=triggered_by,
        skip_dependency_check=True,
    )


async def _fetch_final_counts(session: AsyncSession) -> dict:
    rows = await session.execute(
        text(
            """
            SELECT
              (SELECT count(*) FROM products) AS products,
              (SELECT count(*) FROM mutual_funds) AS funds,
              (SELECT count(*) FROM products WHERE lifecycle_status='ACTIVE') AS active,
              (SELECT count(*) FROM fund_amcs WHERE is_active) AS amcs,
              (SELECT count(*) FROM scheme_navs) AS nav_rows,
              (SELECT count(*) FROM fund_nav_metrics) AS metrics,
              (SELECT count(*) FROM fund_derived_attributes) AS derived_attrs,
              (SELECT count(*) FROM scheme_compliance_facts) AS compliance,
              (SELECT count(*) FROM scheme_aums) AS aum_rows,
              (SELECT count(*) FROM scheme_ter) AS ter_rows,
              (SELECT count(*) FROM mutual_funds WHERE min_sip_amount IS NOT NULL) AS funds_with_min_sip,
              (SELECT count(*) FROM mutual_funds WHERE investment_constraints IS NOT NULL) AS funds_with_investment_details
            """
        )
    )
    return dict(rows.mappings().one())


async def _run_staging_ingest(
    session: AsyncSession,
    *,
    triggered_by: str,
) -> dict:
    result = await run_cybrilla_scheme_ingest(session, triggered_by=triggered_by)
    if result.get("skipped"):
        raise RuntimeError(f"Staging ingest skipped: {result.get('reason')}")
    return result


async def _run_staging_validate(
    session: AsyncSession,
    *,
    triggered_by: str,
    batch_uuid: str | None = None,
) -> dict:
    kwargs: dict = {"triggered_by": triggered_by}
    if batch_uuid:
        kwargs["batch_uuid"] = batch_uuid
    result = await run_cybrilla_scheme_validate(session, **kwargs)
    if result.get("skipped"):
        raise RuntimeError(f"Staging validate skipped: {result.get('reason')}")
    return result


async def _run_staging_promote(
    session: AsyncSession,
    *,
    triggered_by: str,
    batch_uuid: str | None,
) -> dict:
    settings = get_settings()
    return await run_cybrilla_scheme_promote(
        session,
        triggered_by=triggered_by,
        batch_uuid=batch_uuid,
        force=settings.zynd_mf_scheme_promote_auto,
    )


async def _empanel_amcs(session: AsyncSession) -> None:
    await session.execute(text("UPDATE fund_amcs SET is_active = true WHERE admin_kill_switch = false"))


def _iter_executable_steps(run: MfPipelineRunState, *, from_step_key: str | None = None) -> list[MfPipelineStepState]:
    steps = run.steps
    if from_step_key:
        start_index = next((index for index, step in enumerate(steps) if step.key == from_step_key), None)
        if start_index is None:
            raise ValueError(f"Unknown pipeline step: {from_step_key}")
        steps = steps[start_index:]
    return [
        step
        for step in steps
        if step.status not in {MfPipelineStepStatus.succeeded, MfPipelineStepStatus.skipped}
    ]


async def _execute_step(run: MfPipelineRunState, step: MfPipelineStepState, context: dict) -> None:
    triggered_by = _pipeline_triggered_by(run)

    if step.key == "cleanup-stale-runs":
        async with AsyncSessionLocal() as session:
            cleaned = await cleanup_stale_runs(session, threshold_hours=0)
            await session.commit()
        await _set_step_status(run, step, MfPipelineStepStatus.succeeded, result={"cleaned": cleaned})
        return

    if step.key == "cybrilla-scheme-ingest":
        async with AsyncSessionLocal() as session:
            result = await _run_staging_ingest(session, triggered_by=triggered_by)
            context["batch_uuid"] = result.get("batch_uuid")
            await _tag_ingestion_run_pipeline(session, str(result["run_uuid"]), run.run_id)
            await session.commit()
        await _finalize_step_success(run, step, result=result)
        return

    if step.key == "cybrilla-scheme-validate":
        async with AsyncSessionLocal() as session:
            result = await _run_staging_validate(
                session,
                triggered_by=triggered_by,
                batch_uuid=context.get("batch_uuid"),
            )
            context["batch_uuid"] = result.get("batch_uuid") or context.get("batch_uuid")
            await _tag_ingestion_run_pipeline(session, str(result["run_uuid"]), run.run_id)
            await session.commit()
        await _finalize_step_success(run, step, result=result)
        return

    if step.key == "cybrilla-scheme-promote":
        async with AsyncSessionLocal() as session:
            result = await _run_staging_promote(
                session,
                triggered_by=triggered_by,
                batch_uuid=context.get("batch_uuid"),
            )
            if result.get("skipped") and result.get("reason") == "pending_approval":
                batch_uuid = result.get("batch_uuid") or context.get("batch_uuid")
                if batch_uuid:
                    context["batch_uuid"] = batch_uuid
                context["pause_reason"] = "awaiting_staging_approval"
                run.context = context
                await _set_step_status(
                    run,
                    step,
                    MfPipelineStepStatus.pending,
                    result=result,
                    error="Awaiting staging batch approval",
                )
                raise MfPipelineControlledPause(
                    pause_reason="awaiting_staging_approval",
                    message="Approve the staging batch in the Staging tab, then Resume.",
                )
            if result.get("skipped"):
                raise RuntimeError(f"Staging promote skipped: {result.get('reason')}")
            await _tag_ingestion_run_pipeline(session, str(result["run_uuid"]), run.run_id)
            await session.commit()
        await _finalize_step_success(run, step, result=result)
        return

    if step.key == "empanel-amcs":
        async with AsyncSessionLocal() as session:
            await _empanel_amcs(session)
            await session.commit()
        await _set_step_status(run, step, MfPipelineStepStatus.succeeded, result={"empanelled": True})
        return

    if step.key == "scheme-min-amounts-backfill-loop":
        total_updated = 0
        last_result: dict = {}
        for batch_num in range(1, MAX_MIN_AMOUNTS_BATCHES + 1):
            if run._cancel_requested:
                break
            async with AsyncSessionLocal() as session:
                last_result = await _run_job_step(session, "scheme-min-amounts-backfill", triggered_by=triggered_by)
                await session.commit()
            updated = int(last_result.get("updated", 0))
            total_updated += updated
            await _append_log(run, f"scheme-min-amounts-backfill batch {batch_num}: updated {updated}")
            if updated == 0:
                break
        _capture_ingestion_link(step, last_result)
        await _set_step_status(
            run,
            step,
            MfPipelineStepStatus.succeeded,
            result={"total_updated": total_updated, "last": last_result},
        )
        return

    if step.key == "seed-tax-compliance":
        async with AsyncSessionLocal() as session:
            count = await seed_all_tax_compliance(session)
            await session.commit()
        await _set_step_status(run, step, MfPipelineStepStatus.succeeded, result={"seeded": count})
        return

    if step.key == "final-counts":
        async with AsyncSessionLocal() as session:
            counts = await _fetch_final_counts(session)
        run.final_counts = counts
        await _set_step_status(run, step, MfPipelineStepStatus.succeeded, result=counts)
        return

    if step.key == "catalog-health":
        async with AsyncSessionLocal() as session:
            health = await get_catalog_health(session)
        run.health_summary = health
        await _set_step_status(run, step, MfPipelineStepStatus.succeeded, result=health)
        return

    async with AsyncSessionLocal() as session:
        result = await _run_job_step(session, step.key, triggered_by=triggered_by)
        if result.get("run_uuid"):
            await _tag_ingestion_run_pipeline(session, str(result["run_uuid"]), run.run_id)
        await session.commit()
    if _job_step_was_skipped(result):
        await _set_step_status(
            run,
            step,
            MfPipelineStepStatus.skipped,
            result=result,
            error=str(result.get("reason") or "skipped"),
        )
    else:
        await _finalize_step_success(run, step, result=result)


async def _record_scheduler_skips(run: MfPipelineRunState) -> None:
    job_names: set[str] = set()
    for step in run.steps:
        if step.status != MfPipelineStepStatus.succeeded:
            continue
        mapped = scheduler_job_key_for_pipeline_step(step.key)
        if mapped:
            job_names.add(mapped)

    async with AsyncSessionLocal() as session:
        await mark_scheduler_jobs_skipped(
            session,
            job_names=job_names,
            source="pipeline",
            pipeline_run_id=run.run_id,
        )
        await session.commit()


async def _execute_pipeline_run(run: MfPipelineRunState, *, from_step_key: str | None = None) -> None:
    context = dict(run.context or {})
    run.context = context
    run.status = MfPipelineRunStatus.running
    if not run.started_at:
        run.started_at = _utc_now_iso()
    run.finished_at = None
    run.error = None
    context.pop("pause_reason", None)
    if not from_step_key and "health_before" not in context:
        context["health_before"] = await capture_catalog_health_snapshot()
    await _append_log(
        run,
        f"{'Resuming' if from_step_key else 'Starting'} MF pipeline ({run.mode})",
    )
    await notify_pipeline_event(run, event="resumed" if from_step_key else "started")

    notify_event: str | None = None
    notify_pause_reason: str | None = None

    async def _progress_sink(message: str) -> None:
        await _append_log(run, message)

    try:
        async with pipeline_progress_sink(_progress_sink):
            skip_steps = set(context.get("skip_steps") or [])
            for step in _iter_executable_steps(run, from_step_key=from_step_key):
                if step.key in skip_steps:
                    await _set_step_status(
                        run,
                        step,
                        MfPipelineStepStatus.skipped,
                        error="Skipped by operator override",
                    )
                    continue

                if run._cancel_requested:
                    run.status = MfPipelineRunStatus.cancelled
                    run.error = "Cancelled by operator"
                    run.finished_at = _utc_now_iso()
                    await _append_log(run, "Pipeline cancelled — resume later from next step", level="warning")
                    notify_event = "cancelled"
                    return

                if step.status == MfPipelineStepStatus.failed:
                    step.status = MfPipelineStepStatus.pending
                    step.error = None

                await _set_step_status(run, step, MfPipelineStepStatus.running)

                try:
                    await _execute_step(run, step, context)
                    mapped = scheduler_job_key_for_pipeline_step(step.key)
                    if mapped and step.status == MfPipelineStepStatus.succeeded:
                        pass
                except MfPipelineControlledPause as exc:
                    run.status = MfPipelineRunStatus.paused
                    run.error = exc.message
                    context["pause_reason"] = exc.pause_reason
                    run.finished_at = _utc_now_iso()
                    run.context = context
                    await _append_log(run, exc.message, level="warning")
                    notify_event = "paused"
                    notify_pause_reason = exc.pause_reason
                    return
                except Exception as exc:
                    logger.exception("MF pipeline step failed step=%s", step.key)
                    await _set_step_status(run, step, MfPipelineStepStatus.failed, error=str(exc))
                    run.status = MfPipelineRunStatus.paused
                    run.error = str(exc)
                    context.pop("pause_reason", None)
                    run.finished_at = _utc_now_iso()
                    run.context = context
                    await _append_log(
                        run,
                        "Pipeline paused due to error — fix the issue, then Resume or Retry step",
                        level="warning",
                    )
                    notify_event = "failed"
                    return

            run.status = MfPipelineRunStatus.succeeded
            run.finished_at = _utc_now_iso()
            run.current_step_key = None
            context.pop("pause_reason", None)
            health_after = await capture_catalog_health_snapshot()
            context["health_after"] = health_after
            context["health_diff"] = compute_health_diff(context.get("health_before"), health_after)
            run.context = context
            await _append_log(run, "Pipeline completed successfully", level="success")
            await _record_scheduler_skips(run)
            notify_event = "completed"

    finally:
        run.context = context
        await _persist_run(run)
        _execution_tasks.pop(run.run_id, None)
        if notify_event:
            await notify_pipeline_event(
                run,
                event=notify_event,  # type: ignore[arg-type]
                pause_reason=notify_pause_reason,
            )


async def _mark_run_running(run: MfPipelineRunState) -> None:
    run.status = MfPipelineRunStatus.running
    run.error = None
    run.finished_at = None
    async with AsyncSessionLocal() as session:
        await save_pipeline_run(session, run)
        await session.commit()


def _assert_execution_not_active(run_id: str) -> None:
    existing = _execution_tasks.get(run_id)
    if existing is not None and not existing.done():
        raise RuntimeError("Pipeline run is already in progress")


async def _launch_execution(run: MfPipelineRunState, *, from_step_key: str | None = None) -> None:
    _assert_execution_not_active(run.run_id)
    task = asyncio.create_task(_execute_pipeline_run(run, from_step_key=from_step_key))
    _execution_tasks[run.run_id] = task


async def initialize_pipeline_orchestrator() -> None:
    async with AsyncSessionLocal() as session:
        recovered = await recover_interrupted_pipeline_runs(session)
        await session.commit()
        if recovered:
            logger.warning("Recovered %s interrupted MF pipeline run(s) as paused", recovered)


async def start_mf_pipeline_run(
    *,
    mode: str = "full",
    triggered_by: str = "ADMIN",
    actor_user_id: str | None = None,
    skip_steps: list[str] | None = None,
    auto_resume: bool = True,
) -> MfPipelineRunState:
    if mode not in PIPELINE_MODES:
        raise ValueError(f"Unknown pipeline mode: {mode}")

    settings = get_settings()
    assert_admin_pipeline_window_allowed(triggered_by=triggered_by)

    plan = _build_step_plan(mode)
    plan_keys = {key for key, _ in plan}
    skip_list = list(dict.fromkeys(skip_steps or []))
    if len(skip_list) > settings.zynd_mf_pipeline_max_skip_steps:
        raise ValueError(f"Too many skip_steps (max {settings.zynd_mf_pipeline_max_skip_steps})")
    invalid = [key for key in skip_list if key not in plan_keys]
    if invalid:
        raise ValueError(f"Unknown skip_steps for mode {mode}: {invalid}")

    async with _pipeline_lock:
        await _check_blockers()
        steps = [MfPipelineStepState(key=key, label=label) for key, label in plan]
        async with AsyncSessionLocal() as session:
            run = await create_pipeline_run(session, mode=mode, triggered_by=triggered_by, steps=steps)
            run.context["skip_steps"] = skip_list
            run.context["auto_resume"] = auto_resume
            if actor_user_id:
                run.context["actor_user_id"] = actor_user_id
            await save_pipeline_run(session, run)
            await session.commit()

    await _mark_run_running(run)
    await _launch_execution(run)
    return run


async def approve_mf_pipeline_staging(run_id: str, *, admin_user_id: UUID) -> MfPipelineRunState:
    from app.application.mf.scheme_staging_admin_service import approve_scheme_staging_batch, get_scheme_staging_batch

    async with AsyncSessionLocal() as session:
        run = await get_pipeline_run(session, run_id)
        if not run:
            raise ValueError(f"Pipeline run not found: {run_id}")
        if run.context.get("pause_reason") != "awaiting_staging_approval":
            raise RuntimeError("Pipeline is not awaiting staging approval")
        batch_uuid = run.context.get("batch_uuid")
        if not batch_uuid:
            raise RuntimeError("No staging batch linked to pipeline run")

    batch = await get_scheme_staging_batch(batch_uuid)
    if not batch:
        raise RuntimeError("Staging batch not found")
    if batch.get("status") == "validated":
        await approve_scheme_staging_batch(
            batch_uuid,
            admin_user_id=admin_user_id,
            auto_resume_pipeline=False,
        )
    elif batch.get("status") != "approved":
        raise RuntimeError(f"Batch cannot be approved (status={batch.get('status')})")
    return await resume_mf_pipeline_run(run_id)


async def resume_mf_pipeline_run(run_id: str) -> MfPipelineRunState:
    _assert_execution_not_active(run_id)
    async with _pipeline_lock:
        await _check_blockers(except_run_id=run_id)
        async with AsyncSessionLocal() as session:
            run = await get_pipeline_run(session, run_id)
            if not run:
                raise ValueError(f"Pipeline run not found: {run_id}")
            if run.status == MfPipelineRunStatus.running:
                raise RuntimeError("Pipeline run is already in progress")
            if run.status == MfPipelineRunStatus.succeeded:
                raise RuntimeError("Pipeline run already completed successfully")

    await _mark_run_running(run)
    await _launch_execution(run)
    return run


async def retry_mf_pipeline_step(run_id: str, step_key: str) -> MfPipelineRunState:
    _assert_execution_not_active(run_id)
    async with _pipeline_lock:
        await _check_blockers(except_run_id=run_id)
        async with AsyncSessionLocal() as session:
            run = await get_pipeline_run(session, run_id)
            if not run:
                raise ValueError(f"Pipeline run not found: {run_id}")
            if run.status == MfPipelineRunStatus.running:
                raise RuntimeError("Pipeline run is already in progress")

            step = next((item for item in run.steps if item.key == step_key), None)
            if not step:
                raise ValueError(f"Unknown pipeline step: {step_key}")
            step.status = MfPipelineStepStatus.pending
            step.error = None
            run.error = None
            await save_pipeline_run(session, run)
            await session.commit()

    await _mark_run_running(run)
    await _launch_execution(run, from_step_key=step_key)
    return run


async def get_mf_pipeline_run(run_id: str) -> MfPipelineRunState | None:
    async with AsyncSessionLocal() as session:
        return await get_pipeline_run(session, run_id)


async def get_active_mf_pipeline_run() -> MfPipelineRunState | None:
    async with AsyncSessionLocal() as session:
        running = await get_running_pipeline_run(session)
        if running:
            return running
        return await get_latest_resumable_pipeline_run(session)


async def cancel_mf_pipeline_run(run_id: str) -> MfPipelineRunState | None:
    run = await get_mf_pipeline_run(run_id)
    if not run:
        return None
    run._cancel_requested = True
    await _append_log(run, "Cancel requested — stopping after current step", level="warning")
    return run


async def run_mf_pipeline_sync(*, mode: str = "full", triggered_by: str = "CLI") -> MfPipelineRunState:
    def _print_log(message: str, level: str = "info") -> None:
        prefix = {"success": "✓ ", "warning": "! ", "error": "✗ "}.get(level, "")
        print(f"{prefix}{message}", flush=True)

    async with _pipeline_lock:
        await _check_blockers(auto_cleanup_stale=True)
        steps = [MfPipelineStepState(key=key, label=label) for key, label in _build_step_plan(mode)]
        async with AsyncSessionLocal() as session:
            run = await create_pipeline_run(session, mode=mode, triggered_by=triggered_by, steps=steps)
            await session.commit()

    run.log_sink = _print_log
    await _execute_pipeline_run(run)

    if run.status == MfPipelineRunStatus.paused:
        raise RuntimeError(run.error or "MF pipeline paused due to error")

    return run


def daily_scheduler_job_names() -> set[str]:
    return {job.name for job in build_scheduled_jobs() if job.enabled}
