from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable


class MfPipelineRunStatus(str, Enum):
    pending = "pending"
    running = "running"
    paused = "paused"
    succeeded = "succeeded"
    failed = "failed"
    cancelled = "cancelled"


class MfPipelineStepStatus(str, Enum):
    pending = "pending"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"
    skipped = "skipped"


@dataclass
class MfPipelineLogLine:
    timestamp: str
    level: str
    message: str

    def to_dict(self) -> dict[str, str]:
        return {
            "timestamp": self.timestamp,
            "level": self.level,
            "message": self.message,
        }


@dataclass
class MfPipelineStepState:
    key: str
    label: str
    status: MfPipelineStepStatus = MfPipelineStepStatus.pending
    result: dict[str, Any] | None = None
    error: str | None = None
    ingestion_run_uuid: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "label": self.label,
            "status": self.status.value,
            "result": self.result,
            "error": self.error,
            "ingestion_run_uuid": self.ingestion_run_uuid,
        }


@dataclass
class MfPipelineRunState:
    run_id: str
    mode: str
    triggered_by: str
    status: MfPipelineRunStatus = MfPipelineRunStatus.pending
    started_at: str | None = None
    finished_at: str | None = None
    current_step_key: str | None = None
    steps: list[MfPipelineStepState] = field(default_factory=list)
    logs: list[MfPipelineLogLine] = field(default_factory=list)
    final_counts: dict[str, Any] | None = None
    health_summary: dict[str, Any] | None = None
    error: str | None = None
    context: dict[str, Any] = field(default_factory=dict)
    _cancel_requested: bool = False
    log_sink: Callable[[str, str], None] | None = field(default=None, repr=False)

    def to_dict(self) -> dict[str, Any]:
        completed = sum(
            1
            for step in self.steps
            if step.status in {MfPipelineStepStatus.succeeded, MfPipelineStepStatus.skipped}
        )
        total = len(self.steps)
        pause_reason = self.context.get("pause_reason")
        staging_batch_uuid = self.context.get("batch_uuid") if pause_reason == "awaiting_staging_approval" else None
        auto_resume_enabled = self.context.get("auto_resume", True) is not False
        return {
            "run_id": self.run_id,
            "mode": self.mode,
            "triggered_by": self.triggered_by,
            "status": self.status.value,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "current_step_key": self.current_step_key,
            "progress": {
                "completed_steps": completed,
                "total_steps": total,
                "percent": round((completed / total) * 100) if total else 0,
            },
            "steps": [step.to_dict() for step in self.steps],
            "logs": [line.to_dict() for line in self.logs[-200:]],
            "final_counts": self.final_counts,
            "health_summary": self.health_summary,
            "error": self.error,
            "can_resume": self.status
            in {MfPipelineRunStatus.paused, MfPipelineRunStatus.failed, MfPipelineRunStatus.cancelled},
            "pause_reason": pause_reason,
            "staging_batch_uuid": staging_batch_uuid,
            "can_approve_staging": pause_reason == "awaiting_staging_approval"
            and self.status == MfPipelineRunStatus.paused,
            "health_diff": self.context.get("health_diff"),
            "skip_steps": list(self.context.get("skip_steps") or []),
            "auto_resume": auto_resume_enabled,
            "auto_resume_pending": self.status == MfPipelineRunStatus.paused
            and auto_resume_enabled
            and pause_reason == "awaiting_staging_approval",
        }


class MfPipelineControlledPause(Exception):
    def __init__(self, *, pause_reason: str, message: str) -> None:
        self.pause_reason = pause_reason
        self.message = message
        super().__init__(message)


PIPELINE_MODES: frozenset[str] = frozenset(
    {
        "full",
        "bootstrap",
        "after-ingest",
        "nav-analytics-only",
        "health-repair",
        "staging-only",
    }
)


def normalize_pipeline_mode(mode: str) -> str:
    if mode == "after-ingest":
        return "bootstrap"
    return mode


FULL_PIPELINE_SEQUENTIAL_JOBS: tuple[str, ...] = (
    "catalog-lifecycle-sync",
    "amfi-scheme-master-sync",
    "amfi-fund-bridge",
    "amfi-nav-daily",
    "nav-cold-start-backfill",
    "nav-metrics-compute",
    "fund-classification-compute",
    "collection-assign-sync",
    "composite-rank-compute",
    "return-calculator-snapshot",
    "amfi-aum-monthly",
    "amfi-aaum-quarterly",
    "amfi-ter-monthly",
    "amc-aum-rank-compute",
    "scheme-min-amounts-backfill",
)

BOOTSTRAP_AFTER_INGEST_JOBS: tuple[str, ...] = (
    "catalog-lifecycle-sync",
    "amfi-scheme-master-sync",
    "amfi-fund-bridge",
    "amfi-nav-daily",
    "nav-cold-start-backfill",
    "nav-metrics-compute",
    "return-calculator-snapshot",
    "amfi-aaum-quarterly",
    "amfi-ter-monthly",
    "amc-aum-rank-compute",
)

STAGING_PIPELINE_JOB_KEYS: frozenset[str] = frozenset(
    {
        "cybrilla-scheme-ingest",
        "cybrilla-scheme-validate",
        "cybrilla-scheme-promote",
        "cybrilla-scheme-sync",
    }
)

MAX_MIN_AMOUNTS_BATCHES = 25

NAV_ANALYTICS_ONLY_JOBS: tuple[str, ...] = (
    "nav-cold-start-backfill",
    "nav-metrics-compute",
    "fund-classification-compute",
    "composite-rank-compute",
    "return-calculator-snapshot",
    "amc-aum-rank-compute",
)

HEALTH_REPAIR_JOBS: tuple[str, ...] = (
    "catalog-lifecycle-sync",
    "amfi-nav-daily",
    "nav-metrics-compute",
    "scheme-min-amounts-backfill",
)
