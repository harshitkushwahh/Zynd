from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.ingestion_run_service import latest_successful_run
from app.application.mf.mf_pipeline_store import get_running_pipeline_run
from app.application.mf.mf_scheduler_jobs import build_scheduled_jobs, last_scheduled_time
from app.application.mf.mf_scheduler_skip_service import is_scheduler_job_skipped_today
from app.application.mf.nfo_ingestion_mutex_service import running_mf_family_jobs
from app.application.mf.nfo_detection_service import NFO_JOB_NAMES
from app.core.config import get_settings
from app.infrastructure.persistence.mf_models import NfoSchedulerState

logger = logging.getLogger(__name__)

STATE_ID = 1


def nfo_scheduler_timezone():
    settings = get_settings()
    try:
        return ZoneInfo(settings.zynd_nfo_scheduler_timezone or "Asia/Kolkata")
    except ZoneInfoNotFoundError:
        return ZoneInfo("Asia/Kolkata")


def today_ist(now: datetime | None = None) -> date:
    current = now or datetime.now(timezone.utc)
    return current.astimezone(nfo_scheduler_timezone()).date()


def mf_boundary_job_names() -> list[str]:
    settings = get_settings()
    raw = settings.zynd_nfo_mf_boundary_jobs or ""
    return [part.strip() for part in raw.split(",") if part.strip()]


_HOUSEKEEPING_JOBS = frozenset({"stale-run-cleanup"})


def cron_fires_every_calendar_day(cron_expr: str) -> bool:
    parts = cron_expr.split()
    return len(parts) == 5 and parts[2] == "*" and parts[3] == "*" and parts[4] == "*"


def _today_start_utc(as_of: date) -> datetime:
    start = datetime.combine(as_of, datetime.min.time(), tzinfo=nfo_scheduler_timezone())
    return start.astimezone(timezone.utc)


async def mf_ready_for_auto_nfo(
    session: AsyncSession,
    *,
    as_of: date | None = None,
    now: datetime | None = None,
) -> tuple[bool, str]:
    """Auto NFO may start only after today's MF scheduler work has finished."""
    today = as_of or today_ist()
    current = now or datetime.now(timezone.utc)
    since = _today_start_utc(today)

    running_pipeline = await get_running_pipeline_run(session, nfo_only=False)
    if running_pipeline is not None:
        return False, f"mf_pipeline_running:{running_pipeline.run_id}"

    running_jobs = [name for name in await running_mf_family_jobs(session) if name not in NFO_JOB_NAMES]
    if running_jobs:
        return False, f"mf_job_running:{','.join(sorted(running_jobs))}"

    pending: list[str] = []
    for job in build_scheduled_jobs():
        if not job.enabled or job.name in _HOUSEKEEPING_JOBS:
            continue
        scheduled_at = last_scheduled_time(job.cron, now=current)
        fires_today = scheduled_at.astimezone(nfo_scheduler_timezone()).date() == today
        required_today = cron_fires_every_calendar_day(job.cron) or fires_today
        if not required_today:
            continue
        if await is_scheduler_job_skipped_today(session, job.name):
            continue
        if await latest_successful_run(session, job.name, since=since) is None:
            pending.append(job.name)
    if pending:
        return False, f"mf_jobs_incomplete:{','.join(pending)}"
    return True, "mf_scheduler_complete"


async def get_or_create_state(session: AsyncSession) -> NfoSchedulerState:
    row = await session.get(NfoSchedulerState, STATE_ID)
    if row is not None:
        return row
    row = NfoSchedulerState(id=STATE_ID, pending_after_mf=False)
    session.add(row)
    await session.flush()
    return row


async def mf_boundary_succeeded_today(session: AsyncSession, *, as_of: date | None = None) -> tuple[bool, uuid.UUID | None]:
    start = datetime.combine(as_of or today_ist(), datetime.min.time(), tzinfo=nfo_scheduler_timezone())
    start_utc = start.astimezone(timezone.utc)
    last_uuid: uuid.UUID | None = None
    for job_name in mf_boundary_job_names():
        run = await latest_successful_run(session, job_name, since=start_utc)
        if run is None:
            return False, None
        last_uuid = run.run_uuid
    return True, last_uuid


async def nfo_already_succeeded_today(session: AsyncSession, *, as_of: date | None = None) -> bool:
    state = await get_or_create_state(session)
    return state.last_nfo_success_date == (as_of or today_ist())


async def signal_nfo_after_mf_success(
    session: AsyncSession,
    *,
    mf_run_uuid: uuid.UUID | None = None,
) -> dict[str, bool | str]:
    settings = get_settings()
    if not settings.zynd_nfo_ingestion_enabled or not settings.zynd_nfo_chain_after_mf_enabled:
        return {"signaled": False, "reason": "nfo_chain_disabled"}

    as_of = today_ist()
    if await nfo_already_succeeded_today(session, as_of=as_of):
        return {"signaled": False, "reason": "nfo_already_ran_today"}

    ready, reason = await mf_ready_for_auto_nfo(session, as_of=as_of)
    if not ready:
        return {"signaled": False, "reason": reason}
    _ok, detected_uuid = await mf_boundary_succeeded_today(session, as_of=as_of)

    state = await get_or_create_state(session)
    if state.pending_after_mf:
        return {"signaled": False, "reason": "already_pending"}

    state.pending_after_mf = True
    state.pending_triggered_at = datetime.now(timezone.utc)
    state.last_mf_run_uuid = mf_run_uuid or detected_uuid
    state.last_trigger_kind = "chain"
    logger.info("NFO chain trigger armed after MF success as_of=%s", as_of)
    return {"signaled": True, "reason": "armed"}


async def consume_pending_chain(session: AsyncSession) -> bool:
    state = await get_or_create_state(session)
    if not state.pending_after_mf:
        return False
    state.pending_after_mf = False
    return True


async def mark_nfo_success(session: AsyncSession, *, trigger_kind: str) -> None:
    state = await get_or_create_state(session)
    state.last_nfo_success_date = today_ist()
    state.last_trigger_kind = trigger_kind
    state.pending_after_mf = False
    state.pending_triggered_at = None


async def scheduler_status_payload(session: AsyncSession) -> dict:
    state = await get_or_create_state(session)
    boundary_ok, mf_uuid = await mf_boundary_succeeded_today(session)
    ready, ready_reason = await mf_ready_for_auto_nfo(session)
    return {
        "pending_after_mf": state.pending_after_mf,
        "pending_triggered_at": state.pending_triggered_at.isoformat() if state.pending_triggered_at else None,
        "last_mf_run_uuid": str(state.last_mf_run_uuid or mf_uuid) if (state.last_mf_run_uuid or mf_uuid) else None,
        "last_nfo_success_date": state.last_nfo_success_date.isoformat() if state.last_nfo_success_date else None,
        "last_trigger_kind": state.last_trigger_kind,
        "mf_boundary_succeeded_today": boundary_ok,
        "mf_ready_for_auto_nfo": ready,
        "mf_ready_reason": ready_reason,
        "nfo_succeeded_today": state.last_nfo_success_date == today_ist(),
        "fallback_cron": get_settings().zynd_nfo_fallback_cron,
        "timezone": nfo_scheduler_timezone().key,
    }
