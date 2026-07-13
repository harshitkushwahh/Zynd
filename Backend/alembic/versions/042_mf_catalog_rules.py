"""MF catalog rules, bulk ops & maker-checker — Phase 13.

Revision ID: 042_mf_catalog_rules
Revises: 041_mf_product_content
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "042_mf_catalog_rules"
down_revision: Union[str, None] = "041_mf_product_content"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_MF_AUDIT_EVENTS = (
    "mf_catalog_rule_created",
    "mf_catalog_rule_updated",
    "mf_catalog_rules_applied",
    "mf_catalog_bulk_submitted",
    "mf_catalog_bulk_executed",
)

_ADMIN_ACTION_TYPES = (
    "mf_catalog_bulk_apply",
    "mf_catalog_rules_apply",
)


def upgrade() -> None:
    op.create_table(
        "mf_catalog_rules",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("conditions", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("actions", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_mf_catalog_rules_enabled_priority", "mf_catalog_rules", ["enabled", "priority"])

    op.create_table(
        "mf_catalog_rule_runs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("rule_id", sa.Integer(), nullable=True),
        sa.Column("dry_run", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("affected_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("result", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("triggered_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "ran_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["rule_id"], ["mf_catalog_rules.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_mf_catalog_rule_runs_ran_at", "mf_catalog_rule_runs", ["ran_at"])

    bulk_status = postgresql.ENUM(
        "PENDING",
        "PENDING_APPROVAL",
        "RUNNING",
        "SUCCEEDED",
        "FAILED",
        name="mfbulkcatalogjobstatus",
        create_type=False,
    )
    bulk_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "mf_bulk_catalog_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", bulk_status, nullable=False, server_default="PENDING"),
        sa.Column("dry_run", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("row_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("affected_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("source_csv", sa.Text(), nullable=False),
        sa.Column("result", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("admin_action_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_mf_bulk_catalog_jobs_status", "mf_bulk_catalog_jobs", ["status"])
    op.create_index("ix_mf_bulk_catalog_jobs_created_at", "mf_bulk_catalog_jobs", ["created_at"])

    for value in _MF_AUDIT_EVENTS:
        op.execute(f"ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS '{value}'")

    for value in _ADMIN_ACTION_TYPES:
        op.execute(f"ALTER TYPE adminactiontype ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    op.drop_index("ix_mf_bulk_catalog_jobs_created_at", table_name="mf_bulk_catalog_jobs")
    op.drop_index("ix_mf_bulk_catalog_jobs_status", table_name="mf_bulk_catalog_jobs")
    op.drop_table("mf_bulk_catalog_jobs")
    op.execute("DROP TYPE IF EXISTS mfbulkcatalogjobstatus")

    op.drop_index("ix_mf_catalog_rule_runs_ran_at", table_name="mf_catalog_rule_runs")
    op.drop_table("mf_catalog_rule_runs")
    op.drop_index("ix_mf_catalog_rules_enabled_priority", table_name="mf_catalog_rules")
    op.drop_table("mf_catalog_rules")
