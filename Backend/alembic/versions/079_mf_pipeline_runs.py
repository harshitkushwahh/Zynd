"""MF pipeline runs and scheduler manual skip tracking.

Revision ID: 079_mf_pipeline_runs
Revises: 078_state_head_status
Create Date: 2026-08-15
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "079_mf_pipeline_runs"
down_revision: Union[str, None] = "078_state_head_status"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_pipeline_status = postgresql.ENUM(
    "pending",
    "running",
    "paused",
    "succeeded",
    "failed",
    "cancelled",
    name="mf_pipeline_run_status",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    _pipeline_status.create(bind, checkfirst=True)

    op.create_table(
        "mf_pipeline_runs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("run_uuid", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("mode", sa.String(length=32), nullable=False),
        sa.Column("triggered_by", sa.String(length=32), nullable=False),
        sa.Column("status", _pipeline_status, nullable=False, server_default="pending"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_step_key", sa.String(length=64), nullable=True),
        sa.Column("context", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("steps", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("logs", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("final_counts", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("health_summary", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("cancel_requested", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_uuid"),
    )
    op.create_index("ix_mf_pipeline_runs_status", "mf_pipeline_runs", ["status"])

    op.create_table(
        "mf_scheduler_job_skips",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("job_name", sa.String(length=64), nullable=False),
        sa.Column("skip_date_ist", sa.Date(), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("pipeline_run_uuid", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("job_name", "skip_date_ist", name="uq_mf_scheduler_job_skips"),
    )
    op.create_index("ix_mf_scheduler_job_skips_skip_date_ist", "mf_scheduler_job_skips", ["skip_date_ist"])


def downgrade() -> None:
    op.drop_index("ix_mf_scheduler_job_skips_skip_date_ist", table_name="mf_scheduler_job_skips")
    op.drop_table("mf_scheduler_job_skips")
    op.drop_index("ix_mf_pipeline_runs_status", table_name="mf_pipeline_runs")
    op.drop_table("mf_pipeline_runs")
    bind = op.get_bind()
    _pipeline_status.drop(bind, checkfirst=True)
