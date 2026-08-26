from __future__ import annotations

import logging
from typing import Literal
from uuid import UUID

from app.application.auth.audit_service import write_audit
from app.application.mf.mf_pipeline_types import MfPipelineRunState
from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.infrastructure.notifications.email_service import send_security_email
from app.infrastructure.persistence.models import AuditEventType

logger = logging.getLogger(__name__)

PipelineEvent = Literal["started", "resumed", "paused", "completed", "failed", "cancelled"]


def _event_subject(run: MfPipelineRunState, event: PipelineEvent) -> str:
    labels = {
        "started": "started",
        "resumed": "resumed",
        "paused": "paused",
        "completed": "completed successfully",
        "failed": "failed",
        "cancelled": "cancelled",
    }
    return f"[ZYND MF] Pipeline {labels[event]} ({run.mode})"


def _event_body(run: MfPipelineRunState, event: PipelineEvent, *, pause_reason: str | None) -> str:
    lines = [
        f"Pipeline run: {run.run_id}",
        f"Mode: {run.mode}",
        f"Event: {event}",
        f"Status: {run.status.value}",
    ]
    if pause_reason:
        lines.append(f"Pause reason: {pause_reason}")
    if run.error:
        lines.append(f"Message: {run.error}")
    if run.current_step_key:
        lines.append(f"Current step: {run.current_step_key}")
    batch_uuid = run.context.get("batch_uuid")
    if batch_uuid:
        lines.append(f"Staging batch: {batch_uuid}")
    return "\n".join(lines)


async def notify_pipeline_event(
    run: MfPipelineRunState,
    *,
    event: PipelineEvent,
    pause_reason: str | None = None,
) -> None:
    settings = get_settings()
    resolved_pause_reason = pause_reason or run.context.get("pause_reason")

    if settings.zynd_mf_pipeline_audit_enabled:
        actor_id = run.context.get("actor_user_id")
        user_id = UUID(actor_id) if actor_id else None
        async with AsyncSessionLocal() as session:
            await write_audit(
                session,
                event_type=AuditEventType.admin_action_requested,
                user_id=user_id,
                metadata={
                    "module": "mf_pipeline",
                    "kind": f"mf_pipeline_{event}",
                    "run_id": run.run_id,
                    "mode": run.mode,
                    "status": run.status.value,
                    "pause_reason": resolved_pause_reason,
                    "current_step_key": run.current_step_key,
                    "staging_batch_uuid": run.context.get("batch_uuid"),
                    "error": run.error,
                },
            )
            await session.commit()

    if event not in {"paused", "failed", "completed"}:
        return

    recipients = [
        email.strip()
        for email in settings.zynd_mf_ops_alert_emails.split(",")
        if email.strip()
    ]
    if not recipients:
        return

    subject = _event_subject(run, event)
    body = _event_body(run, event, pause_reason=resolved_pause_reason)
    for email in recipients:
        try:
            await send_security_email(to_email=email, subject=subject, body=body)
        except Exception:
            logger.exception("Failed to send MF pipeline ops alert to %s", email)
