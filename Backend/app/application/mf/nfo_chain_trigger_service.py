from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.ingestion_run_service import latest_successful_run
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

    ok, detected_uuid = await mf_boundary_succeeded_today(session, as_of=as_of)
    if not ok:
        return {"signaled": False, "reason": "mf_boundary_incomplete"}

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
    return {
        "pending_after_mf": state.pending_after_mf,
        "pending_triggered_at": state.pending_triggered_at.isoformat() if state.pending_triggered_at else None,
        "last_mf_run_uuid": str(state.last_mf_run_uuid or mf_uuid) if (state.last_mf_run_uuid or mf_uuid) else None,
        "last_nfo_success_date": state.last_nfo_success_date.isoformat() if state.last_nfo_success_date else None,
        "last_trigger_kind": state.last_trigger_kind,
        "mf_boundary_succeeded_today": boundary_ok,
        "nfo_succeeded_today": state.last_nfo_success_date == today_ist(),
        "fallback_cron": get_settings().zynd_nfo_fallback_cron,
        "timezone": nfo_scheduler_timezone().key,
    }
