"""Widen ingestion_run_logs.triggered_by for pipeline run references.

Revision ID: 080_ingestion_triggered_by
Revises: 079_mf_pipeline_runs
Create Date: 2026-08-15
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "080_ingestion_triggered_by"
down_revision: Union[str, None] = "079_mf_pipeline_runs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "ingestion_run_logs",
        "triggered_by",
        existing_type=sa.String(length=32),
        type_=sa.String(length=64),
        existing_nullable=False,
        existing_server_default=sa.text("'SCHEDULER'::character varying"),
    )


def downgrade() -> None:
    op.alter_column(
        "ingestion_run_logs",
        "triggered_by",
        existing_type=sa.String(length=64),
        type_=sa.String(length=32),
        existing_nullable=False,
        existing_server_default=sa.text("'SCHEDULER'::character varying"),
    )
